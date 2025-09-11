"use client"

import { useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { MasterUpdateCandidate, ItemFilters } from "@/lib/types"
import { ArrowUpDown, Copy, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react"
import { toast } from "@/components/ui/use-toast"

interface ItemsTableProps {
  items: MasterUpdateCandidate[]
  filters: ItemFilters
  onFiltersChange: (filters: ItemFilters) => void
  onItemClick: (item: MasterUpdateCandidate) => void
  total: number
}

export function ItemsTable({ 
  items, 
  filters, 
  onFiltersChange, 
  onItemClick,
  total 
}: ItemsTableProps) {
  const handleSort = (column: string) => {
    const newDir = filters.sortCol === column && filters.sortDir === 'asc' ? 'desc' : 'asc'
    onFiltersChange({
      ...filters,
      sortCol: column,
      sortDir: newDir,
    })
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    })
  }

  const renderVendorList = (vendors: string[]) => {
    if (!vendors || vendors.length === 0) return 'N/A'
    const display = vendors.slice(0, 2).join('; ')
    const remaining = vendors.length > 2 ? `+${vendors.length - 2} more` : ''
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger className="cursor-help">
            {display} {remaining && <span className="text-muted-foreground">{remaining}</span>}
          </TooltipTrigger>
          <TooltipContent>
            <div className="max-w-xs">
              {vendors.join('; ')}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  const formatDate = (date: string) => {
    if (!date) return 'N/A'
    return new Date(date).toLocaleDateString()
  }

  const formatPrice = (price: number | null) => {
    if (price === null) return 'N/A'
    return `$${price.toFixed(2)}`
  }

  const currentPage = Math.floor((filters.offset || 0) / (filters.limit || 50)) + 1
  const totalPages = Math.ceil(total / (filters.limit || 50))

  const handlePreviousPage = () => {
    if (filters.offset && filters.offset > 0) {
      onFiltersChange({
        ...filters,
        offset: Math.max(0, filters.offset - (filters.limit || 50))
      })
    }
  }

  const handleNextPage = () => {
    const nextOffset = (filters.offset || 0) + (filters.limit || 50)
    if (nextOffset < total) {
      onFiltersChange({
        ...filters,
        offset: nextOffset
      })
    }
  }

  const sortableColumns = [
    'latest_domestic_min_price_21d',
    'active_domestic_vendor_count_21d',
    'last_seen_global_date'
  ]

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>UPC</TableHead>
              <TableHead>Item Name</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead 
                className={sortableColumns.includes('active_domestic_vendor_count_21d') ? "cursor-pointer" : ""}
                onClick={() => handleSort('active_domestic_vendor_count_21d')}
              >
                <div className="flex items-center gap-1">
                  Domestic Vendors (21d)
                  <ArrowUpDown className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead>Total Qty (21d)</TableHead>
              <TableHead 
                className={sortableColumns.includes('latest_domestic_min_price_21d') ? "cursor-pointer" : ""}
                onClick={() => handleSort('latest_domestic_min_price_21d')}
              >
                <div className="flex items-center gap-1">
                  Min Price (21d)
                  <ArrowUpDown className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead>Cheapest Vendors</TableHead>
              <TableHead>Lifetime Vendors</TableHead>
              <TableHead>First Seen</TableHead>
              <TableHead 
                className={sortableColumns.includes('last_seen_global_date') ? "cursor-pointer" : ""}
                onClick={() => handleSort('last_seen_global_date')}
              >
                <div className="flex items-center gap-1">
                  Last Seen
                  <ArrowUpDown className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                  No domestic vendors in the last 21 days with items we're not currently stocking. Try widening filters.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow 
                  key={item.upc_text}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onItemClick(item)}
                >
                  <TableCell className="font-mono">{item.upc_text}</TableCell>
                  <TableCell className="max-w-xs truncate">{item.item_name}</TableCell>
                  <TableCell>{item.brand}</TableCell>
                  <TableCell>{item.active_domestic_vendor_count_21d}</TableCell>
                  <TableCell>{item.latest_domestic_total_qty_21d}</TableCell>
                  <TableCell>{formatPrice(item.latest_domestic_min_price_21d)}</TableCell>
                  <TableCell>{renderVendorList(item.latest_domestic_min_price_vendors_21d)}</TableCell>
                  <TableCell>{item.lifetime_vendor_count}</TableCell>
                  <TableCell>{formatDate(item.first_seen_global_date)}</TableCell>
                  <TableCell>{formatDate(item.last_seen_global_date)}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(item.upc_text, 'UPC')}
                        title="Copy UPC"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(
                          item.latest_domestic_min_price_vendors_21d.join('; '),
                          'Vendors'
                        )}
                        title="Copy cheapest vendors"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {((filters.offset || 0) + 1)} to {Math.min((filters.offset || 0) + (filters.limit || 50), total)} of {total} items
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreviousPage}
            disabled={!filters.offset || filters.offset === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <div className="flex items-center px-3 text-sm">
            Page {currentPage} of {totalPages}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextPage}
            disabled={(filters.offset || 0) + (filters.limit || 50) >= total}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  )
}