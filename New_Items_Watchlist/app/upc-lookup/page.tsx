'use client';

import { useState } from 'react';
import { Search, Download, Loader2, FileSpreadsheet, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface VendorOffer {
  vendor: string;
  price: number;
  qty: number;
  location: string;
  sku?: string;
}

interface ItemData {
  upc: string;
  item_name: string;
  brand: string;
  sku?: string | null;
  vendors: VendorOffer[];
  // Summary statistics
  medianPrice?: number;
  avgPrice?: number;
  lowestPrice?: number;
  lowestVendor?: string;
  lowestVendorQty?: number;
  vendorCount?: number;
}

interface ReportData {
  items: ItemData[];
  allVendors: string[];
  summary: {
    totalItems: number;
    itemsFound: number;
    itemsNotFound: number;
    uniqueVendors: number;
  };
}

export default function UPCLookupPage() {
  const router = useRouter();
  const [upcInput, setUpcInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFoundUPCs, setNotFoundUPCs] = useState<string[]>([]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const handleGenerateReport = async () => {
    setError(null);
    setNotFoundUPCs([]);

    // Parse UPCs from input
    const upcs = upcInput
      .split(/[\n,;\s]+/)
      .map(upc => upc.trim())
      .filter(upc => upc.length > 0);

    if (upcs.length === 0) {
      setError('Please enter at least one UPC');
      return;
    }

    if (upcs.length > 500) {
      setError('Please limit your search to 500 UPCs at a time');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/watchlist/batch-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ upcs })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API Error:', errorData);
        throw new Error(errorData.error || 'Failed to generate report');
      }

      const data = await response.json();
      setReportData(data.report);
      setNotFoundUPCs(data.notFound || []);
      setCurrentPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = async () => {
    if (!reportData) return;

    try {
      const response = await fetch('/api/watchlist/export-vendor-matrix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report: reportData })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vendor_comparison_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Export failed. Please try again.');
    }
  };

  // Paginate items
  const paginatedItems = reportData ?
    reportData.items.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    ) : [];

  const totalPages = reportData ?
    Math.ceil(reportData.items.length / itemsPerPage) : 0;

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
                title="Back to Dashboard"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">UPC Batch Lookup</h1>
                <p className="text-sm text-gray-500 mt-1">Search all vendor offers from the last 21 days for any UPC</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-8 h-8 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Input Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Enter UPCs</h2>
            <p className="text-sm text-gray-600">
              Paste your UPC list below (one per line, or separated by commas, spaces, or semicolons)
            </p>
          </div>

          <div className="space-y-4">
            <textarea
              className="w-full h-48 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              placeholder="Enter UPCs here...&#10;Example:&#10;012345678901&#10;023456789012&#10;034567890123"
              value={upcInput}
              onChange={(e) => setUpcInput(e.target.value)}
            />

            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">
                {upcInput.split(/[\n,;\s]+/).filter(u => u.trim()).length} UPCs entered
                {upcInput.split(/[\n,;\s]+/).filter(u => u.trim()).length > 500 && (
                  <span className="text-red-600 ml-2">(Maximum 500 UPCs allowed)</span>
                )}
              </div>
              <button
                onClick={handleGenerateReport}
                disabled={loading || !upcInput.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Generate Report
                  </>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>

        {/* Not Found UPCs */}
        {notFoundUPCs.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-medium text-yellow-900 mb-2">
              UPCs Not Found ({notFoundUPCs.length})
            </h3>
            <div className="text-xs text-yellow-800 font-mono">
              {notFoundUPCs.join(', ')}
            </div>
          </div>
        )}

        {/* Report Section */}
        {reportData && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-2xl font-bold text-gray-900">
                  {reportData.summary.totalItems}
                </div>
                <div className="text-sm text-gray-500">Total UPCs Searched</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-2xl font-bold text-green-600">
                  {reportData.summary.itemsFound}
                </div>
                <div className="text-sm text-gray-500">Items Found</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-2xl font-bold text-red-600">
                  {reportData.summary.itemsNotFound}
                </div>
                <div className="text-sm text-gray-500">Items Not Found</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-2xl font-bold text-blue-600">
                  {reportData.summary.uniqueVendors}
                </div>
                <div className="text-sm text-gray-500">Unique Vendors</div>
              </div>
            </div>

            {/* Vendor Comparison Table */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b flex justify-between items-center">
                <h2 className="text-lg font-semibold">Vendor Comparison Matrix</h2>
                <button
                  onClick={exportToExcel}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export to Excel
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">
                        UPC
                      </th>
                      <th className="sticky left-[100px] z-10 bg-gray-50 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">
                        Item Name
                      </th>
                      <th className="sticky left-[300px] z-10 bg-gray-50 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">
                        Brand
                      </th>
                      <th className="sticky left-[400px] z-10 bg-gray-50 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">
                        SKU
                      </th>
                      <th className="bg-gray-50 px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r">
                        Median Price
                      </th>
                      <th className="bg-gray-50 px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r">
                        Avg Price
                      </th>
                      <th className="bg-gray-50 px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r">
                        Lowest Price
                      </th>
                      <th className="bg-gray-50 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">
                        Lowest Vendor
                      </th>
                      <th className="bg-gray-50 px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r">
                        Qty Available
                      </th>
                      <th className="bg-gray-50 px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r">
                        Vendor Count
                      </th>
                      {reportData.allVendors.map(vendor => (
                        <th key={vendor} className="px-4 py-2 text-center border-r" colSpan={2}>
                          <div className="text-xs font-medium text-gray-700 uppercase tracking-wider">
                            {vendor}
                          </div>
                          <div className="flex">
                            <div className="flex-1 text-xs text-gray-500 py-1 border-r">Price</div>
                            <div className="flex-1 text-xs text-gray-500 py-1">Qty</div>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedItems.map((item, index) => (
                      <tr key={`${item.upc}-${index}`} className="hover:bg-gray-50">
                        <td className="sticky left-0 z-10 bg-white px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 border-r">
                          {item.upc}
                        </td>
                        <td className="sticky left-[100px] z-10 bg-white px-4 py-3 text-sm text-gray-900 border-r">
                          <div className="max-w-[180px] truncate" title={item.item_name}>
                            {item.item_name}
                          </div>
                        </td>
                        <td className="sticky left-[300px] z-10 bg-white px-4 py-3 whitespace-nowrap text-sm text-gray-900 border-r">
                          {item.brand}
                        </td>
                        <td className="sticky left-[400px] z-10 bg-white px-4 py-3 whitespace-nowrap text-sm border-r">
                          {item.sku ? (
                            <span className="font-medium text-green-600" title="Item exists in inventory">
                              {item.sku}
                            </span>
                          ) : (
                            <span className="text-gray-400">New Item</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-sm font-medium text-gray-900 border-r">
                          ${item.medianPrice?.toFixed(2) || '0.00'}
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-gray-900 border-r">
                          ${item.avgPrice?.toFixed(2) || '0.00'}
                        </td>
                        <td className="px-4 py-3 text-center text-sm font-bold text-green-600 border-r">
                          ${item.lowestPrice?.toFixed(2) || '0.00'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 border-r">
                          <div className="max-w-[120px] truncate" title={item.lowestVendor}>
                            {item.lowestVendor || '-'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-gray-900 border-r">
                          {item.lowestVendorQty || '-'}
                        </td>
                        <td className="px-4 py-3 text-center text-sm font-medium text-blue-600 border-r">
                          {item.vendorCount || 0}
                        </td>
                        {reportData.allVendors.map(vendor => {
                          const offer = item.vendors.find(v => v.vendor === vendor);
                          return (
                            <td key={`${item.upc}-${vendor}`} className="px-0 py-2 whitespace-nowrap text-sm border-r" colSpan={2}>
                              <div className="flex">
                                <div className="flex-1 px-2 text-center border-r">
                                  {offer ? (
                                    <span className="font-medium text-gray-900">
                                      ${offer.price.toFixed(2)}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </div>
                                <div className="flex-1 px-2 text-center">
                                  {offer ? (
                                    <span className="text-gray-600">
                                      {offer.qty || '-'}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </div>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t flex justify-between items-center">
                  <div className="text-sm text-gray-700">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, reportData.items.length)} of {reportData.items.length} items
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 flex items-center gap-1"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </button>
                    <div className="flex items-center px-3 py-1">
                      Page {currentPage} of {totalPages}
                    </div>
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 flex items-center gap-1"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}