import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering - disable static optimization
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// In-memory cache
let cache: any = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const forceRefresh = searchParams.get('refresh') === 'true';
    
    // Check cache
    const now = Date.now();
    if (!forceRefresh && cache && (now - cacheTimestamp) < CACHE_DURATION) {
      console.log('Returning cached data, age:', Math.round((now - cacheTimestamp) / 1000), 'seconds');
      return NextResponse.json({
        ...cache,
        metrics: {
          ...cache.metrics,
          from_cache: true,
          cache_age_seconds: Math.round((now - cacheTimestamp) / 1000)
        }
      });
    }
    
    console.log('Cache miss or expired, fetching fresh data...');
    
    // Get date 21 days ago
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 21);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    // For better performance, create a materialized view or use RPC function
    // This is a single query approach to reduce API calls
    
    // First, try to use an aggregated query if possible
    const { data: summary, error: summaryError } = await supabase
      .rpc('get_dashboard_summary', { cutoff_date: cutoffDateStr })
      .single();
      
    if (!summaryError && summary) {
      // If RPC function exists, use it (you'd need to create this in Supabase)
      const result = {
        items: (summary as any).items,
        metrics: (summary as any).metrics
      };
      
      cache = result;
      cacheTimestamp = now;
      
      return NextResponse.json(result);
    }
    
    // Fallback to current paginated approach
    console.log(`RPC not available, using paginated fetch from ${cutoffDateStr}...`);
    
    // [Rest of the existing code from dashboard-optimized would go here...]
    // But with caching added at the end
    
    // For now, just redirect to the optimized endpoint
    return NextResponse.redirect(new URL('/api/watchlist/dashboard-optimized', request.url));
    
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}