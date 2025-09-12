import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const upc = searchParams.get('upc');
    
    if (!upc) {
      return NextResponse.json({ error: 'UPC parameter is required' }, { status: 400 });
    }

    console.log(`Fetching vendor breakdown for UPC: ${upc}`);

    // Use vendor_offers_latest_new - the same source as the dashboard
    // This view already filters to only show latest file per vendor within 21 days
    const { data: vendorOffers, error } = await supabase
      .from('vendor_offers_latest_new')
      .select(`
        vendor,
        price,
        qty,
        vendor_location,
        date,
        sku,
        msrp
      `)
      .eq('upc', upc)
      .order('vendor', { ascending: true })
      .order('price', { ascending: true });

    if (error) {
      console.error('Error fetching vendor offers:', error);
      throw error;
    }

    if (!vendorOffers || vendorOffers.length === 0) {
      return NextResponse.json({ 
        vendors: [], 
        summary: {
          total_vendors: 0,
          domestic_vendors: 0,
          international_vendors: 0,
          lowest_price: null,
          highest_price: null,
          total_qty: 0,
          domestic_qty: 0,
          price_range: 0
        },
        upc
      });
    }

    // Deduplicate vendors - keep only ONE offer per vendor (prioritize lowest valid price)
    const vendorMap = new Map();
    vendorOffers.forEach(offer => {
      const existing = vendorMap.get(offer.vendor);
      
      if (!existing) {
        // First occurrence of this vendor - always add it
        vendorMap.set(offer.vendor, {
          vendor: offer.vendor,
          price: offer.price,
          qty: offer.qty,
          location: offer.vendor_location || 'Unknown',
          date: offer.date,
          sku: offer.sku,
          msrp: offer.msrp
        });
      } else {
        // Vendor already exists - update only if this offer has a better (lower) valid price
        const hasValidPrice = offer.price && offer.price > 0;
        const existingHasValidPrice = existing.price && existing.price > 0;
        
        if (hasValidPrice && (!existingHasValidPrice || offer.price < existing.price)) {
          // This offer has a valid price that's better than existing
          vendorMap.set(offer.vendor, {
            vendor: offer.vendor,
            price: offer.price,
            qty: offer.qty,
            location: offer.vendor_location || 'Unknown',
            date: offer.date,
            sku: offer.sku,
            msrp: offer.msrp
          });
        }
      }
    });

    const vendors = Array.from(vendorMap.values());

    // Calculate summary statistics
    const domesticVendors = vendors.filter(v => v.location === 'Domestic');
    const internationalVendors = vendors.filter(v => v.location === 'International');
    
    const prices = vendors.map(v => v.price).filter(p => p !== null && p > 0);
    const quantities = vendors.map(v => v.qty || 0);

    const summary = {
      total_vendors: vendors.length,
      domestic_vendors: domesticVendors.length,
      international_vendors: internationalVendors.length,
      lowest_price: prices.length > 0 ? Math.min(...prices) : null,
      highest_price: prices.length > 0 ? Math.max(...prices) : null,
      total_qty: quantities.reduce((sum, qty) => sum + qty, 0),
      domestic_qty: domesticVendors.reduce((sum, v) => sum + (v.qty || 0), 0),
      price_range: prices.length > 0 ? Math.max(...prices) - Math.min(...prices) : 0
    };

    // Sort vendors by price (lowest first)
    vendors.sort((a, b) => (a.price || Infinity) - (b.price || Infinity));

    console.log(`Found ${vendors.length} vendors for UPC ${upc}`);

    return NextResponse.json({
      vendors,
      summary,
      upc
    });

  } catch (error) {
    console.error('Item vendors API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch vendor breakdown', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}