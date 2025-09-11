const { createClient } = require('@supabase/supabase-js');
const ExcelJS = require('exceljs');
const fs = require('fs');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function pullAllData21Days() {
  console.log('📊 PULLING ALL DATA FROM LAST 21 DAYS');
  console.log('======================================\n');
  
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 21);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
    
    console.log(`📅 Date range: ${cutoffDateStr} to ${new Date().toISOString().split('T')[0]}`);
    
    // Get total count first
    const { count: totalCount } = await supabase
      .from('vendor_offers')
      .select('*', { count: 'exact', head: true })
      .gte('date', cutoffDateStr);
    
    console.log(`📦 Total records to fetch: ${totalCount}\n`);
    
    // Fetch ALL vendor offers in chunks
    console.log('Fetching vendor offers...');
    const allOffers = [];
    const chunkSize = 1000;
    
    for (let offset = 0; offset < totalCount; offset += chunkSize) {
      const { data, error } = await supabase
        .from('vendor_offers')
        .select('*')
        .gte('date', cutoffDateStr)
        .range(offset, Math.min(offset + chunkSize - 1, totalCount - 1));
      
      if (error) {
        console.error('Error at offset', offset, ':', error);
        break;
      }
      
      if (data) {
        allOffers.push(...data);
        process.stdout.write(`  Progress: ${allOffers.length}/${totalCount} (${Math.round(allOffers.length / totalCount * 100)}%)\r`);
      }
    }
    
    console.log(`\n✓ Fetched ${allOffers.length} records\n`);
    
    // Fetch current inventory
    console.log('Fetching current inventory...');
    const inventoryData = [];
    let invOffset = 0;
    
    while (true) {
      const { data, error } = await supabase
        .from('current_inventory')
        .select('UPC, upc_text')
        .range(invOffset, invOffset + chunkSize - 1);
      
      if (error || !data || data.length === 0) break;
      
      inventoryData.push(...data);
      invOffset += data.length;
      
      if (data.length < chunkSize) break;
    }
    
    const inventorySet = new Set(inventoryData.map(i => String(i.UPC || i.upc_text).trim()));
    console.log(`✓ Loaded ${inventorySet.size} inventory UPCs\n`);
    
    // Analyze the data
    console.log('Analyzing data...');
    const upcMap = new Map();
    const vendorSet = new Set();
    const dateSet = new Set();
    
    allOffers.forEach(offer => {
      const upc = String(offer.upc || offer.upc_text).trim();
      vendorSet.add(offer.vendor);
      dateSet.add(offer.date);
      
      if (!upcMap.has(upc)) {
        upcMap.set(upc, {
          upc,
          item_name: offer.item_name,
          brand: offer.brand,
          is_new: !inventorySet.has(upc),
          domestic_vendors: new Set(),
          intl_vendors: new Set(),
          all_vendors: new Set(),
          prices: [],
          dates: new Set()
        });
      }
      
      const item = upcMap.get(upc);
      item.dates.add(offer.date);
      item.all_vendors.add(offer.vendor);
      
      if (offer.price > 0) {
        item.prices.push(offer.price);
      }
      
      if (offer.location === 'Domestic') {
        item.domestic_vendors.add(offer.vendor);
      } else if (offer.location === 'International') {
        item.intl_vendors.add(offer.vendor);
      }
      
      // Update item name to longest version
      if (offer.item_name && offer.item_name.length > (item.item_name || '').length) {
        item.item_name = offer.item_name;
      }
    });
    
    // Calculate results
    const allItems = Array.from(upcMap.values());
    const newItems = allItems.filter(i => i.is_new);
    const qualified = newItems.filter(i => i.domestic_vendors.size >= 3);
    
    // Display results
    console.log('\n📊 RESULTS SUMMARY');
    console.log('==================');
    console.log(`Date range in data: ${Array.from(dateSet).sort()[0]} to ${Array.from(dateSet).sort().pop()}`);
    console.log(`Total records: ${allOffers.length}`);
    console.log(`Unique UPCs: ${upcMap.size}`);
    console.log(`Unique vendors: ${vendorSet.size}`);
    console.log(`\nNEW ITEMS BREAKDOWN:`);
    console.log(`  Total new items: ${newItems.length}`);
    
    for (let i = 1; i <= 10; i++) {
      const count = newItems.filter(item => item.domestic_vendors.size >= i).length;
      if (count > 0) {
        console.log(`  With ${i}+ domestic vendors: ${count}`);
      }
    }
    
    // Show top items
    if (qualified.length > 0) {
      console.log(`\n🌟 TOP 10 ITEMS (3+ Domestic Vendors):`);
      qualified
        .sort((a, b) => b.domestic_vendors.size - a.domestic_vendors.size)
        .slice(0, 10)
        .forEach((item, idx) => {
          const minPrice = item.prices.length > 0 ? Math.min(...item.prices) : 0;
          const avgPrice = item.prices.length > 0 
            ? (item.prices.reduce((a, b) => a + b, 0) / item.prices.length).toFixed(2) 
            : 0;
          
          console.log(`\n${idx + 1}. ${item.item_name || 'Unknown'}`);
          console.log(`   UPC: ${item.upc}`);
          console.log(`   Vendors: ${item.domestic_vendors.size} domestic`);
          console.log(`   Price range: $${minPrice} (avg: $${avgPrice})`);
        });
    }
    
    // Generate Excel report
    console.log('\n📝 Generating Excel report...');
    const workbook = new ExcelJS.Workbook();
    
    // Summary sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 40 },
      { header: 'Value', key: 'value', width: 20 }
    ];
    
    summarySheet.addRows([
      { metric: 'Analysis Date', value: new Date().toLocaleDateString() },
      { metric: 'Date Range', value: `${cutoffDateStr} to today` },
      { metric: 'Total Records', value: allOffers.length },
      { metric: 'Unique UPCs', value: upcMap.size },
      { metric: 'New Items', value: newItems.length },
      { metric: 'Items with 3+ Domestic', value: qualified.length }
    ]);
    
    // Qualified items sheet
    const qualSheet = workbook.addWorksheet('3+ Domestic Vendors');
    qualSheet.columns = [
      { header: 'Rank', key: 'rank', width: 8 },
      { header: 'UPC', key: 'upc', width: 15 },
      { header: 'Item Name', key: 'name', width: 60 },
      { header: 'Brand', key: 'brand', width: 20 },
      { header: '# Domestic', key: 'dom_count', width: 12 },
      { header: 'Domestic Vendors', key: 'vendors', width: 80 },
      { header: 'Min Price', key: 'min_price', width: 12 },
      { header: 'Avg Price', key: 'avg_price', width: 12 }
    ];
    
    qualified
      .sort((a, b) => b.domestic_vendors.size - a.domestic_vendors.size)
      .forEach((item, idx) => {
        const prices = item.prices.filter(p => p > 0);
        qualSheet.addRow({
          rank: idx + 1,
          upc: item.upc,
          name: item.item_name || 'Unknown',
          brand: item.brand || 'N/A',
          dom_count: item.domestic_vendors.size,
          vendors: Array.from(item.domestic_vendors).sort().join(', '),
          min_price: prices.length ? Math.min(...prices) : null,
          avg_price: prices.length ? (prices.reduce((a,b) => a+b, 0) / prices.length).toFixed(2) : null
        });
      });
    
    // Format sheets
    [summarySheet, qualSheet].forEach(sheet => {
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4CAF50' }
      };
    });
    
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `output/Complete_Analysis_21days_${timestamp}.xlsx`;
    await workbook.xlsx.writeFile(filename);
    console.log(`✓ Saved: ${filename}`);
    
    // Save CSV too
    const csvContent = [
      ['UPC', 'Item Name', 'Brand', 'Domestic Vendors', 'Vendor Names', 'Min Price', 'Avg Price'],
      ...qualified.map(item => {
        const prices = item.prices.filter(p => p > 0);
        return [
          item.upc,
          `"${item.item_name || 'Unknown'}"`,
          item.brand || 'N/A',
          item.domestic_vendors.size,
          `"${Array.from(item.domestic_vendors).sort().join(', ')}"`,
          prices.length ? Math.min(...prices) : '',
          prices.length ? (prices.reduce((a,b) => a+b, 0) / prices.length).toFixed(2) : ''
        ];
      })
    ].map(row => row.join(',')).join('\n');
    
    fs.writeFileSync(`output/Complete_Qualified_${timestamp}.csv`, csvContent);
    
    console.log('\n✅ Analysis complete!');
    console.log(`\n📌 KEY FINDING: ${qualified.length} items with 3+ domestic vendors`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

pullAllData21Days();