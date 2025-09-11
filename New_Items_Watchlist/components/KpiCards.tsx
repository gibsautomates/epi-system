"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, Package, Users } from "lucide-react"

interface KpiCardsProps {
  domesticVendorTotal: number
  itemsCount: number
  medianMinPrice: number | null
}

export function KpiCards({ domesticVendorTotal, itemsCount, medianMinPrice }: KpiCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Domestic vendors (≤21d)
          </CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{domesticVendorTotal.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">
            Sum of active vendor counts
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Items in list</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{itemsCount.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">
            After applied filters
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Median min price</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {medianMinPrice !== null ? `$${medianMinPrice.toFixed(2)}` : 'N/A'}
          </div>
          <p className="text-xs text-muted-foreground">
            Across visible rows
          </p>
        </CardContent>
      </Card>
    </div>
  )
}