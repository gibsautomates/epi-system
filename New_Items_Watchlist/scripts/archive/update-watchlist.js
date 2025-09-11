const { createClient } = require('@supabase/supabase-js');
const ExcelJS = require('exceljs');
const fs = require('fs');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// SQL to create necessary tables if they don't exist
const CREATE_TABLES_SQL = `
-- Create new_items_master table to track all new items globally
CREATE TABLE IF NOT EXISTS new_items_master (
  upc TEXT PRIMARY KEY,
  item_name TEXT,
  brand TEXT,
  first_seen_date DATE DEFAULT CURRENT_DATE,
  last_seen_date DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'active', -- active, acquired, removed
  acquired_date DATE,
  domestic_vendor_count INTEGER DEFAULT 0,
  international_vendor_count INTEGER DEFAULT 0,
  min_price_domestic DECIMAL(10,2),
  avg_price_domestic DECIMAL(10,2),
  max_price_domestic DECIMAL(10,2),
  price_trend TEXT, -- up, down, stable
  vendor_list JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create vendor_item_tracking table for vendor persistence
CREATE TABLE IF NOT EXISTS vendor_item_tracking (
  id SERIAL PRIMARY KEY,
  upc TEXT,
  vendor_name TEXT,
  location TEXT, -- Domestic/International
  status TEXT DEFAULT 'active', -- active, missing, removed
  last_price DECIMAL(10,2),
  last_qty INTEGER,
  last_seen_date DATE DEFAULT CURRENT_DATE,
  missing_streak INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(upc, vendor_name)
);

-- Create price_history table
CREATE TABLE IF NOT EXISTS price_history (
  id SERIAL PRIMARY KEY,
  upc TEXT,
  vendor_name TEXT,
  location TEXT,
  price DECIMAL(10,2),
  qty INTEGER,
  date_recorded DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create vendor_upload_log table
CREATE TABLE IF NOT EXISTS vendor_upload_log (
  id SERIAL PRIMARY KEY,
  vendor_name TEXT,
  upload_date DATE DEFAULT CURRENT_DATE,
  items_count INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
`;

async function updateWatchlist() {
  console.log('🔄 WATCHLIST UPDATE PROCESS');
  console.log('============================\n');
  
  try {
    // Step 1: Get current inventory
    console.log('📦 Loading current inventory...');
    const { data: inventory } = await supabase
      .from('current_inventory')
      .select('UPC, upc_text, ProductName');
    
    const inventorySet = new Set(
      inventory.map(i => String(i.UPC || i.upc_text).trim())
    );
    console.log(`  ✓ Loaded ${inventorySet.size} inventory items`);
    
    // Step 2: Get latest vendor offers
    console.log('\n📊 Analyzing vendor offers...');
    const { data: offers } = await supabase
      .from('vendor_offers')
      .select('*')
      .order('date', { ascending: false });
    
    // Group by UPC
    const upcData = new Map();
    const vendorsSeen = new Set();
    
    offers.forEach(offer => {
      const upc = String(offer.upc || offer.upc_text).trim();
      vendorsSeen.add(offer.vendor);
      
      if (!upcData.has(upc)) {
        upcData.set(upc, {
          upc,
          item_name: offer.item_name,
          brand: offer.brand,
          is_in_inventory: inventorySet.has(upc),
          vendors: new Map(),
          domestic_vendors: [],
          international_vendors: [],
          prices_domestic: [],
          latest_date: offer.date
        });
      }
      
      const item = upcData.get(upc);
      
      // Track vendor
      if (!item.vendors.has(offer.vendor)) {
        item.vendors.set(offer.vendor, {
          location: offer.location,
          price: offer.price,
          qty: offer.qty,
          date: offer.date
        });
        
        if (offer.location === 'Domestic') {
          item.domestic_vendors.push(offer.vendor);
          if (offer.price > 0) item.prices_domestic.push(offer.price);
        } else {
          item.international_vendors.push(offer.vendor);
        }
      }
    });
    
    console.log(`  ✓ Found ${upcData.size} unique UPCs`);
    console.log(`  ✓ From ${vendorsSeen.size} vendors`);
    
    // Step 3: Get existing watchlist data
    console.log('\n📋 Loading existing watchlist...');
    const { data: existingWatchlist } = await supabase
      .from('new_items_master')
      .select('*');
    
    const existingMap = new Map(
      existingWatchlist ? existingWatchlist.map(item => [item.upc, item]) : []
    );
    console.log(`  ✓ Found ${existingMap.size} existing watchlist items`);
    
    // Step 4: Update watchlist
    console.log('\n🔄 Updating watchlist...');
    const updates = [];
    const inserts = [];
    const statusChanges = {
      new: [],
      acquired: [],
      reappeared: []
    };
    
    upcData.forEach((item, upc) => {
      const existing = existingMap.get(upc);
      const isNew = !item.is_in_inventory;
      
      if (isNew) {
        const domesticPrices = item.prices_domestic.filter(p => p > 0);
        const record = {
          upc,
          item_name: item.item_name,
          brand: item.brand,
          status: 'active',
          domestic_vendor_count: item.domestic_vendors.length,
          international_vendor_count: item.international_vendors.length,
          min_price_domestic: domesticPrices.length ? Math.min(...domesticPrices) : null,
          avg_price_domestic: domesticPrices.length 
            ? (domesticPrices.reduce((a,b) => a+b, 0) / domesticPrices.length).toFixed(2)
            : null,
          max_price_domestic: domesticPrices.length ? Math.max(...domesticPrices) : null,
          vendor_list: {
            domestic: item.domestic_vendors,
            international: item.international_vendors
          },
          last_seen_date: item.latest_date,
          updated_at: new Date().toISOString()
        };
        
        if (existing) {
          // Update existing
          if (existing.status === 'acquired') {
            statusChanges.reappeared.push(item);
            record.status = 'active';
            record.acquired_date = null;
          }
          
          // Calculate price trend
          if (existing.avg_price_domestic && record.avg_price_domestic) {
            const priceDiff = record.avg_price_domestic - existing.avg_price_domestic;
            if (Math.abs(priceDiff) < 0.5) {
              record.price_trend = 'stable';
            } else if (priceDiff > 0) {
              record.price_trend = 'up';
            } else {
              record.price_trend = 'down';
            }
          }
          
          updates.push(record);
        } else {
          // New item
          statusChanges.new.push(item);
          record.first_seen_date = item.latest_date;
          inserts.push(record);
        }
      } else if (existing && existing.status === 'active') {
        // Item has been acquired (now in inventory)
        statusChanges.acquired.push({
          ...item,
          previous_data: existing
        });
        
        updates.push({
          upc,
          status: 'acquired',
          acquired_date: new Date().toISOString().slice(0, 10),
          updated_at: new Date().toISOString()
        });
      }
    });
    
    // Execute updates
    if (inserts.length > 0) {
      const { error } = await supabase
        .from('new_items_master')
        .insert(inserts);
      
      if (error) console.log('Insert error:', error);
      else console.log(`  ✓ Added ${inserts.length} new items`);
    }
    
    if (updates.length > 0) {
      for (const update of updates) {
        const { error } = await supabase
          .from('new_items_master')
          .update(update)
          .eq('upc', update.upc);
        
        if (error) console.log(`Update error for ${update.upc}:`, error);
      }
      console.log(`  ✓ Updated ${updates.length} existing items`);
    }
    
    // Display summary
    console.log('\n📈 UPDATE SUMMARY');
    console.log('=================');
    console.log(`New items added: ${statusChanges.new.length}`);
    console.log(`Items acquired: ${statusChanges.acquired.length}`);
    console.log(`Items reappeared: ${statusChanges.reappeared.length}`);
    
    // Get items with 3+ domestic vendors
    const qualified3Plus = [...upcData.values()]
      .filter(item => !item.is_in_inventory && item.domestic_vendors.length >= 3)
      .sort((a, b) => b.domestic_vendors.length - a.domestic_vendors.length);
    
    console.log(`\nItems with 3+ domestic vendors: ${qualified3Plus.length}`);
    
    if (qualified3Plus.length > 0) {
      console.log('\nTop 5 opportunities:');
      qualified3Plus.slice(0, 5).forEach((item, idx) => {
        console.log(`${idx + 1}. ${item.item_name} (${item.domestic_vendors.length} vendors)`);
      });
    }
    
    return {
      statusChanges,
      qualified3Plus,
      summary: {
        total_items: upcData.size,
        new_items: statusChanges.new.length,
        acquired: statusChanges.acquired.length,
        qualified: qualified3Plus.length
      }
    };
    
  } catch (error) {
    console.error('Error updating watchlist:', error);
    throw error;
  }
}

async function generateChangeReport(data) {
  console.log('\n📝 Generating change report...');
  
  const workbook = new ExcelJS.Workbook();
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  
  // Summary Sheet
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [
    { header: 'Change Type', key: 'type', width: 20 },
    { header: 'Count', key: 'count', width: 15 }
  ];
  
  summarySheet.addRows([
    { type: 'New Items', count: data.summary.new_items },
    { type: 'Acquired Items', count: data.summary.acquired },
    { type: '3+ Vendor Items', count: data.summary.qualified }
  ]);
  
  // New Items Sheet
  if (data.statusChanges.new.length > 0) {
    const newSheet = workbook.addWorksheet('New Items');
    newSheet.columns = [
      { header: 'UPC', key: 'upc', width: 15 },
      { header: 'Item Name', key: 'name', width: 50 },
      { header: 'Vendors', key: 'vendors', width: 10 }
    ];
    
    data.statusChanges.new.forEach(item => {
      newSheet.addRow({
        upc: item.upc,
        name: item.item_name,
        vendors: item.domestic_vendors.length
      });
    });
  }
  
  // Acquired Items Sheet
  if (data.statusChanges.acquired.length > 0) {
    const acquiredSheet = workbook.addWorksheet('Acquired Items');
    acquiredSheet.columns = [
      { header: 'UPC', key: 'upc', width: 15 },
      { header: 'Item Name', key: 'name', width: 50 },
      { header: 'Days Watched', key: 'days', width: 15 }
    ];
    
    data.statusChanges.acquired.forEach(item => {
      const daysWatched = item.previous_data.first_seen_date 
        ? Math.floor((new Date() - new Date(item.previous_data.first_seen_date)) / (1000 * 60 * 60 * 24))
        : 0;
      
      acquiredSheet.addRow({
        upc: item.upc,
        name: item.item_name,
        days: daysWatched
      });
    });
  }
  
  const filename = `Watchlist_Update_${timestamp}.xlsx`;
  await workbook.xlsx.writeFile(filename);
  console.log(`  ✓ Report saved: ${filename}`);
  
  return filename;
}

// Main execution
async function main() {
  try {
    // First, check if tables exist
    console.log('Checking database tables...');
    const { count } = await supabase
      .from('new_items_master')
      .select('*', { count: 'exact', head: true });
    
    if (count === null) {
      console.log('⚠️  Table new_items_master does not exist.');
      console.log('Please run the following SQL in Supabase SQL Editor:');
      console.log('\n' + CREATE_TABLES_SQL);
      return;
    }
    
    const results = await updateWatchlist();
    
    if (results.statusChanges.new.length > 0 || results.statusChanges.acquired.length > 0) {
      await generateChangeReport(results);
    }
    
    console.log('\n✅ Watchlist update complete!');
    
  } catch (error) {
    console.error('Failed:', error.message);
  }
}

main();