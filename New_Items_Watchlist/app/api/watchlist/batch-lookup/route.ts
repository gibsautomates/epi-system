import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Force recompile - fixed Supabase client initialization
export async function POST(request: NextRequest) {
  console.log('Batch lookup API called');

  try {
    // Check if environment variables are set
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing Supabase environment variables');
      console.error('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Missing');
      console.error('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Missing');
      return NextResponse.json(
        { error: 'Database configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const body = await request.json();
    console.log('Request body:', body);
    let { upcs } = body;

    if (!upcs || !Array.isArray(upcs) || upcs.length === 0) {
      console.error('Invalid UPCs:', upcs);
      return NextResponse.json({ error: 'Invalid UPCs provided' }, { status: 400 });
    }

    // Normalize UPCs: remove leading zeros and convert to numbers for database comparison
    const normalizedUPCs = upcs.map(upc => {
      const cleaned = String(upc).trim();
      // Remove leading zeros but keep at least one digit
      const withoutLeadingZeros = cleaned.replace(/^0+/, '') || '0';
      return withoutLeadingZeros;
    });

    console.log('Normalized UPCs:', normalizedUPCs);

    // Limit to 500 UPCs
    if (upcs.length > 500) {
      return NextResponse.json({ error: 'Maximum 500 UPCs allowed per request' }, { status: 400 });
    }

    console.log(`Processing batch lookup for ${upcs.length} UPCs`);

    // First, get unique UPCs and their basic info from vendor_offers_latest
    // This includes ALL items (both new and existing inventory)
    console.log('Querying database for normalized UPCs:', normalizedUPCs);

    // Group by UPC to get unique items with aggregated data
    const { data: vendorOffers, error } = await supabase
      .from('vendor_offers_latest')
      .select('upc, item_name, brand, sku, vendor, price, qty, vendor_location')
      .in('upc', normalizedUPCs)
      .order('upc', { ascending: true })
      .order('price', { ascending: true });

    console.log('Database query result - Offers found:', vendorOffers?.length || 0);

    if (error) {
      console.error('Database error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      return NextResponse.json({ error: 'Database query failed', details: error.message }, { status: 500 });
    }

    // Group offers by UPC to get unique items
    const itemsByUPC = new Map();
    vendorOffers?.forEach(offer => {
      const upcStr = String(offer.upc);
      if (!itemsByUPC.has(upcStr)) {
        itemsByUPC.set(upcStr, {
          upc: upcStr,
          item_name: offer.item_name,
          brand: offer.brand,
          sku: offer.sku,
          vendors: []
        });
      }
      itemsByUPC.get(upcStr).vendors.push({
        vendor: offer.vendor,
        price: offer.price,
        qty: offer.qty,
        location: offer.vendor_location,
        sku: offer.sku
      });
    });

    // Find which UPCs were not found
    const foundUPCs = new Set(Array.from(itemsByUPC.keys()));
    const notFoundUPCs = upcs.filter(upc => {
      const normalized = String(upc).trim().replace(/^0+/, '') || '0';
      return !foundUPCs.has(normalized);
    });

    // Process items with vendor information and statistics
    const itemsWithVendors = Array.from(itemsByUPC.values()).map(item => {
        const vendors = item.vendors; // Already sorted by price from the query

        // Calculate statistics
        const prices = vendors.map(v => v.price).filter(p => p > 0);
        const sortedPrices = [...prices].sort((a, b) => a - b);
        const medianPrice = sortedPrices.length > 0
          ? sortedPrices.length % 2 === 0
            ? (sortedPrices[sortedPrices.length / 2 - 1] + sortedPrices[sortedPrices.length / 2]) / 2
            : sortedPrices[Math.floor(sortedPrices.length / 2)]
          : 0;
        const avgPrice = prices.length > 0
          ? prices.reduce((sum, p) => sum + p, 0) / prices.length
          : 0;
        const lowestPriceVendor = vendors.length > 0 ? vendors[0] : null; // Already sorted by price

        return {
          upc: item.upc,
          item_name: item.item_name || 'Unknown Item',
          brand: item.brand || 'Unknown Brand',
          vendors: vendors,
          // Add statistics
          medianPrice: medianPrice,
          avgPrice: avgPrice,
          lowestPrice: lowestPriceVendor?.price || 0,
          lowestVendor: lowestPriceVendor?.vendor || '-',
          lowestVendorQty: lowestPriceVendor?.qty || 0,
          vendorCount: vendors.length
        };
      });

    // Get all unique vendors across all items
    const allVendorsSet = new Set<string>();
    itemsWithVendors.forEach(item => {
      item.vendors.forEach(v => allVendorsSet.add(v.vendor));
    });
    const allVendors = Array.from(allVendorsSet).sort();

    // Prepare report data
    const report = {
      items: itemsWithVendors,
      allVendors,
      summary: {
        totalItems: upcs.length,
        itemsFound: itemsWithVendors.length,
        itemsNotFound: notFoundUPCs.length,
        uniqueVendors: allVendors.length
      }
    };

    return NextResponse.json({
      report,
      notFound: notFoundUPCs
    });

  } catch (error) {
    console.error('Batch lookup error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      {
        error: 'Failed to process batch lookup',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}