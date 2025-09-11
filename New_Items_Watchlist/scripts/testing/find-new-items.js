const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findNewItems() {
  console.log('Finding new items (in vendor_offers but not in current_inventory)...\n');
  
  try {
    // Step 1: Get all unique UPCs from vendor_offers with vendor details
    console.log('Step 1: Fetching vendor offers...');
    const { data: vendorOffers, error: vendorError } = await supabase
      .from('vendor_offers')
      .select('upc, upc_text, item_name, brand, vendor, location, price, qty, date')
      .order('upc');
    
    if (vendorError) {
      console.error('Error fetching vendor offers:', vendorError);
      return;
    }
    
    // Step 2: Get all UPCs from current_inventory
    console.log('Step 2: Fetching current inventory...');
    const { data: currentInventory, error: inventoryError } = await supabase
      .from('current_inventory')
      .select('UPC, upc_text, ProductName');
    
    if (inventoryError) {
      console.error('Error fetching inventory:', inventoryError);
      return;
    }
    
    // Create a Set of inventory UPCs for fast lookup
    const inventoryUPCs = new Set(
      currentInventory.map(item => String(item.UPC || item.upc_text).trim())
    );
    
    console.log(`\nFound ${vendorOffers.length} vendor offers`);
    console.log(`Found ${currentInventory.length} items in inventory`);
    
    // Step 3: Group vendor offers by UPC and identify new items
    const upcMap = new Map();
    
    vendorOffers.forEach(offer => {
      const upcKey = String(offer.upc || offer.upc_text).trim();
      
      if (!upcMap.has(upcKey)) {
        upcMap.set(upcKey, {
          upc: upcKey,
          item_name: offer.item_name,
          brand: offer.brand,
          vendors: [],
          domestic_vendors: [],
          international_vendors: [],
          min_price_domestic: null,
          min_price_all: null,
          avg_price_domestic: null,
          total_qty: 0,
          is_new_item: !inventoryUPCs.has(upcKey)
        });
      }
      
      const item = upcMap.get(upcKey);
      
      // Add vendor info
      const vendorInfo = {
        name: offer.vendor,
        location: offer.location,
        price: offer.price,
        qty: offer.qty || 0,
        date: offer.date
      };
      
      item.vendors.push(vendorInfo);
      
      if (offer.location === 'Domestic') {
        item.domestic_vendors.push(vendorInfo);
        if (!item.min_price_domestic || offer.price < item.min_price_domestic) {
          item.min_price_domestic = offer.price;
        }
      } else {
        item.international_vendors.push(vendorInfo);
      }
      
      if (!item.min_price_all || offer.price < item.min_price_all) {
        item.min_price_all = offer.price;
      }
      
      item.total_qty += offer.qty || 0;
    });
    
    // Calculate averages and filter new items
    const newItems = [];
    const newItemsWith3PlusDomestic = [];
    
    upcMap.forEach(item => {
      if (item.is_new_item) {
        // Calculate domestic average price
        if (item.domestic_vendors.length > 0) {
          const domesticPrices = item.domestic_vendors.map(v => v.price).filter(p => p > 0);
          item.avg_price_domestic = domesticPrices.length > 0 
            ? (domesticPrices.reduce((a, b) => a + b, 0) / domesticPrices.length).toFixed(2)
            : null;
        }
        
        // Get unique vendor names
        item.unique_domestic_vendors = [...new Set(item.domestic_vendors.map(v => v.name))];
        item.unique_all_vendors = [...new Set(item.vendors.map(v => v.name))];
        item.domestic_vendor_count = item.unique_domestic_vendors.length;
        item.total_vendor_count = item.unique_all_vendors.length;
        
        newItems.push(item);
        
        if (item.domestic_vendor_count >= 3) {
          newItemsWith3PlusDomestic.push(item);
        }
      }
    });
    
    // Sort by domestic vendor count (descending)
    newItems.sort((a, b) => b.domestic_vendor_count - a.domestic_vendor_count);
    newItemsWith3PlusDomestic.sort((a, b) => b.domestic_vendor_count - a.domestic_vendor_count);
    
    // Display results
    console.log('\n========================================');
    console.log('SUMMARY');
    console.log('========================================');
    console.log(`Total unique UPCs in vendor offers: ${upcMap.size}`);
    console.log(`Items already in inventory: ${inventoryUPCs.size}`);
    console.log(`NEW ITEMS found: ${newItems.length}`);
    console.log(`New items with 3+ domestic vendors: ${newItemsWith3PlusDomestic.length}`);
    
    console.log('\n========================================');
    console.log('NEW ITEMS WITH 3+ DOMESTIC VENDORS (Top 10)');
    console.log('========================================');
    
    newItemsWith3PlusDomestic.slice(0, 10).forEach(item => {
      console.log(`\nUPC: ${item.upc}`);
      console.log(`Item: ${item.item_name}`);
      console.log(`Brand: ${item.brand || 'N/A'}`);
      console.log(`Domestic Vendors (${item.domestic_vendor_count}): ${item.unique_domestic_vendors.join(', ')}`);
      console.log(`Min Price (Domestic): $${item.min_price_domestic}`);
      console.log(`Avg Price (Domestic): $${item.avg_price_domestic}`);
      console.log(`Total Quantity Available: ${item.total_qty}`);
    });
    
    // Save results for reporting
    const timestamp = new Date().toISOString().slice(0, 10);
    const fs = require('fs');
    
    const reportData = {
      generated_at: new Date().toISOString(),
      summary: {
        total_vendor_offers: vendorOffers.length,
        unique_upcs: upcMap.size,
        items_in_inventory: inventoryUPCs.size,
        new_items_count: newItems.length,
        new_items_3plus_domestic: newItemsWith3PlusDomestic.length
      },
      new_items_3plus_domestic: newItemsWith3PlusDomestic.slice(0, 100), // Top 100
      all_new_items: newItems.slice(0, 500) // Top 500
    };
    
    fs.writeFileSync(
      `new_items_report_${timestamp}.json`,
      JSON.stringify(reportData, null, 2)
    );
    
    console.log(`\nReport saved to: new_items_report_${timestamp}.json`);
    
    return {
      newItems,
      newItemsWith3PlusDomestic
    };
    
  } catch (err) {
    console.error('Error in findNewItems:', err);
  }
}

// Run the analysis
findNewItems();