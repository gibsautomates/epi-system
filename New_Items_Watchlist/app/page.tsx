'use client';

import { useRouter } from 'next/navigation';
import { Package, ShoppingCart, TrendingUp, FileText, BarChart3, Users, Send, Database, FileSpreadsheet } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();

  const reports = [
    {
      title: 'New Items Watchlist',
      description: 'Track vendor offers for items not in inventory. Monitor price trends and vendor changes.',
      icon: Package,
      route: '/new_items_list',
      color: 'bg-blue-500',
      stats: 'Track new inventory items'
    },
    {
      title: 'Order Summary',
      description: 'View daily orders, track fulfillment status, and analyze order patterns.',
      icon: ShoppingCart,
      route: '/orders',
      color: 'bg-green-500',
      stats: 'Active'
    },
    {
      title: 'UPC Batch Lookup',
      description: 'Generate vendor comparison reports for multiple UPCs. Paste UPC list and see all vendor prices in a matrix view.',
      icon: FileSpreadsheet,
      route: '/upc-lookup',
      color: 'bg-indigo-500',
      stats: 'New Feature'
    },
    {
      title: 'Consolidate Needlist',
      description: 'Send needlist files to vendors and track their responses. Manage SKU, UPC, item details with vendor pricing and quantity offers.',
      icon: Send,
      route: '/needlist',
      color: 'bg-purple-500',
      stats: 'Coming Soon'
    },
    {
      title: 'Master File Generator',
      description: 'Generate comprehensive master files including all inventory items, new items, vendor information, and sales reports.',
      icon: Database,
      route: '/master-file',
      color: 'bg-orange-500',
      stats: 'Coming Soon'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">EPI Dashboard</h1>
              <p className="mt-1 text-sm text-gray-500">Select a report to view detailed analytics</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Last Update</p>
              <p className="text-lg font-semibold text-gray-900">{new Date().toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Report Cards Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Report Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reports.map((report) => {
            const Icon = report.icon;
            return (
              <div
                key={report.route}
                onClick={() => {
                  if (report.stats !== 'Coming Soon') {
                    router.push(report.route);
                  }
                }}
                className={`bg-white rounded-lg shadow overflow-hidden group ${
                  report.stats !== 'Coming Soon'
                    ? 'hover:shadow-lg transition-shadow cursor-pointer'
                    : 'opacity-75 cursor-not-allowed'
                }`}
              >
                <div className={`h-2 ${report.color}`} />
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-3 rounded-lg ${report.color} bg-opacity-10`}>
                      <Icon className={`h-6 w-6 ${report.color.replace('bg-', 'text-')}`} />
                    </div>
                    {report.stats !== 'Coming Soon' && (
                      <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-1 rounded">
                        Active
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-600">
                    {report.title}
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    {report.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-500">
                      {report.stats}
                    </span>
                    <svg
                      className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-transform"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-gray-500">
          <p>EPI Dashboard © {new Date().getFullYear()} | Data refreshes every 15 minutes</p>
        </div>
      </div>
    </div>
  );
}