const { createClient } = require('@supabase/supabase-js');
const ExcelJS = require('exceljs');
const fs = require('fs');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function pullRawData21Days() {
  console.log('📊 PULLING RAW DATA FROM LAST 21 DAYS FOR VERIFICATION');
  console.log('======================================================\n');
  
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 21);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
    
    console.log(`Date range: ${cutoffDateStr} to ${new Date().toISOString().split('T')[0]}`);
    console.log(`Cutoff date: ${cutoffDateStr}\n`);
    
    // Step 1: Get ALL vendor_offers from last 21 days
    console.log('Step 1: Fetching all vendor_offers from last 21 days...');
    let allOffers = [];
    let offset = 0;
    const batchSize = 10000;
    let hasMore = true;
    
    while (hasMore) {
      const { data, error } = await supabase
        .from('vendor_offers')
        .select('*')
        .gte('date', cutoffDateStr)
        .range(offset, offset + batchSize - 1)
        .order('date', { ascending: false });
      
      if (error) {
        console.error('Error:', error);
        break;
      }
      
      if (data && data.length > 0) {
        allOffers = allOffers.concat(data);
        offset += batchSize;
        hasMore = data.length === batchSize;
        process.stdout.write(`  Fetched: ${allOffers.length} records\r`);
      } else {
        hasMore = false;
      }
    }
    
    console.log(`\n  ✓ Total vendor_offers fetched: ${allOffers.length}\n`);
    
    // Step 2: Get current inventory for comparison
    console.log('Step 2: Fetching current_inventory...');
    const { data: inventory } = await supabase
      .from('current_inventory')
      .select('UPC, upc_text, ProductName');
    
    const inventoryUPCs = new Set(
      inventory.map(item => String(item.UPC || item.upc_text).trim())
    );
    console.log(`  ✓ Inventory items: ${inventoryUPCs.size}\n`);
    
    // Step 3: Analyze the data
    console.log('Step 3: Analyzing data...');
    
    // Group by UPC
    const upcMap = new Map();
    const vendorStats = new Map();
    
    allOffers.forEach(offer => {
      const upc = String(offer.upc || offer.upc_text).trim();
      
      // Track vendor stats
      if (!vendorStats.has(offer.vendor)) {
        vendorStats.set(offer.vendor, {
          location: offer.location,
          itemCount: new Set(),
          dates: new Set()
        });
      }
      vendorStats.get(offer.vendor).itemCount.add(upc);
      vendorStats.get(offer.vendor).dates.add(offer.date);
      
      // Track UPC data
      if (!upcMap.has(upc)) {
        upcMap.set(upc, {
          upc: upc,
          item_name: offer.item_name,
          brand: offer.brand,
          vendors: new Map(),
          domestic_vendors: new Set(),
          international_vendors: new Set(),
          dates: new Set(),
          is_in_inventory: inventoryUPCs.has(upc)
        });
      }
      
      const item = upcMap.get(upc);
      item.dates.add(offer.date);
      
      // Track vendor details
      if (!item.vendors.has(offer.vendor)) {
        item.vendors.set(offer.vendor, {
          location: offer.location,
          prices: [],
          dates: new Set()
        });
      }
      
      item.vendors.get(offer.vendor).prices.push(offer.price);
      item.vendors.get(offer.vendor).dates.add(offer.date);
      
      if (offer.location === 'Domestic') {
        item.domestic_vendors.add(offer.vendor);
      } else if (offer.location === 'International') {
        item.international_vendors.add(offer.vendor);
      }
    });
    
    // Calculate statistics
    const newItems = Array.from(upcMap.values()).filter(item => !item.is_in_inventory);
    const newItems3Plus = newItems.filter(item => item.domestic_vendors.size >= 3);
    
    console.log(`  ✓ Analysis complete\n`);
    
    // Display summary
    console.log('📈 SUMMARY');
    console.log('==========');
    console.log(`Total records in last 21 days: ${allOffers.length}`);
    console.log(`Unique UPCs: ${upcMap.size}`);
    console.log(`Unique vendors: ${vendorStats.size}`);
    console.log(`\nNEW ITEMS (not in inventory):`);
    console.log(`  Total new items: ${newItems.length}`);
    console.log(`  With 3+ domestic vendors: ${newItems3Plus.length}`);
    
    // Show vendor breakdown
    console.log(`\nVENDOR BREAKDOWN:`);
    const domesticVendors = Array.from(vendorStats.entries())
      .filter(([_, stats]) => stats.location === 'Domestic')
      .sort((a, b) => b[1].itemCount.size - a[1].itemCount.size);
    
    console.log(`Domestic vendors (${domesticVendors.length}):`);
    domesticVendors.slice(0, 10).forEach(([vendor, stats]) => {
      console.log(`  ${vendor}: ${stats.itemCount.size} items`);
    });
    
    // Create detailed Excel report
    console.log('\n📝 Generating detailed Excel report...');
    const workbook = new ExcelJS.Workbook();
    
    // Sheet 1: Raw Data Sample
    const rawSheet = workbook.addWorksheet('Raw Data (First 1000)');
    rawSheet.columns = Object.keys(allOffers[0] || {}).map(key => ({
      header: key,
      key: key,
      width: 15
    }));
    allOffers.slice(0, 1000).forEach(row => rawSheet.addRow(row));
    
    // Sheet 2: UPC Analysis
    const analysisSheet = workbook.addWorksheet('UPC Analysis');
    analysisSheet.columns = [
      { header: 'UPC', key: 'upc', width: 15 },
      { header: 'Item Name', key: 'item_name', width: 50 },
      { header: 'Brand', key: 'brand', width: 20 },
      { header: 'In Inventory', key: 'in_inventory', width: 12 },
      { header: 'Domestic Vendors', key: 'domestic_count', width: 18 },
      { header: 'International Vendors', key: 'intl_count', width: 20 },
      { header: 'Total Vendors', key: 'total_vendors', width: 15 },
      { header: 'Domestic Vendor Names', key: 'domestic_names', width: 60 },
      { header: 'Dates Seen', key: 'dates', width: 30 }
    ];
    
    Array.from(upcMap.values()).forEach(item => {
      analysisSheet.addRow({
        upc: item.upc,
        item_name: item.item_name,
        brand: item.brand || 'N/A',
        in_inventory: item.is_in_inventory ? 'YES' : 'NO',
        domestic_count: item.domestic_vendors.size,
        intl_count: item.international_vendors.size,
        total_vendors: item.vendors.size,
        domestic_names: Array.from(item.domestic_vendors).join(', '),
        dates: Array.from(item.dates).sort().join(', ')
      });
    });
    
    // Sheet 3: New Items Only
    const newItemsSheet = workbook.addWorksheet('New Items Only');
    newItemsSheet.columns = analysisSheet.columns;
    
    newItems.forEach(item => {
      newItemsSheet.addRow({
        upc: item.upc,
        item_name: item.item_name,
        brand: item.brand || 'N/A',
        in_inventory: 'NO',
        domestic_count: item.domestic_vendors.size,
        intl_count: item.international_vendors.size,
        total_vendors: item.vendors.size,
        domestic_names: Array.from(item.domestic_vendors).join(', '),
        dates: Array.from(item.dates).sort().join(', ')
      });
    });
    
    // Sheet 4: 3+ Domestic Vendors
    const qualifiedSheet = workbook.addWorksheet('3+ Domestic Vendors');
    qualifiedSheet.columns = analysisSheet.columns;
    
    newItems3Plus
      .sort((a, b) => b.domestic_vendors.size - a.domestic_vendors.size)
      .forEach(item => {
        qualifiedSheet.addRow({
          upc: item.upc,
          item_name: item.item_name,
          brand: item.brand || 'N/A',
          in_inventory: 'NO',
          domestic_count: item.domestic_vendors.size,
          intl_count: item.international_vendors.size,
          total_vendors: item.vendors.size,
          domestic_names: Array.from(item.domestic_vendors).join(', '),
          dates: Array.from(item.dates).sort().join(', ')
        });
      });
    
    // Sheet 5: Statistics
    const statsSheet = workbook.addWorksheet('Statistics');
    statsSheet.columns = [
      { header: 'Metric', key: 'metric', width: 40 },
      { header: 'Value', key: 'value', width: 20 }
    ];
    
    statsSheet.addRows([
      { metric: 'Date Range Start', value: cutoffDateStr },
      { metric: 'Date Range End', value: new Date().toISOString().split('T')[0] },
      { metric: 'Total Records (21 days)', value: allOffers.length },
      { metric: 'Unique UPCs', value: upcMap.size },
      { metric: 'Unique Vendors', value: vendorStats.size },
      { metric: 'Items in Current Inventory', value: inventoryUPCs.size },
      { metric: 'New Items (not in inventory)', value: newItems.length },
      { metric: 'New Items with 1+ Domestic', value: newItems.filter(i => i.domestic_vendors.size >= 1).length },
      { metric: 'New Items with 2+ Domestic', value: newItems.filter(i => i.domestic_vendors.size >= 2).length },
      { metric: 'New Items with 3+ Domestic', value: newItems3Plus.length },
      { metric: 'New Items with 4+ Domestic', value: newItems.filter(i => i.domestic_vendors.size >= 4).length },
      { metric: 'New Items with 5+ Domestic', value: newItems.filter(i => i.domestic_vendors.size >= 5).length }
    ]);
    
    // Format headers
    [rawSheet, analysisSheet, newItemsSheet, qualifiedSheet, statsSheet].forEach(sheet => {
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
    });
    
    // Save file
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `output/Raw_Data_Analysis_21days_${timestamp}.xlsx`;
    await workbook.xlsx.writeFile(filename);
    console.log(`  ✓ Saved: ${filename}`);
    
    // Also create a simple CSV of the qualified items
    const csvContent = [
      ['UPC', 'Item Name', 'Brand', 'Domestic Vendors', 'Vendor Names'],
      ...newItems3Plus.map(item => [
        item.upc,
        `"${item.item_name}"`,
        item.brand || 'N/A',
        item.domestic_vendors.size,
        `"${Array.from(item.domestic_vendors).join(', ')}"`
      ])
    ].map(row => row.join(',')).join('\n');
    
    const csvFile = `output/Qualified_Items_Raw_${timestamp}.csv`;
    fs.writeFileSync(csvFile, csvContent);
    console.log(`  ✓ Saved: ${csvFile}`);
    
    console.log('\n✅ Complete! Check the output folder for detailed analysis.');
    
    return {
      totalRecords: allOffers.length,
      uniqueUPCs: upcMap.size,
      newItems: newItems.length,
      qualified3Plus: newItems3Plus.length
    };
    
  } catch (error) {
    console.error('Error:', error);
  }
}

pullRawData21Days();