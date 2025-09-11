export interface MasterUpdateCandidate {
  upc_text: string
  item_name: string
  brand: string
  active_domestic_vendor_count_21d: number
  latest_domestic_total_qty_21d: number
  latest_domestic_min_price_21d: number | null
  latest_domestic_min_price_vendors_21d: string[]
  lifetime_vendor_count: number
  first_seen_global_date: string
  first_seen_global_vendors: string[]
  last_seen_global_date: string
  last_seen_global_vendors: string[]
}

export interface ItemsResponse {
  items: MasterUpdateCandidate[]
  kpis: {
    items_count: number
    domestic_vendor_total: number
    median_min_price: number | null
  }
  total: number
}

export interface VendorSnapshot {
  vendor: string
  last_date: string
  last_qty: number
  last_price: number | null
}

export interface CheapestVendor {
  vendor: string
  price: number
}

export interface ItemDetailsResponse {
  vendorSnapshots: VendorSnapshot[]
  cheapestVendors: CheapestVendor[]
}

export interface ItemFilters {
  q?: string
  minPrice?: number
  maxPrice?: number
  minVendors?: number
  onlyInSc?: boolean
  onlyNotInSc?: boolean
  firstFrom?: string
  firstTo?: string
  lastFrom?: string
  lastTo?: string
  sortCol?: string
  sortDir?: 'asc' | 'desc'
  limit?: number
  offset?: number
}