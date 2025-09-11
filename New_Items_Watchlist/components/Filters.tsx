"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { ItemFilters } from "@/lib/types"
import { Search, RotateCcw, Filter } from "lucide-react"

interface FiltersProps {
  filters: ItemFilters
  onFiltersChange: (filters: ItemFilters) => void
}

export function Filters({ filters, onFiltersChange }: FiltersProps) {
  const [localSearch, setLocalSearch] = useState(filters.q || '')
  
  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== filters.q) {
        onFiltersChange({ ...filters, q: localSearch || undefined })
      }
    }, 300)
    
    return () => clearTimeout(timer)
  }, [localSearch])

  const handleReset = () => {
    setLocalSearch('')
    onFiltersChange({
      sortCol: 'latest_domestic_min_price_21d',
      sortDir: 'asc',
      limit: 50,
      offset: 0,
    })
  }

  return (
    <div className="sticky top-0 z-10 bg-background border-b">
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Filters</h2>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Search */}
          <div className="space-y-2">
            <Label htmlFor="search">Search</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search items, brands, UPC..."
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {/* Price Range */}
          <div className="space-y-2">
            <Label>Price Range</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Min"
                value={filters.minPrice || ''}
                onChange={(e) => onFiltersChange({
                  ...filters,
                  minPrice: e.target.value ? Number(e.target.value) : undefined
                })}
              />
              <Input
                type="number"
                placeholder="Max"
                value={filters.maxPrice || ''}
                onChange={(e) => onFiltersChange({
                  ...filters,
                  maxPrice: e.target.value ? Number(e.target.value) : undefined
                })}
              />
            </div>
          </div>

          {/* Min Vendors */}
          <div className="space-y-2">
            <Label htmlFor="minVendors">
              Min Domestic Vendors: {filters.minVendors || 0}
            </Label>
            <Slider
              id="minVendors"
              min={0}
              max={20}
              step={1}
              value={[filters.minVendors || 0]}
              onValueChange={(value) => onFiltersChange({
                ...filters,
                minVendors: value[0] || undefined
              })}
            />
          </div>

          {/* Date Range */}
          <div className="space-y-2">
            <Label>First Seen Date Range</Label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={filters.firstFrom || ''}
                onChange={(e) => onFiltersChange({
                  ...filters,
                  firstFrom: e.target.value || undefined
                })}
              />
              <Input
                type="date"
                value={filters.firstTo || ''}
                onChange={(e) => onFiltersChange({
                  ...filters,
                  firstTo: e.target.value || undefined
                })}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-4 items-center">
          {/* Toggles */}
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.onlyInSc || false}
                onChange={(e) => onFiltersChange({
                  ...filters,
                  onlyInSc: e.target.checked,
                  onlyNotInSc: e.target.checked ? false : filters.onlyNotInSc
                })}
                className="rounded"
              />
              <span className="text-sm">Only items ever in Sellercloud</span>
            </label>
            
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.onlyNotInSc || false}
                onChange={(e) => onFiltersChange({
                  ...filters,
                  onlyNotInSc: e.target.checked,
                  onlyInSc: e.target.checked ? false : filters.onlyInSc
                })}
                className="rounded"
              />
              <span className="text-sm">Only net-new to Sellercloud</span>
            </label>
          </div>

          {/* Reset Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="ml-auto"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset Filters
          </Button>
        </div>
      </div>
    </div>
  )
}