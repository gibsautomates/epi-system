import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Force dynamic rendering - disable static optimization
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    console.log('Starting daily tracking update...');
    
    // Call the daily update function
    const { data, error } = await supabase
      .rpc('run_daily_watchlist_update');
    
    if (error) {
      console.error('Error running daily update:', error);
      throw error;
    }
    
    // Get detailed status counts
    const { data: statusCounts, error: countError } = await supabase
      .from('watchlist_tracking')
      .select('status')
      .eq('snapshot_date', new Date().toISOString().split('T')[0]);
    
    // Count by status
    const summary = statusCounts?.reduce((acc: any, item: any) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {});
    
    // Get some highlights
    const { data: newCandidates } = await supabase
      .from('watchlist_tracking')
      .select('upc, item_name, lowest_price, domestic_vendor_count')
      .eq('snapshot_date', new Date().toISOString().split('T')[0])
      .eq('status', 'NEW_CANDIDATE')
      .order('lowest_price', { ascending: true })
      .limit(5);
    
    const { data: backInFeed } = await supabase
      .from('watchlist_tracking')
      .select('upc, item_name, lowest_price, domestic_vendor_count')
      .eq('snapshot_date', new Date().toISOString().split('T')[0])
      .eq('status', 'BACK_IN_FEED')
      .limit(5);
    
    const response = {
      success: true,
      message: 'Daily tracking update completed',
      update_date: new Date().toISOString(),
      summary: {
        ...summary,
        total: Object.values(summary || {}).reduce((a: any, b: any) => a + b, 0)
      },
      highlights: {
        top_new_candidates: newCandidates || [],
        items_back_in_feed: backInFeed || []
      },
      raw_data: data
    };
    
    console.log('Daily update summary:', response.summary);
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Tracking update error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update tracking',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    // Get current status summary
    const today = new Date().toISOString().split('T')[0];
    
    const { data: todayStatus, error } = await supabase
      .from('watchlist_tracking')
      .select('status')
      .eq('snapshot_date', today);
    
    if (error) throw error;
    
    // Count by status
    const summary = todayStatus?.reduce((acc: any, item: any) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {}) || {};
    
    // Get last update time
    const { data: lastUpdate } = await supabase
      .from('watchlist_tracking')
      .select('created_at')
      .eq('snapshot_date', today)
      .order('created_at', { ascending: false })
      .limit(1);
    
    return NextResponse.json({
      current_date: today,
      last_update: lastUpdate?.[0]?.created_at || 'No updates today',
      status_summary: {
        ...summary,
        total: Object.values(summary).reduce((a: any, b: any) => a + b, 0)
      },
      message: todayStatus?.length 
        ? `Found ${todayStatus.length} tracked items for today`
        : 'No tracking data for today. Run POST to update.'
    });
    
  } catch (error) {
    console.error('Error fetching tracking status:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch tracking status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}