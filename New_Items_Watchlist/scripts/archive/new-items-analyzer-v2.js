const { createClient } = require('@supabase/supabase-js');
const ExcelJS = require('exceljs');
const fs = require('fs');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Configuration
const CONFIG = {
  DAYS_FILTER: 21,  // Only show items from last 21 days for client reports
  MIN_DOMESTIC_VENDORS: 3,  // Minimum domestic vendors for client report
  BATCH_SIZE: 5000
};

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

async function fetchBatch(table, select, offset, limit, filters = {}) {
  let query = supabase
    .from(table)
    .select(select)
    .range(offset, offset + limit - 1);
  
  // Apply filters
  if (filters.dateColumn && filters.daysBack) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - filters.daysBack);
    query = query.gte(filters.dateColumn, cutoffDate.toISOString().split('T')[0]);
  }
  
  const { data, error } = await query;
    
  if (error) throw error;
  return data || [];
}

async function analyzeNewItems() {
  console.log('\n🚀 NEW ITEMS ANALYSIS V2 - WITH DATE FILTERS');
  console.log('=============================================\n');
  
  try {
    const startTime = Date.now();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - CONFIG.DAYS_FILTER);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
    
    console.log(`📅 Date Filter: Including vendor data from ${cutoffDateStr} onwards (last ${CONFIG.DAYS_FILTER} days)\n`);
    
    // Get counts
    const counts = await getTableCounts();
    
    // Get recent vendor offers count
    const { count: recentOffersCount } = await supabase
      .from('vendor_offers')
      .select('*', { count: 'exact', head: true })
      .gte('date', cutoffDateStr);
    
    console.log(`📊 Recent offers (last ${CONFIG.DAYS_FILTER} days): ${recentOffersCount} records\n`);
    
    // Fetch current inventory UPCs
    console.log('📦 Loading current inventory...');
    const inventoryUPCs = new Set();
    
    for (let offset = 0; offset < counts.inventoryCount; offset += CONFIG.BATCH_SIZE) {
      const batch = await fetchBatch('current_inventory', 'UPC, upc_text', offset, CONFIG.BATCH_SIZE);
      batch.forEach(item => {
        const upc = String(item.UPC || item.upc_text).trim();
        if (upc) inventoryUPCs.add(upc);
      });
      process.stdout.write(`  Processed: ${Math.min(offset + CONFIG.BATCH_SIZE, counts.inventoryCount)}/${counts.inventoryCount}\r`);
    }
    console.log(`\n  ✓ Loaded ${inventoryUPCs.size} unique inventory UPCs`);
    
    // Process ALL vendor offers to track vendor history
    console.log('\n📊 Analyzing ALL vendor offers for vendor tracking...');
    const vendorHistory = new Map(); // Track each vendor's last submission
    const upcMapAll = new Map(); // All items regardless of date
    const upcMapRecent = new Map(); // Only recent items for client report
    
    let processedCount = 0;
    
    for (let offset = 0; offset < counts.vendorCount; offset += CONFIG.BATCH_SIZE) {
      const batch = await fetchBatch(
        'vendor_offers', 
        'upc, upc_text, item_name, brand, vendor, location, price, qty, date',
        offset,
        CONFIG.BATCH_SIZE
      );
      
      batch.forEach(offer => {
        const upcKey = String(offer.upc || offer.upc_text).trim();
        if (!upcKey) return;
        
        // Track vendor's last submission date
        if (!vendorHistory.has(offer.vendor)) {
          vendorHistory.set(offer.vendor, {
            lastDate: offer.date,
            location: offer.location,
            itemCount: 0,
            upcs: new Set()
          });
        }
        
        const vendorInfo = vendorHistory.get(offer.vendor);
        if (offer.date > vendorInfo.lastDate) {
          vendorInfo.lastDate = offer.date;
        }
        vendorInfo.upcs.add(upcKey);
        
        // Process for ALL items map (vendor tracking)
        if (!upcMapAll.has(upcKey)) {
          upcMapAll.set(upcKey, {
            upc: upcKey,
            item_name: offer.item_name,
            brand: offer.brand,
            is_new: !inventoryUPCs.has(upcKey),
            vendors: new Map(),
            domestic_vendors: new Set(),
            international_vendors: new Set(),
            vendor_last_dates: new Map(),
            first_seen_global: offer.date,
            last_seen_global: offer.date,
            first_seen_domestic: null,
            last_seen_domestic: null
          });
        }
        
        const itemAll = upcMapAll.get(upcKey);
        
        // Track vendor-specific last date
        itemAll.vendor_last_dates.set(offer.vendor, offer.date);
        
        // Update dates
        if (offer.date < itemAll.first_seen_global) itemAll.first_seen_global = offer.date;
        if (offer.date > itemAll.last_seen_global) itemAll.last_seen_global = offer.date;
        
        if (offer.location === 'Domestic') {
          if (!itemAll.first_seen_domestic || offer.date < itemAll.first_seen_domestic) {
            itemAll.first_seen_domestic = offer.date;
          }
          if (!itemAll.last_seen_domestic || offer.date > itemAll.last_seen_domestic) {
            itemAll.last_seen_domestic = offer.date;
          }
        }
        
        // Process RECENT items for client report (last 21 days only)
        const isRecent = offer.date >= cutoffDateStr;
        
        if (isRecent) {
          if (!upcMapRecent.has(upcKey)) {
            upcMapRecent.set(upcKey, {
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
          
          const itemRecent = upcMapRecent.get(upcKey);
          
          // Update item details
          if (offer.item_name && offer.item_name.length > (itemRecent.item_name || '').length) {
            itemRecent.item_name = offer.item_name;
          }
          
          // Track vendor
          if (!itemRecent.vendors.has(offer.vendor)) {
            itemRecent.vendors.set(offer.vendor, {
              location: offer.location,
              prices: [],
              last_date: offer.date
            });
          }
          
          const vendorData = itemRecent.vendors.get(offer.vendor);
          if (offer.price > 0) {
            vendorData.prices.push(offer.price);
          }
          vendorData.last_date = offer.date;
          
          // Track by location
          if (offer.location === 'Domestic') {
            itemRecent.domestic_vendors.add(offer.vendor);
            if (offer.price > 0) {
              itemRecent.all_prices_domestic.push(offer.price);
            }
          } else if (offer.location === 'International') {
            itemRecent.international_vendors.add(offer.vendor);
          }
          
          // Update dates
          if (offer.date < itemRecent.first_seen) itemRecent.first_seen = offer.date;
          if (offer.date > itemRecent.last_seen) itemRecent.last_seen = offer.date;
        }
      });
      
      processedCount += batch.length;
      process.stdout.write(`  Processed: ${processedCount}/${counts.vendorCount}\r`);
    }
    
    console.log(`\n  ✓ Found ${upcMapAll.size} total unique UPCs across all dates`);
    console.log(`  ✓ Found ${upcMapRecent.size} unique UPCs in last ${CONFIG.DAYS_FILTER} days`);
    
    // Analyze vendor submission patterns
    console.log('\n📈 Vendor Submission Analysis:');
    const domesticVendors = Array.from(vendorHistory.entries())
      .filter(([_, info]) => info.location === 'Domestic')
      .sort((a, b) => new Date(b[1].lastDate) - new Date(a[1].lastDate));
    
    console.log(`  Total vendors tracked: ${vendorHistory.size}`);
    console.log(`  Domestic vendors: ${domesticVendors.length}`);
    console.log(`\n  Recent submissions (last 5 domestic vendors):`);
    domesticVendors.slice(0, 5).forEach(([vendor, info]) => {
      const daysSinceSubmission = Math.floor((new Date() - new Date(info.lastDate)) / (1000 * 60 * 60 * 24));
      console.log(`    ${vendor}: ${info.lastDate} (${daysSinceSubmission} days ago) - ${info.upcs.size} items`);
    });
    
    // Filter and process results for CLIENT REPORT (recent items only)
    console.log('\n🔍 Filtering recent items for client report...');
    const newItemsRecent = [];
    const qualified3PlusRecent = [];
    
    upcMapRecent.forEach(item => {
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
      
      newItemsRecent.push(result);
      
      if (result.domestic_vendor_count >= CONFIG.MIN_DOMESTIC_VENDORS) {
        qualified3PlusRecent.push(result);
      }
    });
    
    // Sort by priority
    qualified3PlusRecent.sort((a, b) => {
      if (b.domestic_vendor_count !== a.domestic_vendor_count) {
        return b.domestic_vendor_count - a.domestic_vendor_count;
      }
      return (a.min_price_domestic || 999999) - (b.min_price_domestic || 999999);
    });
    
    // Get ALL TIME stats for comparison
    const newItemsAllTime = Array.from(upcMapAll.values()).filter(item => item.is_new).length;
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    // Display summary
    console.log('  ✓ Analysis complete');
    console.log('\n📈 RESULTS SUMMARY');
    console.log('==================');
    console.log(`Analysis completed in: ${duration} seconds`);
    console.log(`\nALL TIME Statistics:`);
    console.log(`  Total UPCs analyzed: ${upcMapAll.size}`);
    console.log(`  New items (all time): ${newItemsAllTime}`);
    console.log(`\nLAST ${CONFIG.DAYS_FILTER} DAYS (Client Report):`);
    console.log(`  UPCs with recent activity: ${upcMapRecent.size}`);
    console.log(`  NEW ITEMS found: ${newItemsRecent.length}`);
    console.log(`  Items with ${CONFIG.MIN_DOMESTIC_VENDORS}+ domestic vendors: ${qualified3PlusRecent.length}`);
    
    // Show top items
    if (qualified3PlusRecent.length > 0) {
      console.log(`\n🌟 TOP 5 OPPORTUNITIES (${CONFIG.MIN_DOMESTIC_VENDORS}+ Domestic Vendors, Last ${CONFIG.DAYS_FILTER} Days)`);
      console.log('==================================================================');
      qualified3PlusRecent.slice(0, 5).forEach((item, idx) => {
        console.log(`\n${idx + 1}. ${item.item_name}`);
        console.log(`   UPC: ${item.upc}`);
        console.log(`   ${item.domestic_vendor_count} vendors: ${item.domestic_vendors.slice(0, 5).join(', ')}${item.domestic_vendors.length > 5 ? '...' : ''}`);
        console.log(`   Price: $${item.min_price_domestic} - $${item.max_price_domestic} (Avg: $${item.avg_price_domestic})`);
      });
    }
    
    return {
      newItemsRecent,
      qualified3PlusRecent,
      vendorHistory,
      upcMapAll,
      summary: {
        total_upcs_all: upcMapAll.size,
        total_upcs_recent: upcMapRecent.size,
        inventory_count: inventoryUPCs.size,
        new_items_all: newItemsAllTime,
        new_items_recent: newItemsRecent.length,
        qualified_count: qualified3PlusRecent.length,
        days_filter: CONFIG.DAYS_FILTER
      }
    };
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

async function generateExcelReport(data) {
  console.log('\n📝 Generating Excel report with date filters...');
  
  const workbook = new ExcelJS.Workbook();
  const timestamp = new Date().toISOString().slice(0, 10);
  
  // Summary Sheet
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [
    { header: 'Metric', key: 'metric', width: 40 },
    { header: 'Value', key: 'value', width: 20 }
  ];
  
  summarySheet.addRows([
    { metric: 'Report Date', value: new Date().toLocaleDateString() },
    { metric: 'Report Time', value: new Date().toLocaleTimeString() },
    { metric: '', value: '' },
    { metric: '📊 ALL TIME STATISTICS', value: '' },
    { metric: 'Total UPCs (All Time)', value: data.summary.total_upcs_all },
    { metric: 'New Items (All Time)', value: data.summary.new_items_all },
    { metric: '', value: '' },
    { metric: `📅 LAST ${data.summary.days_filter} DAYS (CLIENT DATA)`, value: '' },
    { metric: 'Active UPCs (Recent)', value: data.summary.total_upcs_recent },
    { metric: 'New Items (Recent)', value: data.summary.new_items_recent },
    { metric: `Items with ${CONFIG.MIN_DOMESTIC_VENDORS}+ Domestic Vendors`, value: data.summary.qualified_count },
    { metric: '', value: '' },
    { metric: 'Items in Current Inventory', value: data.summary.inventory_count }
  ]);
  
  // Priority Items Sheet (3+ Domestic, Recent Only)
  const prioritySheet = workbook.addWorksheet(`${CONFIG.MIN_DOMESTIC_VENDORS}+ Vendors (${CONFIG.DAYS_FILTER} Days)`);
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
  
  data.qualified3PlusRecent.forEach((item, idx) => {
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
  
  // All Recent New Items Sheet
  const allRecentSheet = workbook.addWorksheet(`All New Items (${CONFIG.DAYS_FILTER} Days)`);
  allRecentSheet.columns = [
    { header: 'UPC', key: 'upc', width: 15 },
    { header: 'Item Name', key: 'item_name', width: 60 },
    { header: 'Brand', key: 'brand', width: 20 },
    { header: 'Domestic Vendors', key: 'domestic_count', width: 18 },
    { header: 'Total Vendors', key: 'total_count', width: 15 },
    { header: 'Min Price (Dom)', key: 'min_price', width: 15 },
    { header: 'Avg Price (Dom)', key: 'avg_price', width: 15 }
  ];
  
  data.newItemsRecent.forEach(item => {
    allRecentSheet.addRow({
      upc: item.upc,
      item_name: item.item_name,
      brand: item.brand,
      domestic_count: item.domestic_vendor_count,
      total_count: item.total_vendor_count,
      min_price: item.min_price_domestic,
      avg_price: item.avg_price_domestic
    });
  });
  
  // Vendor Analysis Sheet
  const vendorSheet = workbook.addWorksheet('Vendor Analysis');
  vendorSheet.columns = [
    { header: 'Vendor', key: 'vendor', width: 25 },
    { header: 'Location', key: 'location', width: 15 },
    { header: 'Last Submission', key: 'last_date', width: 15 },
    { header: 'Days Ago', key: 'days_ago', width: 12 },
    { header: 'Total Items', key: 'items', width: 12 }
  ];
  
  Array.from(data.vendorHistory.entries())
    .sort((a, b) => new Date(b[1].lastDate) - new Date(a[1].lastDate))
    .forEach(([vendor, info]) => {
      const daysSince = Math.floor((new Date() - new Date(info.lastDate)) / (1000 * 60 * 60 * 24));
      vendorSheet.addRow({
        vendor: vendor,
        location: info.location,
        last_date: info.lastDate,
        days_ago: daysSince,
        items: info.upcs.size
      });
    });
  
  // Format all sheets
  [summarySheet, prioritySheet, allRecentSheet, vendorSheet].forEach(sheet => {
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4CAF50' }
    };
    sheet.getRow(1).alignment = { horizontal: 'center' };
  });
  
  // Highlight summary section headers
  [4, 8].forEach(rowNum => {
    summarySheet.getRow(rowNum).font = { bold: true };
    summarySheet.getRow(rowNum).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE3F2FD' }
    };
  });
  
  // Save files
  const excelFile = `New_Items_Report_${timestamp}_${CONFIG.DAYS_FILTER}days.xlsx`;
  await workbook.xlsx.writeFile(excelFile);
  console.log(`  ✓ Excel saved: ${excelFile}`);
  
  // Create CSV for priority items
  const csvContent = [
    ['Priority', 'UPC', 'Item Name', 'Brand', 'Vendors', 'Vendor List', 'Min Price', 'Avg Price'],
    ...data.qualified3PlusRecent.map((item, idx) => [
      idx + 1,
      item.upc,
      `"${item.item_name}"`,
      item.brand,
      item.domestic_vendor_count,
      `"${item.domestic_vendors.join('; ')}"`,
      item.min_price_domestic,
      item.avg_price_domestic
    ])
  ].map(row => row.join(',')).join('\n');
  
  const csvFile = `Priority_Items_${timestamp}_${CONFIG.DAYS_FILTER}days.csv`;
  fs.writeFileSync(csvFile, csvContent);
  console.log(`  ✓ CSV saved: ${csvFile}`);
  
  return { excelFile, csvFile };
}

// Main execution
async function main() {
  try {
    console.log('🎯 NEW ITEMS WATCHLIST SYSTEM V2');
    console.log('=================================');
    console.log(`Configuration:`);
    console.log(`  • Days filter for client: ${CONFIG.DAYS_FILTER} days`);
    console.log(`  • Min domestic vendors: ${CONFIG.MIN_DOMESTIC_VENDORS}`);
    
    const results = await analyzeNewItems();
    const files = await generateExcelReport(results);
    
    console.log('\n✅ COMPLETE!');
    console.log(`   Files created:`);
    console.log(`   • ${files.excelFile}`);
    console.log(`   • ${files.csvFile}`);
    
  } catch (error) {
    console.error('Failed:', error.message);
  }
}

main();