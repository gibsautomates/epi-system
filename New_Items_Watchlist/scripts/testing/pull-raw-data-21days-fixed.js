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
    
    // First get the count
    const { count: totalCount, error: countError } = await supabase
      .from('vendor_offers')
      .select('*', { count: 'exact', head: true })
      .gte('date', cutoffDateStr);
    
    if (countError) {
      console.error('Count error:', countError);
    } else {
      console.log(`Total records to fetch: ${totalCount}`);
    }
    
    // Step 1: Get ALL vendor_offers from last 21 days
    console.log('\nStep 1: Fetching all vendor_offers from last 21 days...');
    let allOffers = [];
    let offset = 0;
    const batchSize = 5000; // Smaller batch size
    
    while (offset < (totalCount || 999999)) {
      const { data, error } = await supabase
        .from('vendor_offers')
        .select('*')
        .gte('date', cutoffDateStr)
        .range(offset, offset + batchSize - 1);
      
      if (error) {
        console.error('Fetch error:', error);
        break;
      }
      
      if (data && data.length > 0) {
        allOffers = allOffers.concat(data);
        process.stdout.write(`  Fetched: ${allOffers.length}/${totalCount} records\r`);
        offset += data.length;
        
        // Break if we got less than batch size (means we're done)
        if (data.length < batchSize) {
          break;
        }
      } else {
        break;
      }
    }
    
    console.log(`\n  ✓ Total vendor_offers fetched: ${allOffers.length}\n`);
    
    // Step 2: Get current inventory for comparison
    console.log('Step 2: Fetching current_inventory...');
    let allInventory = [];
    offset = 0;
    
    while (true) {
      const { data, error } = await supabase
        .from('current_inventory')
        .select('UPC, upc_text, ProductName')
        .range(offset, offset + batchSize - 1);
      
      if (error) {
        console.error('Inventory error:', error);
        break;
      }
      
      if (data && data.length > 0) {
        allInventory = allInventory.concat(data);
        offset += data.length;
        if (data.length < batchSize) break;
      } else {
        break;
      }
    }
    
    const inventoryUPCs = new Set(
      allInventory.map(item => String(item.UPC || item.upc_text).trim())
    );
    console.log(`  ✓ Inventory items: ${inventoryUPCs.size}\n`);
    
    // Step 3: Analyze the data
    console.log('Step 3: Analyzing data...');
    
    // Group by UPC
    const upcMap = new Map();
    const vendorStats = new Map();
    const dateStats = new Map();
    
    allOffers.forEach(offer => {
      const upc = String(offer.upc || offer.upc_text).trim();
      
      // Track dates
      if (!dateStats.has(offer.date)) {
        dateStats.set(offer.date, 0);
      }
      dateStats.set(offer.date, dateStats.get(offer.date) + 1);
      
      // Track vendor stats
      if (!vendorStats.has(offer.vendor)) {
        vendorStats.set(offer.vendor, {
          location: offer.location,
          itemCount: new Set(),
          dates: new Set(),
          recordCount: 0
        });
      }
      vendorStats.get(offer.vendor).itemCount.add(upc);
      vendorStats.get(offer.vendor).dates.add(offer.date);
      vendorStats.get(offer.vendor).recordCount++;
      
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
          is_in_inventory: inventoryUPCs.has(upc),
          allPrices: []
        });
      }
      
      const item = upcMap.get(upc);
      item.dates.add(offer.date);
      
      if (offer.price > 0) {
        item.allPrices.push(offer.price);
      }
      
      // Update item name if longer
      if (offer.item_name && offer.item_name.length > (item.item_name || '').length) {
        item.item_name = offer.item_name;
      }
      
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
    console.log(`Date range in data: ${Array.from(dateStats.keys()).sort()[0]} to ${Array.from(dateStats.keys()).sort().pop()}`);
    console.log(`\nNEW ITEMS (not in inventory):`);
    console.log(`  Total new items: ${newItems.length}`);
    console.log(`  With 1+ domestic vendors: ${newItems.filter(i => i.domestic_vendors.size >= 1).length}`);
    console.log(`  With 2+ domestic vendors: ${newItems.filter(i => i.domestic_vendors.size >= 2).length}`);
    console.log(`  With 3+ domestic vendors: ${newItems3Plus.length}`);
    console.log(`  With 4+ domestic vendors: ${newItems.filter(i => i.domestic_vendors.size >= 4).length}`);
    console.log(`  With 5+ domestic vendors: ${newItems.filter(i => i.domestic_vendors.size >= 5).length}`);
    
    // Show vendor breakdown
    console.log(`\nVENDOR BREAKDOWN:`);
    const domesticVendors = Array.from(vendorStats.entries())
      .filter(([_, stats]) => stats.location === 'Domestic')
      .sort((a, b) => b[1].recordCount - a[1].recordCount);
    
    console.log(`Domestic vendors (${domesticVendors.length}):`);
    domesticVendors.forEach(([vendor, stats]) => {
      console.log(`  ${vendor}: ${stats.itemCount.size} unique items, ${stats.recordCount} records`);
    });
    
    // Show date breakdown
    console.log(`\nRECORDS BY DATE (last 7 dates):`);
    Array.from(dateStats.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 7)
      .forEach(([date, count]) => {
        console.log(`  ${date}: ${count} records`);
      });
    
    // Show top new items with 3+ vendors
    if (newItems3Plus.length > 0) {
      console.log(`\nTOP NEW ITEMS WITH 3+ DOMESTIC VENDORS:`);
      newItems3Plus
        .sort((a, b) => b.domestic_vendors.size - a.domestic_vendors.size)
        .slice(0, 10)
        .forEach((item, idx) => {
          const minPrice = Math.min(...item.allPrices.filter(p => p > 0));
          const avgPrice = (item.allPrices.filter(p => p > 0).reduce((a, b) => a + b, 0) / item.allPrices.filter(p => p > 0).length).toFixed(2);
          console.log(`${idx + 1}. ${item.item_name || 'Unknown'}`);
          console.log(`   UPC: ${item.upc}`);
          console.log(`   Vendors: ${item.domestic_vendors.size} domestic (${Array.from(item.domestic_vendors).slice(0, 5).join(', ')}${item.domestic_vendors.size > 5 ? '...' : ''})`);
          console.log(`   Price: $${minPrice} (avg: $${avgPrice})`);
        });
    }
    
    // Create detailed Excel report
    console.log('\n📝 Generating detailed Excel report...');
    const workbook = new ExcelJS.Workbook();
    
    // Sheet 1: Statistics
    const statsSheet = workbook.addWorksheet('Statistics');
    statsSheet.columns = [
      { header: 'Metric', key: 'metric', width: 40 },
      { header: 'Value', key: 'value', width: 20 }
    ];
    
    statsSheet.addRows([
      { metric: 'Report Generated', value: new Date().toLocaleString() },
      { metric: 'Date Range Start', value: cutoffDateStr },
      { metric: 'Date Range End', value: new Date().toISOString().split('T')[0] },
      { metric: 'Days Included', value: '21' },
      { metric: '', value: '' },
      { metric: 'TOTALS', value: '' },
      { metric: 'Total Records (21 days)', value: allOffers.length },
      { metric: 'Unique UPCs (all)', value: upcMap.size },
      { metric: 'Unique Vendors', value: vendorStats.size },
      { metric: 'Domestic Vendors', value: domesticVendors.length },
      { metric: '', value: '' },
      { metric: 'INVENTORY', value: '' },
      { metric: 'Items in Current Inventory', value: inventoryUPCs.size },
      { metric: '', value: '' },
      { metric: 'NEW ITEMS BREAKDOWN', value: '' },
      { metric: 'Total New Items', value: newItems.length },
      { metric: 'With 1+ Domestic Vendors', value: newItems.filter(i => i.domestic_vendors.size >= 1).length },
      { metric: 'With 2+ Domestic Vendors', value: newItems.filter(i => i.domestic_vendors.size >= 2).length },
      { metric: 'With 3+ Domestic Vendors', value: newItems3Plus.length },
      { metric: 'With 4+ Domestic Vendors', value: newItems.filter(i => i.domestic_vendors.size >= 4).length },
      { metric: 'With 5+ Domestic Vendors', value: newItems.filter(i => i.domestic_vendors.size >= 5).length },
      { metric: 'With 10+ Domestic Vendors', value: newItems.filter(i => i.domestic_vendors.size >= 10).length }
    ]);
    
    // Sheet 2: 3+ Domestic Vendors (Priority)
    const qualifiedSheet = workbook.addWorksheet('3+ Domestic (Priority)');
    qualifiedSheet.columns = [
      { header: 'Rank', key: 'rank', width: 8 },
      { header: 'UPC', key: 'upc', width: 15 },
      { header: 'Item Name', key: 'item_name', width: 50 },
      { header: 'Brand', key: 'brand', width: 20 },
      { header: '# Domestic', key: 'domestic_count', width: 12 },
      { header: '# Total', key: 'total_vendors', width: 10 },
      { header: 'Domestic Vendors', key: 'domestic_names', width: 60 },
      { header: 'Min Price', key: 'min_price', width: 10 },
      { header: 'Avg Price', key: 'avg_price', width: 10 },
      { header: 'Max Price', key: 'max_price', width: 10 }
    ];
    
    newItems3Plus
      .sort((a, b) => b.domestic_vendors.size - a.domestic_vendors.size)
      .forEach((item, idx) => {
        const prices = item.allPrices.filter(p => p > 0);
        qualifiedSheet.addRow({
          rank: idx + 1,
          upc: item.upc,
          item_name: item.item_name || 'Unknown',
          brand: item.brand || 'N/A',
          domestic_count: item.domestic_vendors.size,
          total_vendors: item.vendors.size,
          domestic_names: Array.from(item.domestic_vendors).sort().join(', '),
          min_price: prices.length ? Math.min(...prices) : null,
          avg_price: prices.length ? (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2) : null,
          max_price: prices.length ? Math.max(...prices) : null
        });
      });
    
    // Sheet 3: All New Items
    const newItemsSheet = workbook.addWorksheet('All New Items');
    newItemsSheet.columns = [
      { header: 'UPC', key: 'upc', width: 15 },
      { header: 'Item Name', key: 'item_name', width: 50 },
      { header: 'Brand', key: 'brand', width: 20 },
      { header: '# Domestic', key: 'domestic_count', width: 12 },
      { header: '# Intl', key: 'intl_count', width: 10 },
      { header: 'Domestic Vendors', key: 'domestic_names', width: 60 }
    ];
    
    newItems
      .sort((a, b) => b.domestic_vendors.size - a.domestic_vendors.size)
      .forEach(item => {
        newItemsSheet.addRow({
          upc: item.upc,
          item_name: item.item_name || 'Unknown',
          brand: item.brand || 'N/A',
          domestic_count: item.domestic_vendors.size,
          intl_count: item.international_vendors.size,
          domestic_names: Array.from(item.domestic_vendors).sort().join(', ')
        });
      });
    
    // Sheet 4: Vendor Summary
    const vendorSheet = workbook.addWorksheet('Vendor Summary');
    vendorSheet.columns = [
      { header: 'Vendor', key: 'vendor', width: 25 },
      { header: 'Location', key: 'location', width: 15 },
      { header: 'Records', key: 'records', width: 10 },
      { header: 'Unique Items', key: 'items', width: 15 },
      { header: 'Dates Active', key: 'dates', width: 40 }
    ];
    
    Array.from(vendorStats.entries())
      .sort((a, b) => b[1].recordCount - a[1].recordCount)
      .forEach(([vendor, stats]) => {
        vendorSheet.addRow({
          vendor: vendor,
          location: stats.location,
          records: stats.recordCount,
          items: stats.itemCount.size,
          dates: Array.from(stats.dates).sort().join(', ')
        });
      });
    
    // Format headers
    [statsSheet, qualifiedSheet, newItemsSheet, vendorSheet].forEach(sheet => {
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4CAF50' }
      };
    });
    
    // Highlight section headers in stats sheet
    [6, 12, 15].forEach(row => {
      statsSheet.getRow(row).font = { bold: true };
      statsSheet.getRow(row).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE3F2FD' }
      };
    });
    
    // Save file
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `output/Raw_Data_Analysis_21days_${timestamp}.xlsx`;
    await workbook.xlsx.writeFile(filename);
    console.log(`  ✓ Saved: ${filename}`);
    
    // Also create a simple CSV of the qualified items
    const csvContent = [
      ['Rank', 'UPC', 'Item Name', 'Brand', 'Domestic Vendors', 'Vendor Names', 'Min Price', 'Avg Price'],
      ...newItems3Plus
        .sort((a, b) => b.domestic_vendors.size - a.domestic_vendors.size)
        .map((item, idx) => {
          const prices = item.allPrices.filter(p => p > 0);
          return [
            idx + 1,
            item.upc,
            `"${item.item_name || 'Unknown'}"`,
            item.brand || 'N/A',
            item.domestic_vendors.size,
            `"${Array.from(item.domestic_vendors).sort().join(', ')}"`,
            prices.length ? Math.min(...prices) : '',
            prices.length ? (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2) : ''
          ];
        })
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