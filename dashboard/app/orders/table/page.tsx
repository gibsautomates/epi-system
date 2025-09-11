'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Download, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ChannelData {
  channel_code: string;
  channel_name: string;
  today_orders: number;
  today_revenue: number;
  yesterday_orders: number;
  yesterday_revenue: number;
  lastweek_orders: number;
  lastweek_revenue: number;
  orders_change_vs_yesterday: number;
  orders_change_vs_lastweek: number;
  revenue_change_vs_yesterday: number;
  revenue_change_vs_lastweek: number;
}

interface ApiResponse {
  success: boolean;
  date: string;
  channels: ChannelData[];
  totals: {
    today_orders: number;
    today_revenue: number;
    yesterday_orders: number;
    yesterday_revenue: number;
    lastweek_orders: number;
    lastweek_revenue: number;
  };
}

export default function OrdersTablePage() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [showAllChannels, setShowAllChannels] = useState(true);

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/orders/comparison?date=${selectedDate}`);
      const result = await response.json();
      
      if (result.success) {
        setData(result);
        // Initialize selected channels with all available channels
        if (showAllChannels && result.channels) {
          setSelectedChannels(result.channels.map((c: ChannelData) => c.channel_code));
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChannelToggle = (channelCode: string) => {
    if (selectedChannels.includes(channelCode)) {
      setSelectedChannels(selectedChannels.filter(code => code !== channelCode));
      setShowAllChannels(false);
    } else {
      const newSelected = [...selectedChannels, channelCode];
      setSelectedChannels(newSelected);
      setShowAllChannels(newSelected.length === data?.channels.length);
    }
  };

  const handleSelectAll = () => {
    if (showAllChannels) {
      setSelectedChannels([]);
      setShowAllChannels(false);
    } else {
      setSelectedChannels(data?.channels.map(c => c.channel_code) || []);
      setShowAllChannels(true);
    }
  };

  const filteredChannels = data?.channels.filter(channel => 
    selectedChannels.includes(channel.channel_code)
  ) || [];

  // Calculate filtered totals
  const filteredTotals = filteredChannels.reduce((acc, channel) => ({
    today_orders: acc.today_orders + channel.today_orders,
    yesterday_orders: acc.yesterday_orders + channel.yesterday_orders,
    lastweek_orders: acc.lastweek_orders + channel.lastweek_orders,
  }), {
    today_orders: 0,
    yesterday_orders: 0,
    lastweek_orders: 0,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    if (value === 0) return '0%';
    const formatted = Math.abs(value).toFixed(1);
    return `${value > 0 ? '+' : '-'}${formatted}%`;
  };

  const getPercentageColor = (value: number) => {
    if (value > 0) return 'text-green-600';
    if (value < 0) return 'text-red-600';
    return 'text-gray-500';
  };

  const getPercentageIcon = (value: number) => {
    if (value > 0) return <TrendingUp className="h-4 w-4" />;
    if (value < 0) return <TrendingDown className="h-4 w-4" />;
    return <Minus className="h-4 w-4" />;
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
                <h1 className="text-2xl font-bold text-gray-900">Orders Comparison Table</h1>
                <p className="text-sm text-gray-500">Today vs Yesterday vs Last Week</p>
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

      {/* Channel Filter */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 bg-white border-b">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Channel Filter</h3>
          <button
            onClick={handleSelectAll}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {showAllChannels ? 'Deselect All' : 'Select All'}
          </button>
        </div>
        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {data.channels.map((channel) => (
              <label key={channel.channel_code} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedChannels.includes(channel.channel_code)}
                  onChange={() => handleChannelToggle(channel.channel_code)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{channel.channel_name}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {data && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <h3 className="text-sm font-medium text-blue-900 mb-2">Today</h3>
              <p className="text-2xl font-bold text-blue-900">{filteredTotals.today_orders}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h3 className="text-sm font-medium text-gray-900 mb-2">Yesterday</h3>
              <p className="text-2xl font-bold text-gray-900">{filteredTotals.yesterday_orders}</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
              <h3 className="text-sm font-medium text-purple-900 mb-2">Last Week</h3>
              <p className="text-2xl font-bold text-purple-900">{filteredTotals.lastweek_orders}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-500">Loading comparison data...</p>
          </div>
        ) : data?.channels.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Available</h3>
            <p className="text-sm text-gray-500">
              No orders found for {selectedDate}. Try selecting a different date.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Channel
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Today
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Yesterday
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      vs Yesterday
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Week
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      vs Last Week
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredChannels.map((channel, index) => (
                    <tr key={channel.channel_code} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{channel.channel_name}</div>
                      </td>
                      
                      {/* Today */}
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-lg font-bold text-gray-900">{channel.today_orders}</div>
                      </td>
                      
                      {/* Yesterday */}
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-lg font-medium text-gray-700">{channel.yesterday_orders}</div>
                      </td>
                      
                      {/* vs Yesterday */}
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className={`flex items-center justify-center gap-1 text-sm font-medium ${getPercentageColor(channel.orders_change_vs_yesterday)}`}>
                          {getPercentageIcon(channel.orders_change_vs_yesterday)}
                          <span>{formatPercentage(channel.orders_change_vs_yesterday)}</span>
                        </div>
                      </td>
                      
                      {/* Last Week */}
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-lg font-medium text-gray-700">{channel.lastweek_orders}</div>
                      </td>
                      
                      {/* vs Last Week */}
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className={`flex items-center justify-center gap-1 text-sm font-medium ${getPercentageColor(channel.orders_change_vs_lastweek)}`}>
                          {getPercentageIcon(channel.orders_change_vs_lastweek)}
                          <span>{formatPercentage(channel.orders_change_vs_lastweek)}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}