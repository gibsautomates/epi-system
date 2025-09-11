import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    // Get today's orders summary by channel using raw data
    const { data: todayData, error: todayError } = await supabase
      .from('orders_daily')
      .select(`
        "CompanyID",
        "OrderSource", 
        "OrderID",
        "Qty",
        "GrandTotal",
        "ProductID"
      `)
      .eq('export_date', date);

    if (todayError) {
      console.error('Error fetching today data:', todayError);
      return NextResponse.json({ error: 'Failed to fetch today data' }, { status: 500 });
    }

    // Get yesterday's data for comparison
    const yesterday = new Date(date);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const { data: yesterdayData, error: yesterdayError } = await supabase
      .from('orders_daily')
      .select(`
        "CompanyID",
        "OrderSource", 
        "OrderID",
        "Qty",
        "GrandTotal",
        "ProductID"
      `)
      .eq('export_date', yesterdayStr);

    if (yesterdayError) {
      console.error('Error fetching yesterday data:', yesterdayError);
    }

    // Get last week's data for comparison (same day last week)
    const lastWeek = new Date(date);
    lastWeek.setDate(lastWeek.getDate() - 7);
    const lastWeekStr = lastWeek.toISOString().split('T')[0];

    const { data: lastWeekData, error: lastWeekError } = await supabase
      .from('orders_daily')
      .select(`
        "CompanyID",
        "OrderSource", 
        "OrderID",
        "Qty",
        "GrandTotal",
        "ProductID"
      `)
      .eq('export_date', lastWeekStr);

    if (lastWeekError) {
      console.error('Error fetching last week data:', lastWeekError);
    }

    // Helper function to aggregate data by channel
    const aggregateByChannel = (data: any[]) => {
      const channelMap = new Map();
      
      data?.forEach(item => {
        const channelCode = `${item.CompanyID}${item.OrderSource}`;
        
        if (!channelMap.has(channelCode)) {
          channelMap.set(channelCode, {
            channel_code: channelCode,
            channel_name: getChannelName(channelCode),
            total_orders: new Set(),
            total_units_sold: 0,
            total_revenue: 0,
            unique_products: new Set(),
          });
        }
        
        const channel = channelMap.get(channelCode);
        channel.total_orders.add(item.OrderID);
        channel.total_units_sold += item.Qty || 0;
        channel.total_revenue += item.GrandTotal || 0;
        channel.unique_products.add(item.ProductID);
      });
      
      // Convert sets to counts
      return Array.from(channelMap.values()).map(channel => ({
        ...channel,
        total_orders: channel.total_orders.size,
        unique_products: channel.unique_products.size,
        avg_order_value: channel.total_orders.size > 0 ? channel.total_revenue / channel.total_orders.size : 0,
      }));
    };

    // Helper function to get channel name (you can expand this based on your channel lookup)
    const getChannelName = (channelCode: string) => {
      const channelNames: Record<string, string> = {
        '278Website': 'Mason',
        '353Website': 'JTV',
        '163Amazon': 'Amazon',
        '163eBayOrder': 'eBay',
        '163Website': '99 Orders',
        // Add more mappings as needed
      };
      return channelNames[channelCode] || 'Unknown Channel';
    };

    // Aggregate data for each period
    const todayAggregated = aggregateByChannel(todayData);
    const yesterdayAggregated = aggregateByChannel(yesterdayData);
    const lastWeekAggregated = aggregateByChannel(lastWeekData);

    // Create lookup maps for comparison
    const yesterdayMap = new Map(
      yesterdayAggregated.map(item => [item.channel_code, item])
    );
    const lastWeekMap = new Map(
      lastWeekAggregated.map(item => [item.channel_code, item])
    );

    // Enhance today's data with comparisons
    const enhancedData = todayAggregated.map(item => {
      const yesterday = yesterdayMap.get(item.channel_code);
      const lastWeek = lastWeekMap.get(item.channel_code);

      return {
        ...item,
        comparisons: {
          yesterday: {
            orders: yesterday?.total_orders || 0,
            units: yesterday?.total_units_sold || 0,
            revenue: yesterday?.total_revenue || 0,
          },
          lastWeek: {
            orders: lastWeek?.total_orders || 0,
            units: lastWeek?.total_units_sold || 0,
            revenue: lastWeek?.total_revenue || 0,
          }
        }
      };
    });

    // Calculate overall totals
    const totals = enhancedData.reduce(
      (acc, item) => ({
        orders: acc.orders + item.total_orders,
        units: acc.units + item.total_units_sold,
        revenue: acc.revenue + item.total_revenue,
        channels: acc.channels + 1,
      }),
      { orders: 0, units: 0, revenue: 0, channels: 0 }
    );

    return NextResponse.json({
      success: true,
      date,
      channels: enhancedData,
      totals,
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}