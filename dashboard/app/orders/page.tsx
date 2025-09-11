'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Download, Calendar, Package, TrendingUp, DollarSign, ShoppingCart, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ChannelData {
  channel_code: string;
  channel_name: string;
  total_orders: number;
  total_units_sold: number;
  total_revenue: number;
  unique_products: number;
  avg_order_value: number;
  comparisons: {
    yesterday: {
      orders: number;
      units: number;
      revenue: number;
    };
    lastWeek: {
      orders: number;
      units: number;
      revenue: number;
    };
  };
}

interface TopSku {
  product_id: string;
  display_name: string;
  units_sold: number;
  total_revenue: number;
  available_qty: number;
  price: number;
  rank: number;
}

interface ApiResponse {
  success: boolean;
  date: string;
  channels: ChannelData[];
  totals: {
    orders: number;
    units: number;
    revenue: number;
    channels: number;
  };
}

interface TopSkusResponse {
  success: boolean;
  date: string;
  topSkus: Record<string, TopSku[]>;
}

export default function OrderSummaryPage() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [topSkus, setTopSkus] = useState<TopSkusResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [summaryRes, skusRes] = await Promise.all([
        fetch(`/api/orders/summary?date=${selectedDate}`),
        fetch(`/api/orders/top-skus?date=${selectedDate}`)
      ]);

      const summaryData = await summaryRes.json();
      const skusData = await skusRes.json();

      if (summaryData.success) setData(summaryData);
      if (skusData.success) setTopSkus(skusData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getComparisonIcon = (current: number, previous: number) => {
    if (current > previous) return { icon: '↗', color: 'text-green-600' };
    if (current < previous) return { icon: '↘', color: 'text-red-600' };
    return { icon: '→', color: 'text-gray-400' };
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => router.push('/')}
                className="mr-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Order Summary</h1>
                <p className="text-sm text-gray-500">Track daily orders and channel performance</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2">
                <Download className="h-4 w-4" />
                Export
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Overall Stats Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Orders</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {loading ? '-' : data?.totals.orders || 0}
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Revenue</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {loading ? '-' : formatCurrency(data?.totals.revenue || 0)}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Units</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {loading ? '-' : (data?.totals.units || 0).toLocaleString()}
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <ShoppingCart className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Active Channels</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {loading ? '-' : data?.totals.channels || 0}
                </p>
              </div>
              <div className="p-3 bg-orange-100 rounded-lg">
                <Users className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-500">Loading order data...</p>
          </div>
        ) : data?.channels.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Order Data Available</h3>
            <p className="text-sm text-gray-500">
              No orders found for {selectedDate}. Try selecting a different date or ensure the data has been uploaded to Supabase.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {data?.channels.map((channel) => {
              const channelSkus = topSkus?.topSkus[channel.channel_code] || [];
              const isLargeChannel = channel.channel_name === 'JTV' || channel.channel_name === 'Mason';
              
              return (
                <div key={channel.channel_code} className="bg-white rounded-lg shadow">
                  {/* Channel Header */}
                  <div className="p-6 border-b">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{channel.channel_name}</h3>
                        <p className="text-sm text-gray-500">{channel.channel_code}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-gray-900">{channel.total_orders}</p>
                        <p className="text-sm text-gray-500">Orders</p>
                      </div>
                    </div>
                  </div>

                  {/* Channel Metrics */}
                  <div className="p-6 border-b bg-gray-50">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-500">Units Sold</span>
                          <div className="flex items-center gap-1">
                            <span className={`text-sm ${getComparisonIcon(channel.total_units_sold, channel.comparisons.yesterday.units).color}`}>
                              {getComparisonIcon(channel.total_units_sold, channel.comparisons.yesterday.units).icon}
                            </span>
                            <span className="text-xs text-gray-400">vs Yesterday</span>
                          </div>
                        </div>
                        <p className="text-lg font-semibold">{channel.total_units_sold.toLocaleString()}</p>
                        <p className="text-xs text-gray-400">
                          Last week: {channel.comparisons.lastWeek.units.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-500">Revenue</span>
                          <div className="flex items-center gap-1">
                            <span className={`text-sm ${getComparisonIcon(channel.total_revenue, channel.comparisons.yesterday.revenue).color}`}>
                              {getComparisonIcon(channel.total_revenue, channel.comparisons.yesterday.revenue).icon}
                            </span>
                            <span className="text-xs text-gray-400">vs Yesterday</span>
                          </div>
                        </div>
                        <p className="text-lg font-semibold">{formatCurrency(channel.total_revenue)}</p>
                        <p className="text-xs text-gray-400">
                          Last week: {formatCurrency(channel.comparisons.lastWeek.revenue)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Top SKUs */}
                  <div className="p-6">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">
                      Top {isLargeChannel ? '10' : '3'} SKUs
                    </h4>
                    {channelSkus.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">No SKU data available</p>
                    ) : (
                      <div className="space-y-3">
                        {channelSkus.map((sku, index) => (
                          <div key={sku.product_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                  #{index + 1}
                                </span>
                                <span className="text-xs font-medium text-gray-600">{sku.product_id}</span>
                              </div>
                              <p className="text-sm font-medium text-gray-900 truncate mt-1">
                                {sku.display_name}
                              </p>
                              <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                                <span>Units: {sku.units_sold}</span>
                                <span>Available: {sku.available_qty || 0}</span>
                                <span>Price: {formatCurrency(sku.price)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}