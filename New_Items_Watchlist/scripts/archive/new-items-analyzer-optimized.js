const { createClient } = require('@supabase/supabase-js');
const ExcelJS = require('exceljs');
const fs = require('fs');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getTableCounts() {
  console.log('Getting record counts...');
  
  const { count: vendorCount } = await supabase
    .from('vendor_offers')
    .select('*', { count: 'exact', head: true });
    
  const { count: inventoryCount } = await supabase
    .from('current_inventory')
    .select('*', { count: 'exact', head: true });
    
  console.log(`  vendor_offers: ${vendorCount} records`);
  console.log(`  current_inventory: ${inventoryCount} records`);
  
  return { vendorCount, inventoryCount };
}

async function fetchBatch(table, select, offset, limit) {
  const { data, error } = await supabase
    .from(table)
    .select(select)
    .range(offset, offset + limit - 1);
    
  if (error) throw error;
  return data || [];
}

async function analyzeNewItemsOptimized() {
  console.log('\n🚀 NEW ITEMS ANALYSIS - OPTIMIZED VERSION');
  console.log('==========================================\n');
  
  try {
    // Get counts first
    const counts = await getTableCounts();
    
    // Fetch current inventory UPCs first (smaller dataset)
    console.log('\n📦 Loading current inventory...');
    const inventoryUPCs = new Set();
    const batchSize = 5000;
    
    for (let offset = 0; offset < counts.inventoryCount; offset += batchSize) {
      const batch = await fetchBatch('current_inventory', 'UPC, upc_text', offset, batchSize);
      batch.forEach(item => {
        const upc = String(item.UPC || item.upc_text).trim();
        if (upc) inventoryUPCs.add(upc);
      });
      process.stdout.write(`  Processed: ${Math.min(offset + batchSize, counts.inventoryCount)}/${counts.inventoryCount}\r`);
    }
    console.log(`\n  ✓ Loaded ${inventoryUPCs.size} unique inventory UPCs`);
    
    // Process vendor offers in batches
    console.log('\n📊 Analyzing vendor offers...');
    const upcMap = new Map();
    let processedCount = 0;
    
    for (let offset = 0; offset < counts.vendorCount; offset += batchSize) {
      const batch = await fetchBatch(
        'vendor_offers', 
        'upc, upc_text, item_name, brand, vendor, location, price, qty, date',
        offset,
        batchSize
      );
      
      batch.forEach(offer => {
        const upcKey = String(offer.upc || offer.upc_text).trim();
        if (!upcKey) return;
        
        if (!upcMap.has(upcKey)) {
          upcMap.set(upcKey, {
            upc: upcKey,
            item_name: offer.item_name,
            brand: offer.brand,
            is_new: !inventoryUPCs.has(upcKey),
            vendors: new Map(),
            domestic_vendors: new Set(),
            international_vendors: new Set(),
            all_prices_domestic: [],
            first_seen: offer.date,
            last_seen: offer.date
          });
        }
        
        const item = upcMap.get(upcKey);
        
        // Update item name if better one found
        if (offer.item_name && offer.item_name.length > (item.item_name || '').length) {
          item.item_name = offer.item_name;
        }
        
        // Track vendor
        if (!item.vendors.has(offer.vendor)) {
          item.vendors.set(offer.vendor, {
            location: offer.location,
            prices: [],
            last_date: offer.date
          });
        }
        
        const vendorInfo = item.vendors.get(offer.vendor);
        if (offer.price > 0) {
          vendorInfo.prices.push(offer.price);
        }
        vendorInfo.last_date = offer.date;
        
        // Track by location
        if (offer.location === 'Domestic') {
          item.domestic_vendors.add(offer.vendor);
          if (offer.price > 0) {
            item.all_prices_domestic.push(offer.price);
          }
        } else if (offer.location === 'International') {
          item.international_vendors.add(offer.vendor);
        }
        
        // Update dates
        if (offer.date < item.first_seen) item.first_seen = offer.date;
        if (offer.date > item.last_seen) item.last_seen = offer.date;
      });
      
      processedCount += batch.length;
      process.stdout.write(`  Processed: ${processedCount}/${counts.vendorCount}\r`);
    }
    
    console.log(`\n  ✓ Found ${upcMap.size} unique UPCs in vendor offers`);
    
    // Process and filter results
    console.log('\n🔍 Filtering and analyzing...');
    const newItems = [];
    const qualified3Plus = [];
    
    upcMap.forEach(item => {
      if (!item.is_new) return;
      
      const domesticVendorList = Array.from(item.domestic_vendors);
      const domesticPrices = item.all_prices_domestic.filter(p => p > 0);
      
      const result = {
        upc: item.upc,
        item_name: item.item_name || 'Unknown',
        brand: item.brand || 'N/A',
        domestic_vendor_count: domesticVendorList.length,
        total_vendor_count: item.vendors.size,
        domestic_vendors: domesticVendorList,
        min_price_domestic: domesticPrices.length > 0 ? Math.min(...domesticPrices) : null,
        avg_price_domestic: domesticPrices.length > 0 
          ? (domesticPrices.reduce((a, b) => a + b, 0) / domesticPrices.length).toFixed(2)
          : null,
        max_price_domestic: domesticPrices.length > 0 ? Math.max(...domesticPrices) : null,
        first_seen: item.first_seen,
        last_seen: item.last_seen
      };
      
      newItems.push(result);
      
      if (result.domestic_vendor_count >= 3) {
        qualified3Plus.push(result);
      }
    });
    
    // Sort by priority
    qualified3Plus.sort((a, b) => {
      if (b.domestic_vendor_count !== a.domestic_vendor_count) {
        return b.domestic_vendor_count - a.domestic_vendor_count;
      }
      return (a.min_price_domestic || 999999) - (b.min_price_domestic || 999999);
    });
    
    console.log('  ✓ Analysis complete');
    
    // Display summary
    console.log('\n📈 RESULTS SUMMARY');
    console.log('==================');
    console.log(`Total UPCs analyzed: ${upcMap.size}`);
    console.log(`Items in inventory: ${inventoryUPCs.size}`);
    console.log(`NEW ITEMS found: ${newItems.length}`);
    console.log(`Items with 3+ domestic vendors: ${qualified3Plus.length}`);
    
    // Show top items
    if (qualified3Plus.length > 0) {
      console.log('\n🌟 TOP 10 OPPORTUNITIES (3+ Domestic Vendors)');
      console.log('==============================================');
      qualified3Plus.slice(0, 10).forEach((item, idx) => {
        console.log(`\n${idx + 1}. ${item.item_name}`);
        console.log(`   UPC: ${item.upc}`);
        console.log(`   ${item.domestic_vendor_count} vendors: ${item.domestic_vendors.slice(0, 5).join(', ')}${item.domestic_vendors.length > 5 ? '...' : ''}`);
        console.log(`   Price: $${item.min_price_domestic} - $${item.max_price_domestic} (Avg: $${item.avg_price_domestic})`);
      });
    }
    
    return {
      newItems,
      qualified3Plus,
      summary: {
        total_upcs: upcMap.size,
        inventory_count: inventoryUPCs.size,
        new_items_count: newItems.length,
        qualified_count: qualified3Plus.length
      }
    };
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

async function generateExcelReport(data) {
  console.log('\n📝 Generating Excel report...');
  
  const workbook = new ExcelJS.Workbook();
  const timestamp = new Date().toISOString().slice(0, 10);
  
  // Summary Sheet
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [
    { header: 'Metric', key: 'metric', width: 35 },
    { header: 'Value', key: 'value', width: 20 }
  ];
  
  summarySheet.addRows([
    { metric: 'Report Date', value: new Date().toLocaleDateString() },
    { metric: 'Report Time', value: new Date().toLocaleTimeString() },
    { metric: 'Total UPCs Analyzed', value: data.summary.total_upcs },
    { metric: 'Items in Current Inventory', value: data.summary.inventory_count },
    { metric: 'New Items Found', value: data.summary.new_items_count },
    { metric: 'Items with 3+ Domestic Vendors', value: data.summary.qualified_count }
  ]);
  
  // Priority Items Sheet (3+ Domestic)
  const prioritySheet = workbook.addWorksheet('3+ Domestic Vendors');
  prioritySheet.columns = [
    { header: 'Priority', key: 'priority', width: 10 },
    { header: 'UPC', key: 'upc', width: 15 },
    { header: 'Item Name', key: 'item_name', width: 60 },
    { header: 'Brand', key: 'brand', width: 20 },
    { header: '# Vendors', key: 'vendor_count', width: 12 },
    { header: 'Vendor List', key: 'vendors', width: 60 },
    { header: 'Min Price', key: 'min_price', width: 12 },
    { header: 'Avg Price', key: 'avg_price', width: 12 },
    { header: 'Max Price', key: 'max_price', width: 12 },
    { header: 'First Seen', key: 'first_seen', width: 12 },
    { header: 'Last Seen', key: 'last_seen', width: 12 }
  ];
  
  data.qualified3Plus.forEach((item, idx) => {
    prioritySheet.addRow({
      priority: idx + 1,
      upc: item.upc,
      item_name: item.item_name,
      brand: item.brand,
      vendor_count: item.domestic_vendor_count,
      vendors: item.domestic_vendors.join(', '),
      min_price: item.min_price_domestic,
      avg_price: item.avg_price_domestic,
      max_price: item.max_price_domestic,
      first_seen: item.first_seen,
      last_seen: item.last_seen
    });
  });
  
  // All New Items Sheet
  const allItemsSheet = workbook.addWorksheet('All New Items');
  allItemsSheet.columns = [
    { header: 'UPC', key: 'upc', width: 15 },
    { header: 'Item Name', key: 'item_name', width: 60 },
    { header: 'Brand', key: 'brand', width: 20 },
    { header: 'Domestic Vendors', key: 'domestic_count', width: 18 },
    { header: 'Total Vendors', key: 'total_count', width: 15 },
    { header: 'Min Price (Dom)', key: 'min_price', width: 15 },
    { header: 'Avg Price (Dom)', key: 'avg_price', width: 15 }
  ];
  
  data.newItems.forEach(item => {
    allItemsSheet.addRow({
      upc: item.upc,
      item_name: item.item_name,
      brand: item.brand,
      domestic_count: item.domestic_vendor_count,
      total_count: item.total_vendor_count,
      min_price: item.min_price_domestic,
      avg_price: item.avg_price_domestic
    });
  });
  
  // Format all sheets
  [summarySheet, prioritySheet, allItemsSheet].forEach(sheet => {
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4CAF50' }
    };
    sheet.getRow(1).alignment = { horizontal: 'center' };
  });
  
  // Save files
  const excelFile = `New_Items_Report_${timestamp}.xlsx`;
  await workbook.xlsx.writeFile(excelFile);
  console.log(`  ✓ Excel saved: ${excelFile}`);
  
  // Create CSV for priority items
  const csvContent = [
    ['UPC', 'Item Name', 'Brand', 'Vendors', 'Vendor List', 'Min Price', 'Avg Price'],
    ...data.qualified3Plus.map(item => [
      item.upc,
      `"${item.item_name}"`,
      item.brand,
      item.domestic_vendor_count,
      `"${item.domestic_vendors.join('; ')}"`,
      item.min_price_domestic,
      item.avg_price_domestic
    ])
  ].map(row => row.join(',')).join('\n');
  
  const csvFile = `Priority_Items_${timestamp}.csv`;
  fs.writeFileSync(csvFile, csvContent);
  console.log(`  ✓ CSV saved: ${csvFile}`);
  
  return { excelFile, csvFile };
}

// Main execution
async function main() {
  try {
    const startTime = Date.now();
    
    const results = await analyzeNewItemsOptimized();
    const files = await generateExcelReport(results);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log('\n✅ COMPLETE!');
    console.log(`   Total time: ${duration} seconds`);
    console.log(`   Files created: ${files.excelFile}, ${files.csvFile}`);
    
  } catch (error) {
    console.error('Failed:', error.message);
  }
}

main();