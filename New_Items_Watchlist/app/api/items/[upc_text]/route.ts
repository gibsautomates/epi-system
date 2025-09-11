import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { ItemDetailsResponse, VendorSnapshot, CheapestVendor } from '@/lib/types'

export async function GET(
  request: NextRequest,
  { params }: { params: { upc_text: string } }
) {
  try {
    const upcText = params.upc_text

    // For vendor snapshots, we'll fetch from vendor_offers with filters
    // In production, you'd want to use a function or view for this complex query
    const twentyOneDaysAgo = new Date()
    twentyOneDaysAgo.setDate(twentyOneDaysAgo.getDate() - 21)
    const dateStr = twentyOneDaysAgo.toISOString().split('T')[0]

    // First get domestic vendors
    const { data: domesticVendors, error: vendorError } = await supabase
      .from('vendors_expected')
      .select('vendor')
      .eq('location', 'Domestic')
      .eq('active', true)

    if (vendorError) {
      console.error('Vendor error:', vendorError)
      throw vendorError
    }

    const domesticVendorNames = domesticVendors?.map(v => v.vendor) || []

    // Get latest offers for each domestic vendor
    const { data: offers, error: offersError } = await supabase
      .from('vendor_offers')
      .select('vendor, date, qty, price, upc')
      .in('vendor', domesticVendorNames)
      .gte('date', dateStr)
      .order('date', { ascending: false })

    if (offersError) {
      console.error('Offers error:', offersError)
      throw offersError
    }

    // Process to get latest per vendor
    const vendorMap = new Map<string, VendorSnapshot>()
    
    offers?.forEach(offer => {
      // Normalize UPC comparison would need to be done here
      // For simplicity, we're doing direct comparison
      if (!vendorMap.has(offer.vendor)) {
        vendorMap.set(offer.vendor, {
          vendor: offer.vendor,
          last_date: offer.date,
          last_qty: offer.qty || 0,
          last_price: offer.price
        })
      }
    })

    const vendorSnapshots = Array.from(vendorMap.values()).sort((a, b) => 
      a.vendor.localeCompare(b.vendor)
    )

    // Get all-time cheapest vendors
    const { data: allOffers, error: allOffersError } = await supabase
      .from('vendor_offers')
      .select('vendor, price, upc')
      .not('price', 'is', null)
      .order('price', { ascending: true })

    if (allOffersError) {
      console.error('All offers error:', allOffersError)
      throw allOffersError
    }

    // Find minimum price and all vendors with that price
    const cheapestMap = new Map<string, number>()
    let minPrice = Infinity
    
    allOffers?.forEach(offer => {
      // Again, normalize UPC comparison would be needed
      if (offer.price < minPrice) {
        minPrice = offer.price
        cheapestMap.clear()
        cheapestMap.set(offer.vendor, offer.price)
      } else if (offer.price === minPrice) {
        cheapestMap.set(offer.vendor, offer.price)
      }
    })

    const cheapestVendors: CheapestVendor[] = Array.from(cheapestMap.entries())
      .map(([vendor, price]) => ({ vendor, price }))
      .sort((a, b) => a.vendor.localeCompare(b.vendor))

    const response: ItemDetailsResponse = {
      vendorSnapshots,
      cheapestVendors
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}