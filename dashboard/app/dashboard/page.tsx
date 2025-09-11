'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, Download, Settings, TrendingUp, TrendingDown, Minus, Filter, X, ChevronDown, RefreshCw, Database, Package, CheckCircle, ChevronRight, ChevronUp } from 'lucide-react';

interface ItemData {
  upc: string;
  item_name: string;
  brand: string;
  sku?: string;
  lowest_price: number;
  min_price: number;
  avg_price: number;
  max_price: number;
  lowest_vendor: string;
  domestic_vendor_count: number;
  total_vendor_count: number;
  vendor_list: string[] | string;
  first_seen: string;
  last_seen: string;
  status: string;
  price_trend: 'up' | 'down' | 'stable' | 'new';
  price_change_pct: number;
  location: string;
  qty_available: number;
  status_streak?: number;
  times_seen?: number;
  vendor_change_status?: string;
}

interface DashboardMetrics {
  total_new_items: number;
  items_3plus_vendors: number;
  active_vendors: number;
  avg_price: number;
  last_update: string;
  vendor_offers_fetched?: number;
  inventory_records_fetched?: number;
  inventory_records_in_set?: number;
}

interface VendorOffer {
  vendor: string;
  price: number;
  qty: number;
  location: string;
  date: string;
  sku?: string;
  msrp?: number;
}

interface VendorBreakdown {
  vendors: VendorOffer[];
  summary: {
    total_vendors: number;
    domestic_vendors: number;
    international_vendors: number;
    lowest_price: number | null;
    highest_price: number | null;
    total_qty: number;
    domestic_qty: number;
    price_range: number;
  };
  upc: string;
}

// Column configuration
const ALL_COLUMNS = [
  { id: 'upc', label: 'UPC', group: 'basic', default: true },
  { id: 'item_name', label: 'Item Name', group: 'basic', default: true },
  { id: 'status', label: 'Status', group: 'tracking', default: true },
  { id: 'status_streak', label: 'Streak', group: 'tracking', default: true },
  { id: 'times_seen', label: 'Times Seen', group: 'tracking', default: false },
  { id: 'brand', label: 'Brand', group: 'basic', default: true },
  { id: 'lowest_price', label: 'Lowest Price', group: 'pricing', default: true },
  { id: 'avg_price', label: 'Avg Price', group: 'pricing', default: false },
  { id: 'max_price', label: 'Max Price', group: 'pricing', default: false },
  { id: 'lowest_vendor', label: 'Lowest Vendor', group: 'vendors', default: true },
  { id: 'domestic_vendor_count', label: 'Domestic Vendors', group: 'vendors', default: true },
  { id: 'vendor_list', label: 'All Vendors', group: 'vendors', default: false },
  { id: 'first_seen', label: 'First Seen', group: 'dates', default: false },
  { id: 'last_seen', label: 'Last Seen', group: 'dates', default: true },
  { id: 'price_trend', label: 'Price Trend', group: 'trends', default: true },
  { id: 'price_change_pct', label: 'Price Change %', group: 'trends', default: true },
  { id: 'qty_available', label: 'Qty Available', group: 'inventory', default: false },
];

export default function Dashboard() {
  // State management
  const [data, setData] = useState<ItemData[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);
  const [locationFilter, setLocationFilter] = useState<'all' | 'domestic' | 'international' | 'domestic_only' | 'international_only' | 'mixed'>('all');
  const [minVendorCount, setMinVendorCount] = useState(1);
  
  // Column management
  const [visibleColumns, setVisibleColumns] = useState<string[]>(
    ALL_COLUMNS.filter(col => col.default).map(col => col.id)
  );
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  
  // Saved views
  const [savedViews, setSavedViews] = useState<{name: string, config: any}[]>([]);
  const [currentView, setCurrentView] = useState<string>('default');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Vendor breakdown
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [vendorBreakdowns, setVendorBreakdowns] = useState<Map<string, VendorBreakdown>>(new Map());
  const [loadingVendors, setLoadingVendors] = useState<Set<string>>(new Set());

  // Load data
  useEffect(() => {
    fetchDashboardData();
    // Load saved views from localStorage
    const views = localStorage.getItem('watchlist_views');
    if (views) setSavedViews(JSON.parse(views));
  }, []);

  const fetchDashboardData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      // Add timestamp to prevent caching
      const response = await fetch(`/api/watchlist/dashboard-view?t=${Date.now()}`, {
        cache: 'no-store'
      });
      const result = await response.json();
      console.log('Dashboard data received:', {
        totalItems: result.items?.length,
        metrics: result.metrics
      });
      setData(result.items || []);
      setMetrics(result.metrics);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch vendor breakdown for specific item
  const fetchVendorBreakdown = async (upc: string) => {
    if (vendorBreakdowns.has(upc)) {
      return; // Already loaded
    }

    setLoadingVendors(prev => new Set([...prev, upc]));
    
    try {
      const response = await fetch(`/api/watchlist/item-vendors?upc=${encodeURIComponent(upc)}`);
      const result = await response.json();
      
      if (response.ok) {
        setVendorBreakdowns(prev => new Map([...prev, [upc, result]]));
      } else {
        console.error('Error fetching vendor breakdown:', result.error);
      }
    } catch (error) {
      console.error('Error fetching vendor breakdown:', error);
    } finally {
      setLoadingVendors(prev => {
        const newSet = new Set(prev);
        newSet.delete(upc);
        return newSet;
      });
    }
  };

  // Toggle row expansion
  const toggleRowExpansion = async (upc: string) => {
    const newExpandedRows = new Set(expandedRows);
    
    if (newExpandedRows.has(upc)) {
      newExpandedRows.delete(upc);
    } else {
      newExpandedRows.add(upc);
      // Fetch vendor data if not already loaded
      await fetchVendorBreakdown(upc);
    }
    
    setExpandedRows(newExpandedRows);
  };

  // Get unique vendors for filter
  const uniqueVendors = useMemo(() => {
    const vendors = new Set<string>();
    data.forEach(item => {
      // vendor_list is a comma-separated string from the view
      if (typeof item.vendor_list === 'string') {
        item.vendor_list.split(', ').forEach(v => vendors.add(v));
      } else if (Array.isArray(item.vendor_list)) {
        item.vendor_list.forEach(v => vendors.add(v));
      }
    });
    return Array.from(vendors).sort();
  }, [data]);

  // Calculate filtered metrics
  const filteredMetrics = useMemo(() => {
    const filtered = data.filter(item => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !item.upc.toLowerCase().includes(query) &&
          !item.item_name.toLowerCase().includes(query) &&
          !item.brand?.toLowerCase().includes(query) &&
          !item.sku?.toLowerCase().includes(query)
        ) {
          return false;
        }
      }

      // Vendor filter
      if (selectedVendors.length > 0) {
        const vendorList = Array.isArray(item.vendor_list) 
          ? item.vendor_list 
          : (typeof item.vendor_list === 'string' ? item.vendor_list.split(', ') : []);
        const hasSelectedVendor = selectedVendors.some(v => 
          vendorList.includes(v)
        );
        if (!hasSelectedVendor) return false;
      }

      // Location filter
      if (locationFilter === 'domestic') {
        // Show items that have at least one domestic vendor
        if (item.domestic_vendor_count === 0) {
          return false;
        }
      } else if (locationFilter === 'international') {
        // Show items that have at least one international vendor
        const internationalCount = item.total_vendor_count - item.domestic_vendor_count;
        if (internationalCount === 0) {
          return false;
        }
      } else if (locationFilter === 'domestic_only') {
        // Show ONLY items that have exclusively domestic vendors
        if (item.domestic_vendor_count === 0 || 
            item.total_vendor_count > item.domestic_vendor_count) {
          return false;
        }
      } else if (locationFilter === 'international_only') {
        // Show ONLY items that have exclusively international vendors
        if (item.domestic_vendor_count > 0) {
          return false;
        }
      } else if (locationFilter === 'mixed') {
        // Show items that have BOTH domestic AND international vendors
        const internationalCount = item.total_vendor_count - item.domestic_vendor_count;
        if (item.domestic_vendor_count === 0 || internationalCount === 0) {
          return false;
        }
      }

      // Vendor count filter
      if (item.domestic_vendor_count < minVendorCount) {
        return false;
      }

      return true;
    });
    
    // Calculate metrics for filtered data
    const metrics = {
      total_filtered: filtered.length,
      filtered_3plus: filtered.filter(item => item.domestic_vendor_count >= 3).length,
      filtered_vendors: new Set(filtered.flatMap(item => 
        Array.isArray(item.vendor_list) 
          ? item.vendor_list 
          : (typeof item.vendor_list === 'string' ? item.vendor_list.split(', ') : [])
      )).size,
      filtered_domestic: filtered.filter(item => item.domestic_vendor_count > 0).length,
      filtered_international: filtered.filter(item => 
        item.total_vendor_count > item.domestic_vendor_count
      ).length
    };
    
    return { data: filtered, metrics };
  }, [data, searchQuery, selectedVendors, locationFilter, minVendorCount]);
  
  const filteredData = filteredMetrics.data;

  // Paginated data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredData, currentPage]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  // Export to Excel
  const exportToExcel = async () => {
    try {
      console.log('Exporting data:', {
        totalFiltered: filteredData.length,
        totalOriginal: data.length,
        columns: visibleColumns.length
      });
      
      // Limit export to 10000 items to prevent memory issues
      const exportData = filteredData.slice(0, 10000);
      if (filteredData.length > 10000) {
        alert(`Export limited to first 10,000 items of ${filteredData.length} total. Use filters to narrow results for complete export.`);
      }
      
      const response = await fetch('/api/watchlist/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: exportData,
          columns: visibleColumns
        })
      });
      
      console.log('Export response status:', response.status);
      
      if (response.ok) {
        const blob = await response.blob();
        console.log('Blob size:', blob.size);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `watchlist_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        console.log('Download triggered successfully');
      } else {
        console.error('Export failed with status:', response.status);
        alert('Export failed. Please try again.');
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Export error: ' + error);
    }
  };

  // Save current view
  const saveView = () => {
    const viewName = prompt('Enter a name for this view:');
    if (viewName) {
      const newView = {
        name: viewName,
        config: {
          columns: visibleColumns,
          filters: {
            vendors: selectedVendors,
            location: locationFilter,
            minVendors: minVendorCount
          }
        }
      };
      const updatedViews = [...savedViews, newView];
      setSavedViews(updatedViews);
      localStorage.setItem('watchlist_views', JSON.stringify(updatedViews));
    }
  };

  // Load saved view
  const loadView = (viewConfig: any) => {
    setVisibleColumns(viewConfig.columns);
    setSelectedVendors(viewConfig.filters.vendors);
    setLocationFilter(viewConfig.filters.location);
    setMinVendorCount(viewConfig.filters.minVendors);
  };

  // Status badge component
  const StatusBadge = ({ status }: { status: string }) => {
    const colors = {
      new: 'bg-green-100 text-green-800',
      active: 'bg-blue-100 text-blue-800',
      missing: 'bg-red-100 text-red-800',
      reappeared: 'bg-yellow-100 text-yellow-800'
    };
    if (!status) {
      return <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Unknown</span>;
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  // Price trend icon
  const PriceTrendIcon = ({ trend, change }: { trend?: string; change?: number }) => {
    if (trend === 'new') {
      return (
        <div className="flex items-center text-blue-600">
          <span className="text-xs font-medium px-2 py-0.5 bg-blue-100 rounded">NEW</span>
        </div>
      );
    }
    if (!trend || trend === 'stable') {
      return (
        <div className="flex items-center text-gray-400">
          <Minus className="w-4 h-4 mr-1" />
          <span className="text-xs">0%</span>
        </div>
      );
    }
    if (trend === 'up') {
      return (
        <div className="flex items-center text-red-600">
          <TrendingUp className="w-4 h-4 mr-1" />
          <span className="text-xs font-medium">+{Math.abs(change || 0).toFixed(1)}%</span>
        </div>
      );
    } else if (trend === 'down') {
      return (
        <div className="flex items-center text-green-600">
          <TrendingDown className="w-4 h-4 mr-1" />
          <span className="text-xs font-medium">{(change || 0).toFixed(1)}%</span>
        </div>
      );
    }
    return (
      <div className="flex items-center text-gray-400">
        <Minus className="w-4 h-4 mr-1" />
        <span className="text-xs">0%</span>
      </div>
    );
  };

  // Vendor breakdown component
  const VendorBreakdown = ({ upc }: { upc: string }) => {
    const breakdown = vendorBreakdowns.get(upc);
    const isLoading = loadingVendors.has(upc);

    if (isLoading) {
      return (
        <tr>
          <td colSpan={visibleColumns.length} className="px-6 py-4 text-center text-gray-500">
            <div className="flex items-center justify-center">
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              Loading vendor details...
            </div>
          </td>
        </tr>
      );
    }

    if (!breakdown) {
      return (
        <tr>
          <td colSpan={visibleColumns.length} className="px-6 py-4 text-center text-gray-500">
            No vendor data available
          </td>
        </tr>
      );
    }

    const { vendors, summary } = breakdown;

    return (
      <tr className="bg-gray-50">
        <td colSpan={visibleColumns.length} className="px-6 py-4">
          <div className="space-y-4">
            {/* Summary stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="bg-white p-3 rounded">
                <div className="text-gray-500">Total Vendors</div>
                <div className="font-semibold">{summary.total_vendors}</div>
              </div>
              <div className="bg-white p-3 rounded">
                <div className="text-gray-500">Domestic Vendors</div>
                <div className="font-semibold">{summary.domestic_vendors}</div>
              </div>
              <div className="bg-white p-3 rounded">
                <div className="text-gray-500">Price Range</div>
                <div className="font-semibold">
                  {summary.lowest_price && summary.highest_price 
                    ? `$${summary.lowest_price.toFixed(2)} - $${summary.highest_price.toFixed(2)}`
                    : 'N/A'
                  }
                </div>
              </div>
              <div className="bg-white p-3 rounded">
                <div className="text-gray-500">Total Quantity</div>
                <div className="font-semibold">{summary.total_qty.toLocaleString()}</div>
              </div>
            </div>

            {/* Vendor details table */}
            <div className="bg-white rounded-lg border">
              <table className="min-w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {vendors.map((vendor, index) => {
                    const isLowestPrice = vendor.price === summary.lowest_price;
                    return (
                      <tr key={index} className={isLowestPrice ? 'bg-green-50' : ''}>
                        <td className="px-4 py-2 text-sm font-medium text-gray-900">
                          {vendor.vendor}
                          {isLowestPrice && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              Lowest
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900 font-semibold">
                          ${vendor.price.toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-500">
                          {vendor.qty ? vendor.qty.toLocaleString() : 'N/A'}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-500">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            vendor.location === 'Domestic' 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {vendor.location}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-500">
                          {new Date(vendor.date).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </td>
      </tr>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">New Items Watchlist Dashboard</h1>
            <div className="flex items-center gap-4">
              <button
                onClick={() => fetchDashboardData(true)}
                disabled={refreshing}
                className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </button>
              <div className="text-sm text-gray-500">
                Last Update: {metrics?.last_update ? new Date(metrics.last_update).toLocaleTimeString() : 'Loading...'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-3xl font-bold text-gray-900">
              {metrics?.total_new_items.toLocaleString()}
            </div>
            <div className="text-sm text-gray-500 mt-1">New Items</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-3xl font-bold text-green-600">
              {metrics?.items_3plus_vendors.toLocaleString()}
            </div>
            <div className="text-sm text-gray-500 mt-1">3+ Vendors</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-3xl font-bold text-blue-600">
              {metrics?.active_vendors}
            </div>
            <div className="text-sm text-gray-500 mt-1">Active Vendors</div>
          </div>
          
          {/* Data Fetch Summary */}
          <div className="bg-gray-100 rounded-lg p-4 border border-gray-300">
            <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
              <Database className="w-3 h-3" />
              Data Fetch Summary
            </div>
            <div className="space-y-1 text-xs text-gray-600">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Package className="w-3 h-3" />
                  Vendor Offers:
                </span>
                <span className="font-mono font-semibold">
                  {metrics?.vendor_offers_fetched?.toLocaleString() || '0'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Inventory:
                </span>
                <span className="font-mono font-semibold">
                  {metrics?.inventory_records_fetched?.toLocaleString() || '0'}
                </span>
              </div>
              <div className="flex items-center justify-between border-t pt-1 mt-1">
                <span className="text-[10px]">Unique Inventory:</span>
                <span className="font-mono text-[10px]">
                  {metrics?.inventory_records_in_set?.toLocaleString() || '0'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filtered Metrics Cards - Only show when filters are active */}
      {(searchQuery || selectedVendors.length > 0 || locationFilter !== 'all' || minVendorCount > 1) && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-900 mb-3">Filtered Results</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-900">
                  {filteredMetrics.metrics.total_filtered.toLocaleString()}
                </div>
                <div className="text-xs text-blue-700">Items</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-900">
                  {filteredMetrics.metrics.filtered_3plus.toLocaleString()}
                </div>
                <div className="text-xs text-blue-700">3+ Vendors</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-900">
                  {filteredMetrics.metrics.filtered_vendors}
                </div>
                <div className="text-xs text-blue-700">Vendors</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-900">
                  {filteredMetrics.metrics.filtered_domestic.toLocaleString()}
                </div>
                <div className="text-xs text-blue-700">Domestic</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-900">
                  {filteredMetrics.metrics.filtered_international.toLocaleString()}
                </div>
                <div className="text-xs text-blue-700">International</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search by UPC, Item Name, Brand, or SKU..."
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Filter Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Vendor Multi-select */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vendors
                </label>
                <select
                  multiple
                  className="w-full border rounded-lg p-2 h-24"
                  value={selectedVendors}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, option => option.value);
                    setSelectedVendors(selected);
                  }}
                >
                  {uniqueVendors.map(vendor => (
                    <option key={vendor} value={vendor}>{vendor}</option>
                  ))}
                </select>
              </div>

              {/* Location Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location
                </label>
                <select
                  className="w-full border rounded-lg p-2"
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value as any)}
                >
                  <option value="all">All Locations</option>
                  <option value="domestic">Has Domestic Vendors</option>
                  <option value="international">Has International Vendors</option>
                  <option value="mixed">Mixed (Both Domestic & International)</option>
                  <option value="domestic_only">Exclusively Domestic</option>
                  <option value="international_only">Exclusively International</option>
                </select>
              </div>

              {/* Vendor Count Slider */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Minimum Vendors: {minVendorCount}+
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={minVendorCount}
                  onChange={(e) => setMinVendorCount(Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>1</span>
                  <span>5</span>
                  <span>10+</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between items-center">
              <div className="space-x-2">
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedVendors([]);
                    setLocationFilter('all');
                    setMinVendorCount(1);
                  }}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Reset Filters
                </button>
                <button
                  onClick={saveView}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save View
                </button>
                {savedViews.length > 0 && (
                  <div className="inline-block relative">
                    <select
                      className="px-4 py-2 border rounded-lg"
                      onChange={(e) => {
                        const view = savedViews.find(v => v.name === e.target.value);
                        if (view) loadView(view.config);
                      }}
                    >
                      <option value="">Load View...</option>
                      {savedViews.map(view => (
                        <option key={view.name} value={view.name}>{view.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="text-sm text-gray-500">
                Showing {filteredData.length} of {data.length} items
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow">
          {/* Table Header */}
          <div className="px-6 py-4 border-b flex justify-between items-center">
            <h2 className="text-lg font-semibold">Items</h2>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowColumnSettings(!showColumnSettings)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center"
              >
                <Settings className="w-4 h-4 mr-2" />
                Columns
              </button>
              <button
                onClick={exportToExcel}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center"
              >
                <Download className="w-4 h-4 mr-2" />
                Export Excel
              </button>
            </div>
          </div>

          {/* Column Settings Panel */}
          {showColumnSettings && (
            <div className="px-6 py-4 bg-gray-50 border-b">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-medium">Customize Columns</h3>
                <button
                  onClick={() => setShowColumnSettings(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {ALL_COLUMNS.map(col => (
                  <label key={col.id} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={visibleColumns.includes(col.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setVisibleColumns([...visibleColumns, col.id]);
                        } else {
                          setVisibleColumns(visibleColumns.filter(c => c !== col.id));
                        }
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm">{col.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  {visibleColumns.includes('upc') && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      UPC
                    </th>
                  )}
                  {visibleColumns.includes('item_name') && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Item Name
                    </th>
                  )}
                  {visibleColumns.includes('brand') && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Brand
                    </th>
                  )}
                  {visibleColumns.includes('lowest_price') && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Lowest Price
                    </th>
                  )}
                  {visibleColumns.includes('avg_price') && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Avg
                    </th>
                  )}
                  {visibleColumns.includes('lowest_vendor') && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Lowest Vendor
                    </th>
                  )}
                  {visibleColumns.includes('domestic_vendor_count') && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Vendors
                    </th>
                  )}
                  {visibleColumns.includes('status') && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  )}
                  {visibleColumns.includes('status_streak') && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Streak
                    </th>
                  )}
                  {visibleColumns.includes('times_seen') && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Times Seen
                    </th>
                  )}
                  {visibleColumns.includes('price_trend') && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Trend
                    </th>
                  )}
                  {visibleColumns.includes('price_change_pct') && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Change %
                    </th>
                  )}
                  {visibleColumns.includes('vendor_list') && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      All Vendors
                    </th>
                  )}
                  {visibleColumns.includes('first_seen') && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      First Seen
                    </th>
                  )}
                  {visibleColumns.includes('last_seen') && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Seen
                    </th>
                  )}
                  {visibleColumns.includes('qty_available') && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Qty Available
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedData.map((item, index) => {
                  const isExpanded = expandedRows.has(item.upc);
                  return (
                    <>
                      <tr key={`${item.upc}-${index}`} className="hover:bg-gray-50">
                        {visibleColumns.includes('upc') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            <div className="flex items-center">
                              <button
                                onClick={() => toggleRowExpansion(item.upc)}
                                className="mr-2 p-1 hover:bg-gray-200 rounded transition-colors"
                                title="View vendor breakdown"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-gray-500" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-gray-500" />
                                )}
                              </button>
                              {item.upc}
                            </div>
                          </td>
                        )}
                    {visibleColumns.includes('item_name') && (
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="max-w-xs truncate" title={item.item_name}>
                          {item.item_name}
                        </div>
                      </td>
                    )}
                    {visibleColumns.includes('brand') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.brand}
                      </td>
                    )}
                    {visibleColumns.includes('lowest_price') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.lowest_price ? `$${item.lowest_price.toFixed(2)}` : 'N/A'}
                      </td>
                    )}
                    {visibleColumns.includes('avg_price') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.avg_price ? `$${item.avg_price.toFixed(2)}` : 'N/A'}
                      </td>
                    )}
                    {visibleColumns.includes('lowest_vendor') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.lowest_vendor}
                      </td>
                    )}
                    {visibleColumns.includes('domestic_vendor_count') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.domestic_vendor_count}/{item.total_vendor_count}
                      </td>
                    )}
                    {visibleColumns.includes('status') && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={item.status} />
                      </td>
                    )}
                    {visibleColumns.includes('status_streak') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                          {item.status_streak || 1}
                        </span>
                      </td>
                    )}
                    {visibleColumns.includes('times_seen') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.times_seen || 1}
                      </td>
                    )}
                    {visibleColumns.includes('price_trend') && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <PriceTrendIcon trend={item.price_trend} change={item.price_change_pct} />
                      </td>
                    )}
                    {visibleColumns.includes('price_change_pct') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`font-medium ${
                          item.price_change_pct > 0 ? 'text-red-600' : 
                          item.price_change_pct < 0 ? 'text-green-600' : 
                          'text-gray-500'
                        }`}>
                          {item.price_change_pct !== 0 ? 
                            `${item.price_change_pct > 0 ? '+' : ''}${item.price_change_pct.toFixed(1)}%` : 
                            '0%'
                          }
                        </span>
                      </td>
                    )}
                    {visibleColumns.includes('vendor_list') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="max-w-xs truncate" title={Array.isArray(item.vendor_list) ? item.vendor_list.join(', ') : item.vendor_list}>
                          {Array.isArray(item.vendor_list) ? item.vendor_list.join(', ') : item.vendor_list}
                        </div>
                      </td>
                    )}
                    {visibleColumns.includes('first_seen') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(item.first_seen).toLocaleDateString()}
                      </td>
                    )}
                    {visibleColumns.includes('last_seen') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(item.last_seen).toLocaleDateString()}
                      </td>
                    )}
                    {visibleColumns.includes('qty_available') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.qty_available ? item.qty_available.toLocaleString() : 'N/A'}
                      </td>
                    )}
                      </tr>
                      {isExpanded && <VendorBreakdown upc={item.upc} />}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t flex justify-between items-center">
              <div className="text-sm text-gray-700">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}