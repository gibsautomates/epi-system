const { createClient } = require('@supabase/supabase-js');
const ExcelJS = require('exceljs');
const fs = require('fs');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Fetch all records with pagination
async function fetchAllRecords(table, select = '*', filters = {}) {
  let allData = [];
  let rangeStart = 0;
  const rangeSize = 1000;
  let hasMore = true;
  
  while (hasMore) {
    let query = supabase
      .from(table)
      .select(select)
      .range(rangeStart, rangeStart + rangeSize - 1);
    
    // Apply filters if provided
    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value);
    });
    
    const { data, error } = await query;
    
    if (error) {
      console.error(`Error fetching ${table}:`, error);
      break;
    }
    
    if (data && data.length > 0) {
      allData = allData.concat(data);
      rangeStart += rangeSize;
      hasMore = data.length === rangeSize;
    } else {
      hasMore = false;
    }
  }
  
  return allData;
}

async function analyzeNewItems() {
  console.log('Starting New Items Analysis...');
  console.log('===============================\n');
  
  try {
    // Fetch all data
    console.log('Fetching all vendor offers...');
    const vendorOffers = await fetchAllRecords('vendor_offers');
    console.log(`✓ Fetched ${vendorOffers.length} vendor offers`);
    
    console.log('Fetching current inventory...');
    const currentInventory = await fetchAllRecords('current_inventory');
    console.log(`✓ Fetched ${currentInventory.length} inventory items`);
    
    console.log('Fetching existing watchlist...');
    const existingWatchlist = await fetchAllRecords('watchlist_items');
    console.log(`✓ Fetched ${existingWatchlist.length} watchlist entries\n`);
    
    // Create inventory UPC set
    const inventoryUPCs = new Set(
      currentInventory.map(item => String(item.UPC || item.upc_text).trim())
    );
    
    // Group vendor offers by UPC
    const upcAnalysis = new Map();
    
    vendorOffers.forEach(offer => {
      const upcKey = String(offer.upc || offer.upc_text).trim();
      
      if (!upcAnalysis.has(upcKey)) {
        upcAnalysis.set(upcKey, {
          upc: upcKey,
          item_name: offer.item_name,
          brand: offer.brand,
          is_in_inventory: inventoryUPCs.has(upcKey),
          vendors: new Map(),
          domestic_vendors: new Set(),
          international_vendors: new Set(),
          price_history: [],
          latest_date: offer.date,
          first_seen: offer.date
        });
      }
      
      const item = upcAnalysis.get(upcKey);
      
      // Track vendor details
      const vendorKey = offer.vendor;
      if (!item.vendors.has(vendorKey)) {
        item.vendors.set(vendorKey, {
          name: offer.vendor,
          location: offer.location,
          prices: [],
          quantities: [],
          dates: []
        });
      }
      
      const vendorData = item.vendors.get(vendorKey);
      vendorData.prices.push(offer.price);
      vendorData.quantities.push(offer.qty || 0);
      vendorData.dates.push(offer.date);
      
      // Track by location
      if (offer.location === 'Domestic') {
        item.domestic_vendors.add(offer.vendor);
      } else {
        item.international_vendors.add(offer.vendor);
      }
      
      // Update dates
      if (offer.date > item.latest_date) {
        item.latest_date = offer.date;
      }
      if (offer.date < item.first_seen) {
        item.first_seen = offer.date;
      }
    });
    
    // Analyze and categorize items
    const newItems = [];
    const itemsFor3PlusDomestic = [];
    const graduatedItems = []; // Items now in inventory
    
    upcAnalysis.forEach((item, upc) => {
      // Calculate aggregated metrics
      const domesticVendorList = Array.from(item.domestic_vendors);
      const allVendorList = Array.from(item.vendors.keys());
      
      // Get prices from domestic vendors only
      const domesticPrices = [];
      item.vendors.forEach((vendor, vendorName) => {
        if (vendor.location === 'Domestic' && vendor.prices.length > 0) {
          domesticPrices.push(...vendor.prices.filter(p => p > 0));
        }
      });
      
      const analysisResult = {
        upc: item.upc,
        item_name: item.item_name,
        brand: item.brand || 'N/A',
        is_new_item: !item.is_in_inventory,
        domestic_vendor_count: domesticVendorList.length,
        total_vendor_count: allVendorList.length,
        domestic_vendors: domesticVendorList,
        all_vendors: allVendorList,
        min_price_domestic: domesticPrices.length > 0 ? Math.min(...domesticPrices) : null,
        avg_price_domestic: domesticPrices.length > 0 
          ? (domesticPrices.reduce((a, b) => a + b, 0) / domesticPrices.length).toFixed(2) 
          : null,
        max_price_domestic: domesticPrices.length > 0 ? Math.max(...domesticPrices) : null,
        first_seen: item.first_seen,
        latest_date: item.latest_date,
        vendor_details: Object.fromEntries(item.vendors)
      };
      
      if (!item.is_in_inventory) {
        newItems.push(analysisResult);
        
        if (analysisResult.domestic_vendor_count >= 3) {
          itemsFor3PlusDomestic.push(analysisResult);
        }
      } else {
        // Check if this was previously on watchlist
        const wasWatched = existingWatchlist.some(w => 
          String(w.upc).trim() === upc && w.status === 'WATCHING'
        );
        
        if (wasWatched) {
          graduatedItems.push(analysisResult);
        }
      }
    });
    
    // Sort by priority (domestic vendor count, then by price)
    itemsFor3PlusDomestic.sort((a, b) => {
      if (b.domestic_vendor_count !== a.domestic_vendor_count) {
        return b.domestic_vendor_count - a.domestic_vendor_count;
      }
      return (a.min_price_domestic || 999999) - (b.min_price_domestic || 999999);
    });
    
    // Display summary
    console.log('ANALYSIS RESULTS');
    console.log('================');
    console.log(`Total unique UPCs in vendor offers: ${upcAnalysis.size}`);
    console.log(`Items in current inventory: ${inventoryUPCs.size}`);
    console.log(`NEW ITEMS identified: ${newItems.length}`);
    console.log(`New items with 3+ domestic vendors: ${itemsFor3PlusDomestic.length}`);
    console.log(`Graduated items (now in inventory): ${graduatedItems.length}\n`);
    
    // Show top opportunities
    if (itemsFor3PlusDomestic.length > 0) {
      console.log('TOP 5 OPPORTUNITIES (3+ Domestic Vendors)');
      console.log('==========================================');
      itemsFor3PlusDomestic.slice(0, 5).forEach((item, idx) => {
        console.log(`\n${idx + 1}. ${item.item_name}`);
        console.log(`   UPC: ${item.upc}`);
        console.log(`   Brand: ${item.brand}`);
        console.log(`   Vendors: ${item.domestic_vendors.join(', ')} (${item.domestic_vendor_count} domestic)`);
        console.log(`   Price Range: $${item.min_price_domestic} - $${item.max_price_domestic} (Avg: $${item.avg_price_domestic})`);
      });
    }
    
    return {
      newItems,
      itemsFor3PlusDomestic,
      graduatedItems,
      summary: {
        total_upcs: upcAnalysis.size,
        inventory_count: inventoryUPCs.size,
        new_items_count: newItems.length,
        qualified_items_count: itemsFor3PlusDomestic.length,
        graduated_count: graduatedItems.length
      }
    };
    
  } catch (error) {
    console.error('Error in analysis:', error);
    throw error;
  }
}

async function generateExcelReport(analysisResults) {
  console.log('\nGenerating Excel Report...');
  
  const workbook = new ExcelJS.Workbook();
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  
  // Sheet 1: Summary
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [
    { header: 'Metric', key: 'metric', width: 30 },
    { header: 'Value', key: 'value', width: 15 }
  ];
  
  summarySheet.addRows([
    { metric: 'Report Generated', value: new Date().toLocaleString() },
    { metric: 'Total Unique UPCs', value: analysisResults.summary.total_upcs },
    { metric: 'Items in Inventory', value: analysisResults.summary.inventory_count },
    { metric: 'New Items Found', value: analysisResults.summary.new_items_count },
    { metric: 'Items with 3+ Domestic Vendors', value: analysisResults.summary.qualified_items_count },
    { metric: 'Graduated to Inventory', value: analysisResults.summary.graduated_count }
  ]);
  
  // Sheet 2: Items with 3+ Domestic Vendors (Priority)
  const prioritySheet = workbook.addWorksheet('3+ Domestic Vendors');
  prioritySheet.columns = [
    { header: 'UPC', key: 'upc', width: 15 },
    { header: 'Item Name', key: 'item_name', width: 50 },
    { header: 'Brand', key: 'brand', width: 20 },
    { header: 'Domestic Vendors', key: 'domestic_vendor_count', width: 15 },
    { header: 'Vendor List', key: 'vendor_list', width: 50 },
    { header: 'Min Price', key: 'min_price', width: 12 },
    { header: 'Avg Price', key: 'avg_price', width: 12 },
    { header: 'Max Price', key: 'max_price', width: 12 },
    { header: 'First Seen', key: 'first_seen', width: 12 },
    { header: 'Last Updated', key: 'latest_date', width: 12 }
  ];
  
  analysisResults.itemsFor3PlusDomestic.forEach(item => {
    prioritySheet.addRow({
      upc: item.upc,
      item_name: item.item_name,
      brand: item.brand,
      domestic_vendor_count: item.domestic_vendor_count,
      vendor_list: item.domestic_vendors.join(', '),
      min_price: item.min_price_domestic,
      avg_price: item.avg_price_domestic,
      max_price: item.max_price_domestic,
      first_seen: item.first_seen,
      latest_date: item.latest_date
    });
  });
  
  // Format headers
  [summarySheet, prioritySheet].forEach(sheet => {
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
  });
  
  // Sheet 3: All New Items
  const allItemsSheet = workbook.addWorksheet('All New Items');
  allItemsSheet.columns = prioritySheet.columns; // Same structure
  
  analysisResults.newItems.forEach(item => {
    allItemsSheet.addRow({
      upc: item.upc,
      item_name: item.item_name,
      brand: item.brand,
      domestic_vendor_count: item.domestic_vendor_count,
      vendor_list: item.all_vendors.join(', '),
      min_price: item.min_price_domestic,
      avg_price: item.avg_price_domestic,
      max_price: item.max_price_domestic,
      first_seen: item.first_seen,
      latest_date: item.latest_date
    });
  });
  
  allItemsSheet.getRow(1).font = { bold: true };
  allItemsSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };
  
  // Save the file
  const filename = `new_items_report_${timestamp}.xlsx`;
  await workbook.xlsx.writeFile(filename);
  
  console.log(`✓ Excel report saved as: ${filename}`);
  
  // Also save as CSV for the priority items
  const csvContent = [
    ['UPC', 'Item Name', 'Brand', 'Domestic Vendors', 'Vendor List', 'Min Price', 'Avg Price'],
    ...analysisResults.itemsFor3PlusDomestic.map(item => [
      item.upc,
      item.item_name,
      item.brand,
      item.domestic_vendor_count,
      item.domestic_vendors.join('; '),
      item.min_price_domestic,
      item.avg_price_domestic
    ])
  ].map(row => row.join(',')).join('\n');
  
  const csvFilename = `priority_items_${timestamp}.csv`;
  fs.writeFileSync(csvFilename, csvContent);
  console.log(`✓ CSV report saved as: ${csvFilename}`);
  
  return { excelFile: filename, csvFile: csvFilename };
}

// Main execution
async function main() {
  try {
    console.log('NEW ITEMS WATCHLIST SYSTEM');
    console.log('===========================\n');
    
    const results = await analyzeNewItems();
    const files = await generateExcelReport(results);
    
    console.log('\n✅ PROCESS COMPLETE!');
    console.log('Reports generated:', files);
    
  } catch (error) {
    console.error('Error in main process:', error);
  }
}

// Check if exceljs is installed
try {
  require('exceljs');
  main();
} catch (e) {
  console.log('Installing required package: exceljs...');
  require('child_process').execSync('npm install exceljs', { stdio: 'inherit' });
  console.log('Package installed. Please run the script again.');
}