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

    // Fetch data for all UPCs from the enhanced view
    // Use normalized UPCs for database query (numbers without leading zeros)
    console.log('Querying database for normalized UPCs:', normalizedUPCs);
    const { data: items, error } = await supabase
      .from('new_items_dashboard_enhanced')
      .select('*')
      .in('upc', normalizedUPCs);

    console.log('Database query result - Items found:', items?.length || 0);

    if (error) {
      console.error('Database error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      return NextResponse.json({ error: 'Database query failed', details: error.message }, { status: 500 });
    }

    // Find which UPCs were not found (compare normalized versions)
    const foundUPCs = new Set(items?.map(item => String(item.upc)) || []);
    const notFoundUPCs = upcs.filter(upc => {
      const normalized = String(upc).trim().replace(/^0+/, '') || '0';
      return !foundUPCs.has(normalized);
    });

    // Fetch detailed vendor information for each found item
    const itemsWithVendors = await Promise.all(
      (items || []).map(async (item) => {
        // Fetch vendor breakdown
        const { data: vendorData } = await supabase
          .from('vendor_offers_latest_new')
          .select('vendor, price, qty, vendor_location, sku')
          .eq('upc', item.upc)
          .order('price', { ascending: true });

        const vendors = (vendorData || []).map(v => ({
          vendor: v.vendor,
          price: v.price,
          qty: v.qty,
          location: v.vendor_location,
          sku: v.sku
        }));

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
          upc: String(item.upc),
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
      })
    );

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