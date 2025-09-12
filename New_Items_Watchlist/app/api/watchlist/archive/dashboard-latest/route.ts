import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    // Get date 21 days ago
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 21);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    console.log(`Fetching data from ${cutoffDateStr}...`);

    // Step 1: Get the latest date for each vendor within the 21-day window
    console.log('Step 1: Finding latest file date per vendor...');
    const { data: vendorDates, error: datesError } = await supabase
      .from('vendor_offers')
      .select('vendor, date')
      .gte('date', cutoffDateStr)
      .order('vendor', { ascending: true })
      .order('date', { ascending: false });
      
    if (datesError) throw datesError;

    // Find the latest date for each vendor
    const vendorLatestDates = new Map<string, string>();
    vendorDates?.forEach(row => {
      if (!vendorLatestDates.has(row.vendor)) {
        vendorLatestDates.set(row.vendor, row.date);
      }
    });
    
    console.log(`Found ${vendorLatestDates.size} vendors with recent data`);
    
    // Step 2: Fetch ALL current inventory with pagination
    console.log('Step 2: Fetching current inventory...');
    let allInventory: any[] = [];
    let invPage = 0;
    let hasMoreInv = true;
    
    while (hasMoreInv && invPage < 50) {
      const { data: invBatch, error: invError } = await supabase
        .from('current_inventory')
        .select('UPC, upc_text')
        .range(invPage * 1000, (invPage + 1) * 1000 - 1);
        
      if (invError) throw invError;
      
      if (invBatch && invBatch.length > 0) {
        allInventory = allInventory.concat(invBatch);
        hasMoreInv = invBatch.length === 1000;
        invPage++;
      } else {
        hasMoreInv = false;
      }
    }
    
    const inventory = allInventory;
    console.log(`Fetched ${inventory.length} inventory records`);

    // Create inventory set for quick lookup
    const inventorySet = new Set(
      inventory?.map(item => String(item.UPC || item.upc_text).trim()) || []
    );

    // Step 3: Fetch ONLY the latest offers for each vendor
    console.log('Step 3: Fetching latest offers per vendor...');
    let allOffers: any[] = [];
    
    // Process each vendor's latest file
    for (const [vendor, latestDate] of Array.from(vendorLatestDates.entries())) {
      console.log(`  Fetching ${vendor} data from ${latestDate}...`);
      
      let vendorOffers: any[] = [];
      let page = 0;
      let hasMore = true;
      
      while (hasMore && page < 20) {
        const { data: batch, error: batchError } = await supabase
          .from('vendor_offers')
          .select('*')
          .eq('vendor', vendor)
          .eq('date', latestDate) // ONLY the latest date for this vendor
          .range(page * 1000, (page + 1) * 1000 - 1);
          
        if (batchError) {
          console.error(`Error fetching ${vendor} data:`, batchError);
          break;
        }
        
        if (batch && batch.length > 0) {
          vendorOffers = vendorOffers.concat(batch);
          hasMore = batch.length === 1000;
          page++;
        } else {
          hasMore = false;
        }
      }
      
      console.log(`    Found ${vendorOffers.length} items`);
      allOffers = allOffers.concat(vendorOffers);
    }
    
    const offers = allOffers;
    console.log(`Total vendor offers fetched: ${offers.length} (only latest files)`);

    // Process data
    const upcMap = new Map();
    const vendorSet = new Set();
    const priceHistory = new Map();

    offers?.forEach(offer => {
      const upc = String(offer.upc || offer.upc_text).trim();
      vendorSet.add(offer.vendor);

      if (!upcMap.has(upc)) {
        upcMap.set(upc, {
          upc,
          item_name: offer.item_name,
          brand: offer.brand || 'N/A',
          sku: offer.sku,
          is_new: !inventorySet.has(upc),
          vendors: new Map(),
          domestic_vendors: new Set(),
          international_vendors: new Set(),
          prices: [],
          dates: new Set(),
          quantities: []
        });
      }

      const item = upcMap.get(upc);
      
      // Update item name to longest version
      if (offer.item_name && offer.item_name.length > (item.item_name || '').length) {
        item.item_name = offer.item_name;
      }

      // Track vendor info
      if (!item.vendors.has(offer.vendor)) {
        item.vendors.set(offer.vendor, {
          location: offer.location,
          prices: [],
          dates: [],
          quantities: [],
          latest_date: offer.date // Track the actual date
        });
      }

      const vendorData = item.vendors.get(offer.vendor);
      if (offer.price > 0) {
        vendorData.prices.push(offer.price);
        item.prices.push(offer.price);
      }
      vendorData.dates.push(offer.date);
      if (offer.qty) {
        vendorData.quantities.push(offer.qty);
        item.quantities.push(offer.qty);
      }

      item.dates.add(offer.date);

      if (offer.location === 'Domestic') {
        item.domestic_vendors.add(offer.vendor);
      } else if (offer.location === 'International') {
        item.international_vendors.add(offer.vendor);
      }

      // Track price history for trend analysis
      if (!priceHistory.has(upc)) {
        priceHistory.set(upc, []);
      }
      if (offer.price > 0) {
        priceHistory.get(upc).push({
          date: offer.date,
          price: offer.price,
          vendor: offer.vendor
        });
      }
    });

    // Process into final format
    const items = [];
    let totalNewItems = 0;
    let items3PlusVendors = 0;
    let totalPrices = [];

    upcMap.forEach((item, upc) => {
      if (!item.is_new) return; // Only include new items

      totalNewItems++;
      
      const domesticVendorCount = item.domestic_vendors.size;
      const totalVendorCount = item.vendors.size;
      
      if (domesticVendorCount >= 3) {
        items3PlusVendors++;
      }

      const validPrices = item.prices.filter(p => p > 0);
      const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : 0;
      const maxPrice = validPrices.length > 0 ? Math.max(...validPrices) : 0;
      const avgPrice = validPrices.length > 0 
        ? validPrices.reduce((a, b) => a + b, 0) / validPrices.length 
        : 0;

      totalPrices.push(...validPrices);

      // Find lowest price vendor
      let lowestVendor = '';
      let lowestPrice = Infinity;
      item.vendors.forEach((vendorData, vendorName) => {
        const vendorMinPrice = Math.min(...vendorData.prices.filter(p => p > 0));
        if (vendorMinPrice < lowestPrice) {
          lowestPrice = vendorMinPrice;
          lowestVendor = vendorName;
        }
      });

      // Calculate price trend
      const history = priceHistory.get(upc) || [];
      const sortedHistory = history.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      let priceTrend = 'stable';
      let priceChangePct = 0;
      
      if (sortedHistory.length >= 2) {
        const oldPrice = sortedHistory[0].price;
        const newPrice = sortedHistory[sortedHistory.length - 1].price;
        const change = ((newPrice - oldPrice) / oldPrice) * 100;
        
        if (change > 5) {
          priceTrend = 'up';
        } else if (change < -5) {
          priceTrend = 'down';
        }
        priceChangePct = Math.round(change * 10) / 10;
      }

      // Determine status
      const dateArray = Array.from(item.dates).sort();
      const firstSeen = dateArray[0] as string;
      const lastSeen = dateArray[dateArray.length - 1] as string; // This will be the actual last seen
      
      const daysSinceFirst = Math.floor(
        (new Date().getTime() - new Date(firstSeen).getTime()) / (1000 * 60 * 60 * 24)
      );
      
      let status = 'active';
      if (daysSinceFirst <= 7) {
        status = 'new';
      } else if (dateArray.length > 1 && daysSinceFirst > 30) {
        status = 'reappeared';
      }

      // Calculate total quantity
      const totalQty = item.quantities.reduce((a, b) => a + b, 0);

      items.push({
        upc,
        item_name: item.item_name || 'Unknown',
        brand: item.brand,
        sku: item.sku,
        current_price: minPrice,
        min_price: minPrice,
        avg_price: Math.round(avgPrice * 100) / 100,
        max_price: maxPrice,
        lowest_vendor: lowestVendor,
        domestic_vendor_count: domesticVendorCount,
        total_vendor_count: totalVendorCount,
        vendor_list: Array.from(item.vendors.keys()),
        first_seen: firstSeen,
        last_seen: lastSeen,
        status,
        price_trend: priceTrend,
        price_change_pct: priceChangePct,
        location: domesticVendorCount > 0 ? 'Domestic' : 'International',
        qty_available: totalQty
      });
    });

    // Sort by domestic vendor count (desc) then by price (asc)
    items.sort((a, b) => {
      if (b.domestic_vendor_count !== a.domestic_vendor_count) {
        return b.domestic_vendor_count - a.domestic_vendor_count;
      }
      return a.min_price - b.min_price;
    });

    // Calculate metrics
    const avgPrice = totalPrices.length > 0
      ? totalPrices.reduce((a, b) => a + b, 0) / totalPrices.length
      : 0;

    const metrics = {
      total_new_items: totalNewItems,
      items_3plus_vendors: items3PlusVendors,
      active_vendors: vendorSet.size,
      avg_price: Math.round(avgPrice * 100) / 100,
      last_update: new Date().toISOString(),
      // Data fetch summary
      vendor_offers_fetched: offers.length,
      inventory_records_fetched: inventory.length,
      inventory_records_in_set: inventorySet.size,
      vendors_with_latest_files: vendorLatestDates.size,
      vendor_latest_dates: Object.fromEntries(vendorLatestDates)
    };

    console.log('Metrics:', metrics);

    return NextResponse.json({
      items,
      metrics
    });

  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}