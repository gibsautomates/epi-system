import Papa from 'papaparse'
import { MasterUpdateCandidate, ItemFilters } from '@/lib/types'

export function exportToCSV(items: MasterUpdateCandidate[], filters: ItemFilters) {
  // Prepare data for CSV
  const csvData = items.map(item => ({
    'UPC': item.upc_text,
    'Item Name': item.item_name,
    'Brand': item.brand,
    'Domestic Vendors (21d)': item.active_domestic_vendor_count_21d,
    'Total Qty (21d)': item.latest_domestic_total_qty_21d,
    'Min Price (21d)': item.latest_domestic_min_price_21d,
    'Cheapest Vendors': item.latest_domestic_min_price_vendors_21d.join('; '),
    'Lifetime Vendors': item.lifetime_vendor_count,
    'First Seen Date': item.first_seen_global_date,
    'First Seen Vendors': item.first_seen_global_vendors.join('; '),
    'Last Seen Date': item.last_seen_global_date,
    'Last Seen Vendors': item.last_seen_global_vendors.join('; '),
  }))

  // Convert to CSV
  const csv = Papa.unparse(csvData)

  // Create filename with filters
  const date = new Date().toISOString().split('T')[0]
  let filename = `candidates_domestic_${date}`
  
  if (filters.minVendors) {
    filename += `_minV${filters.minVendors}`
  }
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    filename += `_price${filters.minPrice || 0}-${filters.maxPrice || 'max'}`
  }
  if (filters.q) {
    filename += `_search`
  }
  
  filename += '.csv'

  // Download file
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}