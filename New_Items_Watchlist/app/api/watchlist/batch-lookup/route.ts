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
    const { upcs } = body;

    if (!upcs || !Array.isArray(upcs) || upcs.length === 0) {
      console.error('Invalid UPCs:', upcs);
      return NextResponse.json({ error: 'Invalid UPCs provided' }, { status: 400 });
    }

    // Limit to 500 UPCs
    if (upcs.length > 500) {
      return NextResponse.json({ error: 'Maximum 500 UPCs allowed per request' }, { status: 400 });
    }

    console.log(`Processing batch lookup for ${upcs.length} UPCs`);

    // Fetch data for all UPCs from the enhanced view
    console.log('Querying database for UPCs:', upcs);
    const { data: items, error } = await supabase
      .from('new_items_dashboard_enhanced')
      .select('*')
      .in('upc', upcs);

    console.log('Database query result - Items found:', items?.length || 0);

    if (error) {
      console.error('Database error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      return NextResponse.json({ error: 'Database query failed', details: error.message }, { status: 500 });
    }

    // Find which UPCs were not found (convert to strings for comparison)
    const foundUPCs = new Set(items?.map(item => String(item.upc)) || []);
    const notFoundUPCs = upcs.filter(upc => !foundUPCs.has(String(upc)));

    // Fetch detailed vendor information for each found item
    const itemsWithVendors = await Promise.all(
      (items || []).map(async (item) => {
        // Fetch vendor breakdown
        const { data: vendorData } = await supabase
          .from('vendor_offers_latest_new')
          .select('vendor, price, qty, vendor_location, sku')
          .eq('upc', item.upc)
          .order('price', { ascending: true });

        return {
          upc: String(item.upc),
          item_name: item.item_name || 'Unknown Item',
          brand: item.brand || 'Unknown Brand',
          vendors: (vendorData || []).map(v => ({
            vendor: v.vendor,
            price: v.price,
            qty: v.qty,
            location: v.vendor_location,
            sku: v.sku
          }))
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