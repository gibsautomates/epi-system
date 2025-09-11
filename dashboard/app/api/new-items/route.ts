import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');

    // Calculate date threshold
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - days);
    const dateStr = dateThreshold.toISOString().split('T')[0];

    // Query to find new items (products that appeared in orders recently)
    // This identifies products by SKU and finds their first appearance
    const { data: newItemsData, error } = await supabase
      .from('orders_daily')
      .select(`
        "Product_Name",
        "SKU",
        "CompanyID",
        order_date,
        "Sale_Price"
      `)
      .gte('order_date', dateStr)
      .order('order_date', { ascending: true });

    if (error) {
      console.error('Error fetching new items data:', error);
      return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }

    // Process data to identify truly "new" items
    const itemMap = new Map();
    
    newItemsData?.forEach(order => {
      const sku = order.SKU;
      const productName = order.Product_Name;
      const companyId = order.CompanyID;
      const orderDate = order.order_date;
      const salePrice = parseFloat(order.Sale_Price?.toString() || '0');

      if (!sku || !productName) return;

      const key = `${sku}-${productName}`;
      
      if (!itemMap.has(key)) {
        itemMap.set(key, {
          sku: sku,
          product_name: productName,
          first_seen: orderDate,
          latest_order: orderDate,
          total_orders: 0,
          channels: new Set(),
          prices: [],
          company_ids: new Set()
        });
      }

      const item = itemMap.get(key);
      item.total_orders += 1;
      item.channels.add(companyId);
      item.company_ids.add(companyId);
      item.prices.push(salePrice);
      
      // Update latest order date
      if (orderDate > item.latest_order) {
        item.latest_order = orderDate;
      }
      
      // Update first seen date (earliest)
      if (orderDate < item.first_seen) {
        item.first_seen = orderDate;
      }
    });

    // Helper function to get channel name
    const getChannelName = (companyId: string) => {
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
      return channelNames[companyId] || `Channel ${companyId}`;
    };

    // Convert to array and calculate averages
    const items = Array.from(itemMap.values()).map(item => ({
      sku: item.sku,
      product_name: item.product_name,
      first_seen: item.first_seen,
      latest_order: item.latest_order,
      total_orders: item.total_orders,
      channels: Array.from(item.channels).map(id => getChannelName(String(id))),
      avg_price: item.prices.length > 0 
        ? item.prices.reduce((sum, price) => sum + price, 0) / item.prices.length 
        : 0
    }));

    // Sort by first seen date (newest first)
    items.sort((a, b) => new Date(b.first_seen).getTime() - new Date(a.first_seen).getTime());

    return NextResponse.json({
      items: items,
      summary: {
        total_items: items.length,
        date_range_days: days,
        date_from: dateStr
      }
    });

  } catch (error) {
    console.error('Error in new-items API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}