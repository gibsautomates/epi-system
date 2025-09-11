import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const channelCode = searchParams.get('channel_code');

    // Get raw SKU data for the specified date
    let query = supabase
      .from('orders_daily')
      .select(`
        "CompanyID",
        "OrderSource",
        "ProductID",
        "DisplayName",
        "Qty",
        "LineTotal",
        "InventoryAvailableQty",
        "OriginalUnitPrice"
      `)
      .eq('export_date', date);

    if (channelCode) {
      // Parse channel code to get CompanyID and OrderSource
      const companyId = channelCode.substring(0, 3);
      const orderSource = channelCode.substring(3);
      query = query.eq('CompanyID', companyId).eq('OrderSource', orderSource);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching top SKUs:', error);
      return NextResponse.json({ error: 'Failed to fetch top SKUs' }, { status: 500 });
    }

    // Helper function to get channel name
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

    // Aggregate SKU data by channel and product
    const skuMap = new Map();
    
    data?.forEach(item => {
      const channelCode = `${item.CompanyID}${item.OrderSource}`;
      const skuKey = `${channelCode}-${item.ProductID}`;
      
      if (!skuMap.has(skuKey)) {
        skuMap.set(skuKey, {
          channel_code: channelCode,
          channel_name: getChannelName(channelCode),
          product_id: item.ProductID,
          display_name: item.DisplayName,
          units_sold: 0,
          total_revenue: 0,
          available_qty: item.InventoryAvailableQty || 0,
          price: item.OriginalUnitPrice || 0,
        });
      }
      
      const sku = skuMap.get(skuKey);
      sku.units_sold += item.Qty || 0;
      sku.total_revenue += item.LineTotal || 0;
    });

    // Convert to array and sort by channel and units sold
    const skusArray = Array.from(skuMap.values());
    
    // Group by channel and apply limits based on channel size
    const groupedData = skusArray.reduce((acc, item) => {
      if (!acc[item.channel_code]) {
        acc[item.channel_code] = [];
      }
      acc[item.channel_code].push(item);
      return acc;
    }, {} as Record<string, any[]>);

    // Sort and limit by channel
    Object.keys(groupedData).forEach(channelCode => {
      const channelName = groupedData[channelCode][0]?.channel_name;
      const isLargeChannel = channelName === 'JTV' || channelName === 'Mason';
      const limit = isLargeChannel ? 10 : 3;
      
      groupedData[channelCode] = groupedData[channelCode]
        .sort((a, b) => b.units_sold - a.units_sold)
        .slice(0, limit)
        .map((item, index) => ({
          ...item,
          rank: index + 1
        }));
    });

    return NextResponse.json({
      success: true,
      date,
      topSkus: groupedData,
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}