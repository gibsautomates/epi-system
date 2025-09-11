import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    // Calculate comparison dates relative to the selected date
    const selectedDateObj = new Date(date + 'T00:00:00'); // Ensure proper date parsing
    
    const yesterday = new Date(selectedDateObj);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const lastWeek = new Date(selectedDateObj);
    lastWeek.setDate(lastWeek.getDate() - 7);
    const lastWeekStr = lastWeek.toISOString().split('T')[0];

    console.log(`Selected date: ${date}, Yesterday: ${yesterdayStr}, Last week: ${lastWeekStr}`);

    // Helper function to get channel name
    const getChannelName = (channelCode: string) => {
      const channelNames: Record<string, string> = {
        '278Website': 'Mason',
        '353Website': 'JTV',
        '163Amazon': 'Amazon',
        '163eBayOrder': 'eBay',
        '163Website': '99 Orders',
        '211Dropship_Central': 'Dropship Canada',
        '163GoogleExpress': 'Google',
        '227Fingerhut': 'Fingerhut',
        '272Groupon': 'Groupon',
        '222Website': 'OpenSky',
        '248Walmart': 'Walmart Dropship',
        '163Walmart_Marketplace': 'Walmart Marketplace',
        '207Website': 'Zulily',
        '323Website': 'Kroger',
        '168Walmart_Marketplace': 'Walmart Canada',
        '163Wish': 'Wish',
      };
      return channelNames[channelCode] || 'Unknown Channel';
    };

    // Helper function to aggregate data by channel for a specific date
    const aggregateByChannel = async (targetDate: string) => {
      const { data, error } = await supabase
        .from('orders_daily')
        .select(`
          "CompanyID",
          "OrderSource", 
          "OrderID",
          "Qty",
          "GrandTotal"
        `)
        .eq('export_date', targetDate);

      if (error) {
        console.error(`Error fetching data for ${targetDate}:`, error);
        return [];
      }

      const channelMap = new Map();
      
      data?.forEach(item => {
        const channelCode = `${item.CompanyID}${item.OrderSource}`;
        
        if (!channelMap.has(channelCode)) {
          channelMap.set(channelCode, {
            channel_code: channelCode,
            channel_name: getChannelName(channelCode),
            total_orders: new Set(),
            total_revenue: 0,
          });
        }
        
        const channel = channelMap.get(channelCode);
        channel.total_orders.add(item.OrderID);
        channel.total_revenue += item.GrandTotal || 0;
      });
      
      // Convert sets to counts
      return Array.from(channelMap.values()).map(channel => ({
        ...channel,
        total_orders: channel.total_orders.size,
      }));
    };

    // Get data for all three periods
    const [todayData, yesterdayData, lastWeekData] = await Promise.all([
      aggregateByChannel(date),
      aggregateByChannel(yesterdayStr),
      aggregateByChannel(lastWeekStr),
    ]);

    // Create lookup maps
    const yesterdayMap = new Map(
      yesterdayData.map(item => [item.channel_code, item])
    );
    const lastWeekMap = new Map(
      lastWeekData.map(item => [item.channel_code, item])
    );

    // Get all unique channels
    const allChannels = new Set([
      ...todayData.map(item => item.channel_code),
      ...yesterdayData.map(item => item.channel_code),
      ...lastWeekData.map(item => item.channel_code),
    ]);

    // Build comparison data
    const channels = Array.from(allChannels).map(channelCode => {
      const today = todayData.find(item => item.channel_code === channelCode);
      const yesterday = yesterdayMap.get(channelCode);
      const lastWeek = lastWeekMap.get(channelCode);

      const todayOrders = today?.total_orders || 0;
      const todayRevenue = today?.total_revenue || 0;
      const yesterdayOrders = yesterday?.total_orders || 0;
      const yesterdayRevenue = yesterday?.total_revenue || 0;
      const lastweekOrders = lastWeek?.total_orders || 0;
      const lastweekRevenue = lastWeek?.total_revenue || 0;

      // Calculate percentage changes
      const ordersChangeVsYesterday = yesterdayOrders > 0 
        ? ((todayOrders - yesterdayOrders) / yesterdayOrders) * 100 
        : todayOrders > 0 ? 100 : 0;
      
      const ordersChangeVsLastweek = lastweekOrders > 0 
        ? ((todayOrders - lastweekOrders) / lastweekOrders) * 100 
        : todayOrders > 0 ? 100 : 0;

      const revenueChangeVsYesterday = yesterdayRevenue > 0 
        ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 
        : todayRevenue > 0 ? 100 : 0;
      
      const revenueChangeVsLastweek = lastweekRevenue > 0 
        ? ((todayRevenue - lastweekRevenue) / lastweekRevenue) * 100 
        : todayRevenue > 0 ? 100 : 0;

      return {
        channel_code: channelCode,
        channel_name: today?.channel_name || getChannelName(channelCode),
        today_orders: todayOrders,
        today_revenue: todayRevenue,
        yesterday_orders: yesterdayOrders,
        yesterday_revenue: yesterdayRevenue,
        lastweek_orders: lastweekOrders,
        lastweek_revenue: lastweekRevenue,
        orders_change_vs_yesterday: ordersChangeVsYesterday,
        orders_change_vs_lastweek: ordersChangeVsLastweek,
        revenue_change_vs_yesterday: revenueChangeVsYesterday,
        revenue_change_vs_lastweek: revenueChangeVsLastweek,
      };
    }).filter(channel => 
      // Only include channels that have activity in at least one of the periods
      channel.today_orders > 0 || channel.yesterday_orders > 0 || channel.lastweek_orders > 0
    ).sort((a, b) => b.today_revenue - a.today_revenue);

    // Calculate totals
    const totals = channels.reduce((acc, channel) => ({
      today_orders: acc.today_orders + channel.today_orders,
      today_revenue: acc.today_revenue + channel.today_revenue,
      yesterday_orders: acc.yesterday_orders + channel.yesterday_orders,
      yesterday_revenue: acc.yesterday_revenue + channel.yesterday_revenue,
      lastweek_orders: acc.lastweek_orders + channel.lastweek_orders,
      lastweek_revenue: acc.lastweek_revenue + channel.lastweek_revenue,
    }), {
      today_orders: 0,
      today_revenue: 0,
      yesterday_orders: 0,
      yesterday_revenue: 0,
      lastweek_orders: 0,
      lastweek_revenue: 0,
    });

    return NextResponse.json({
      success: true,
      date,
      channels,
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