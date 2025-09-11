"use client"

import { useEffect, useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { MasterUpdateCandidate, ItemDetailsResponse } from "@/lib/types"
import { Code, DollarSign, Calendar, Package } from "lucide-react"
import { toast } from "@/components/ui/use-toast"

interface DetailsDrawerProps {
  item: MasterUpdateCandidate | null
  isOpen: boolean
  onClose: () => void
}

export function DetailsDrawer({ item, isOpen, onClose }: DetailsDrawerProps) {
  const [details, setDetails] = useState<ItemDetailsResponse | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (item && isOpen) {
      fetchDetails()
    }
  }, [item, isOpen])

  const fetchDetails = async () => {
    if (!item) return
    
    setLoading(true)
    try {
      const response = await fetch(`/api/items/${encodeURIComponent(item.upc_text)}`)
      if (!response.ok) throw new Error('Failed to fetch details')
      const data = await response.json()
      setDetails(data)
    } catch (error) {
      console.error('Error fetching details:', error)
      toast({
        title: "Error",
        description: "Failed to load item details",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const showSQL = () => {
    if (!item) return
    const sql = `
-- Latest domestic vendors (≤21d)
WITH today AS (SELECT CURRENT_DATE AS d),
domestic AS (
  SELECT vendor FROM public.vendors_expected
  WHERE COALESCE(location,'')='Domestic' 
    AND COALESCE(active,TRUE)=TRUE
),
latest_per_vendor AS (
  SELECT DISTINCT ON (v.vendor)
    v.vendor, v.date::date AS last_date,
    COALESCE(v.qty,0) AS last_qty, v.price AS last_price
  FROM public.vendor_offers v
  JOIN domestic d ON d.vendor = v.vendor
  JOIN today t ON TRUE
  WHERE public.normalize_upc(v.upc::text) = '${item.upc_text}'
    AND v.date BETWEEN t.d - INTERVAL '21 days' AND t.d
  ORDER BY v.vendor, v.date DESC
)
SELECT * FROM latest_per_vendor ORDER BY vendor;
    `.trim()
    
    navigator.clipboard.writeText(sql)
    toast({
      title: "SQL Copied!",
      description: "Query copied to clipboard",
    })
  }

  if (!item) return null

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{item.item_name}</SheetTitle>
          <SheetDescription>
            <div className="space-y-1">
              <div>Brand: {item.brand}</div>
              <div className="font-mono">UPC: {item.upc_text}</div>
            </div>
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Cheapest Price Card */}
          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold">Cheapest domestic price (≤21d)</h3>
            </div>
            <div className="text-2xl font-bold">
              {item.latest_domestic_min_price_21d 
                ? `$${item.latest_domestic_min_price_21d.toFixed(2)}`
                : 'N/A'}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {item.latest_domestic_min_price_vendors_21d.join(', ')}
            </div>
          </div>

          {/* Vendor Snapshots Table */}
          {loading ? (
            <div className="text-center py-4">Loading details...</div>
          ) : details ? (
            <>
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  Per-vendor latest snapshot (≤21d, domestic only)
                </h3>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Last Date</TableHead>
                        <TableHead>Last Qty</TableHead>
                        <TableHead>Last Price</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {details.vendorSnapshots.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">
                            No recent vendor data
                          </TableCell>
                        </TableRow>
                      ) : (
                        details.vendorSnapshots.map((snapshot) => (
                          <TableRow key={snapshot.vendor}>
                            <TableCell>{snapshot.vendor}</TableCell>
                            <TableCell>{new Date(snapshot.last_date).toLocaleDateString()}</TableCell>
                            <TableCell>{snapshot.last_qty}</TableCell>
                            <TableCell>
                              {snapshot.last_price ? `$${snapshot.last_price.toFixed(2)}` : 'N/A'}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* All-time Cheapest */}
              {details.cheapestVendors.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">All-time cheapest vendors</h3>
                  <div className="rounded-lg border p-3">
                    {details.cheapestVendors.map((vendor) => (
                      <div key={vendor.vendor} className="flex justify-between py-1">
                        <span>{vendor.vendor}</span>
                        <span className="font-medium">${vendor.price.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}

          {/* History Chips */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold">History</h3>
            </div>
            <div className="space-y-2">
              <div className="rounded-lg bg-muted px-3 py-2">
                <div className="text-sm font-medium">First seen globally</div>
                <div className="text-sm text-muted-foreground">
                  {new Date(item.first_seen_global_date).toLocaleDateString()} - {item.first_seen_global_vendors.join(', ')}
                </div>
              </div>
              <div className="rounded-lg bg-muted px-3 py-2">
                <div className="text-sm font-medium">Last seen globally</div>
                <div className="text-sm text-muted-foreground">
                  {new Date(item.last_seen_global_date).toLocaleDateString()} - {item.last_seen_global_vendors.join(', ')}
                </div>
              </div>
            </div>
          </div>

          {/* SQL Button */}
          <Button onClick={showSQL} className="w-full">
            <Code className="h-4 w-4 mr-2" />
            Open in SQL
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}