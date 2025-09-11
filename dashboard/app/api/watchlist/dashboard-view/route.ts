import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : null;
    const minVendors = parseInt(searchParams.get('min_vendors') || '3');
    
    console.log('Fetching dashboard data from views (limit:', limit ? limit : 'no limit', ', min_vendors:', minVendors, ')...');

    // Use new_items_view to get the data (the original working view)
    let query = supabase
      .from('new_items_view')
      .select('*');

    if (minVendors > 1) {
      query = query.gte('domestic_vendor_count', minVendors);
    }

    if (limit) {
      query = query.limit(limit);
    }

    const { data: items, error } = await query
      .order('domestic_vendor_count', { ascending: false })
      .order('lowest_price', { ascending: true });

    if (error) {
      console.error('Dashboard view API error:', error);
      throw error;
    }

    if (!items || items.length === 0) {
      return NextResponse.json({
        items: [],
        metrics: {
          total_new_items: 0,
          items_3plus_vendors: 0,
          active_vendors: 0,
          avg_price: 0,
          last_update: new Date().toISOString(),
          data_source: 'Supabase Views'
        }
      });
    }

    const totalNewItems = items.length;
    const items3Plus = items.filter(item => item.domestic_vendor_count >= 3).length;

    const vendorSet = new Set();
    items.forEach(item => {
      if (Array.isArray(item.vendor_list)) {
        item.vendor_list.forEach((v: string) => vendorSet.add(v));
      }
    });

    const avgPrice = items.length > 0
      ? items.reduce((sum, item) => sum + (item.avg_price || 0), 0) / items.length
      : 0;

    const metrics = {
      total_new_items: totalNewItems,
      items_3plus_vendors: items3Plus,
      active_vendors: vendorSet.size,
      avg_price: Math.round(avgPrice * 100) / 100,
      last_update: new Date().toISOString(),
      items_displayed: items.length,
      total_in_database: totalNewItems,
      data_source: 'Supabase Views'
    };

    console.log('Dashboard metrics:', metrics);

    return NextResponse.json({
      items,
      metrics
    });

  } catch (error) {
    console.error('Dashboard view API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}