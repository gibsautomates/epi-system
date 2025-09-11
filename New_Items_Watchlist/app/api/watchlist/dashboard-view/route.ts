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
    const minVendors = parseInt(searchParams.get('min_vendors') || '1');
    
    console.log('Fetching dashboard data from enhanced view (limit:', limit ? limit : 'paginated full dataset', ', min_vendors:', minVendors, ')...');

    let allItems: any[] = [];
    
    if (limit) {
      // If limit is specified, use single query
      let query = supabase
        .from('new_items_dashboard_enhanced')
        .select('*')
        .limit(limit);

      if (minVendors > 1) {
        query = query.gte('domestic_vendor_count', minVendors);
      }

      const { data: items, error } = await query
        .order('domestic_vendor_count', { ascending: false })
        .order('lowest_price', { ascending: true });

      if (error) {
        console.error('Dashboard view API error:', error);
        throw error;
      }

      allItems = items || [];
    } else {
      // Paginate through all data to get the full 39k+ dataset
      const PAGE_SIZE = 1000;
      let currentPage = 0;
      let hasMore = true;

      console.log('Starting pagination to fetch full dataset...');

      while (hasMore) {
        const startRange = currentPage * PAGE_SIZE;
        const endRange = startRange + PAGE_SIZE - 1;

        let query = supabase
          .from('new_items_dashboard_enhanced')
          .select('*')
          .range(startRange, endRange);

        if (minVendors > 1) {
          query = query.gte('domestic_vendor_count', minVendors);
        }

        const { data: pageItems, error } = await query
          .order('domestic_vendor_count', { ascending: false })
          .order('lowest_price', { ascending: true });

        if (error) {
          console.error('Dashboard view pagination error:', error);
          throw error;
        }

        if (!pageItems || pageItems.length === 0) {
          hasMore = false;
        } else {
          allItems.push(...pageItems);
          currentPage++;
          
          // If we got less than PAGE_SIZE items, we've reached the end
          if (pageItems.length < PAGE_SIZE) {
            hasMore = false;
          }

          console.log(`Loaded page ${currentPage}, items so far: ${allItems.length}`);
        }

        // Safety check to prevent infinite loops
        if (currentPage > 50) {
          console.warn('Pagination safety limit reached (50 pages)');
          hasMore = false;
        }
      }

      console.log(`Pagination complete. Total items loaded: ${allItems.length}`);
    }

    if (!allItems || allItems.length === 0) {
      return NextResponse.json({
        items: [],
        metrics: {
          total_new_items: 0,
          items_3plus_vendors: 0,
          active_vendors: 0,
          avg_price: 0,
          last_update: new Date().toISOString(),
          data_source: 'Enhanced Database View (Paginated)'
        }
      });
    }

    // Add missing price_change_pct field to each item
    const itemsWithDefaults = allItems.map(item => ({
      ...item,
      price_change_pct: item.price_change_pct || 0
    }));

    const totalNewItems = itemsWithDefaults.length;
    const items3Plus = itemsWithDefaults.filter(item => item.domestic_vendor_count >= 3).length;

    const vendorSet = new Set();
    itemsWithDefaults.forEach(item => {
      if (item.vendor_list) {
        if (Array.isArray(item.vendor_list)) {
          item.vendor_list.forEach((v: string) => vendorSet.add(v));
        } else if (typeof item.vendor_list === 'string') {
          // Parse comma-separated vendor list string
          const vendors = item.vendor_list.split(',').map(v => v.trim()).filter(v => v);
          vendors.forEach(v => vendorSet.add(v));
        }
      }
    });

    const avgPrice = itemsWithDefaults.length > 0
      ? itemsWithDefaults.reduce((sum, item) => sum + (item.avg_price || 0), 0) / itemsWithDefaults.length
      : 0;

    const metrics = {
      total_new_items: totalNewItems,
      items_3plus_vendors: items3Plus,
      active_vendors: vendorSet.size,
      avg_price: Math.round(avgPrice * 100) / 100,
      last_update: new Date().toISOString(),
      items_displayed: itemsWithDefaults.length,
      total_in_database: totalNewItems,
      data_source: 'Enhanced Database View (Paginated)'
    };

    console.log('Dashboard metrics:', metrics);

    return NextResponse.json({
      items: itemsWithDefaults,
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