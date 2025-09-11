"use client"

import { useState, useEffect, useCallback } from "react"
import { KpiCards } from "@/components/KpiCards"
import { Filters } from "@/components/Filters"
import { ItemsTable } from "@/components/ItemsTable"
import { DetailsDrawer } from "@/components/DetailsDrawer"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/use-toast"
import { ItemFilters, ItemsResponse, MasterUpdateCandidate } from "@/lib/types"
import { exportToCSV } from "@/lib/csv"
import { Download, RefreshCw } from "lucide-react"

export default function Home() {
  const [filters, setFilters] = useState<ItemFilters>({
    sortCol: 'latest_domestic_min_price_21d',
    sortDir: 'asc',
    limit: 50,
    offset: 0,
  })
  
  const [data, setData] = useState<ItemsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedItem, setSelectedItem] = useState<MasterUpdateCandidate | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      
      // Add all filter parameters
      if (filters.q) params.append('q', filters.q)
      if (filters.minPrice !== undefined) params.append('minPrice', filters.minPrice.toString())
      if (filters.maxPrice !== undefined) params.append('maxPrice', filters.maxPrice.toString())
      if (filters.minVendors !== undefined) params.append('minVendors', filters.minVendors.toString())
      if (filters.onlyInSc) params.append('onlyInSc', 'true')
      if (filters.onlyNotInSc) params.append('onlyNotInSc', 'true')
      if (filters.firstFrom) params.append('firstFrom', filters.firstFrom)
      if (filters.firstTo) params.append('firstTo', filters.firstTo)
      if (filters.lastFrom) params.append('lastFrom', filters.lastFrom)
      if (filters.lastTo) params.append('lastTo', filters.lastTo)
      if (filters.sortCol) params.append('sortCol', filters.sortCol)
      if (filters.sortDir) params.append('sortDir', filters.sortDir)
      if (filters.limit) params.append('limit', filters.limit.toString())
      if (filters.offset) params.append('offset', filters.offset.toString())

      const response = await fetch(`/api/items?${params}`)
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch data')
      }
      
      const result: ItemsResponse = await response.json()
      setData(result)
    } catch (error) {
      console.error('Error fetching data:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleFiltersChange = (newFilters: ItemFilters) => {
    // Reset pagination when filters change (except for pagination itself)
    if (newFilters.offset === filters.offset && 
        newFilters.limit === filters.limit) {
      setFilters({ ...newFilters, offset: 0 })
    } else {
      setFilters(newFilters)
    }
  }

  const handleItemClick = (item: MasterUpdateCandidate) => {
    setSelectedItem(item)
    setDrawerOpen(true)
  }

  const handleExportCSV = async () => {
    if (!data?.items || data.items.length === 0) {
      toast({
        title: "No data to export",
        description: "Please apply filters to get some data first",
      })
      return
    }

    // For large exports, we might want to fetch all data
    if (data.total > data.items.length) {
      toast({
        title: "Exporting visible rows",
        description: `Exporting ${data.items.length} of ${data.total} total items`,
      })
    }

    exportToCSV(data.items, filters)
    toast({
      title: "Export successful",
      description: `Exported ${data.items.length} items to CSV`,
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Domestic Items Watchlist</h1>
              <p className="text-muted-foreground">
                Not-in-stock item candidates from domestic vendors
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleExportCSV}
                disabled={!data?.items || data.items.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button
                variant="outline"
                onClick={fetchData}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Filters filters={filters} onFiltersChange={handleFiltersChange} />

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* KPI Cards */}
        <KpiCards
          domesticVendorTotal={data?.kpis.domestic_vendor_total || 0}
          itemsCount={data?.kpis.items_count || 0}
          medianMinPrice={data?.kpis.median_min_price || null}
        />

        {/* Items Table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ItemsTable
            items={data?.items || []}
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onItemClick={handleItemClick}
            total={data?.total || 0}
          />
        )}
      </div>

      {/* Details Drawer */}
      <DetailsDrawer
        item={selectedItem}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  )
}