import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { ItemsResponse, ItemFilters } from '@/lib/types'

// Force dynamic rendering - disable static optimization
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    
    const filters: ItemFilters = {
      q: searchParams.get('q') || undefined,
      minPrice: searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : undefined,
      maxPrice: searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined,
      minVendors: searchParams.get('minVendors') ? Number(searchParams.get('minVendors')) : undefined,
      onlyInSc: searchParams.get('onlyInSc') === 'true',
      onlyNotInSc: searchParams.get('onlyNotInSc') === 'true',
      firstFrom: searchParams.get('firstFrom') || undefined,
      firstTo: searchParams.get('firstTo') || undefined,
      lastFrom: searchParams.get('lastFrom') || undefined,
      lastTo: searchParams.get('lastTo') || undefined,
      sortCol: searchParams.get('sortCol') || 'latest_domestic_min_price_21d',
      sortDir: (searchParams.get('sortDir') as 'asc' | 'desc') || 'asc',
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 50,
      offset: searchParams.get('offset') ? Number(searchParams.get('offset')) : 0,
    }

    // Build query
    let query = supabase
      .from('master_update_candidates_domestic')
      .select('*', { count: 'exact' })

    // Apply filters
    if (filters.q) {
      query = query.or(`item_name.ilike.%${filters.q}%,brand.ilike.%${filters.q}%,upc_text.ilike.%${filters.q}%`)
    }

    if (filters.minPrice !== undefined) {
      query = query.gte('latest_domestic_min_price_21d', filters.minPrice)
    }

    if (filters.maxPrice !== undefined) {
      query = query.lte('latest_domestic_min_price_21d', filters.maxPrice)
    }

    if (filters.minVendors !== undefined) {
      query = query.gte('active_domestic_vendor_count_21d', filters.minVendors)
    }

    if (filters.firstFrom) {
      query = query.gte('first_seen_global_date', filters.firstFrom)
    }

    if (filters.firstTo) {
      query = query.lte('first_seen_global_date', filters.firstTo)
    }

    if (filters.lastFrom) {
      query = query.gte('last_seen_global_date', filters.lastFrom)
    }

    if (filters.lastTo) {
      query = query.lte('last_seen_global_date', filters.lastTo)
    }

    // Handle SC filters
    if (filters.onlyInSc) {
      // This would need a join or subquery - for now we'll handle in post-processing
      // In production, you'd want to create a view that includes this information
    }

    if (filters.onlyNotInSc) {
      // This would need a join or subquery - for now we'll handle in post-processing
    }

    // Apply sorting
    const { sortCol, sortDir } = filters
    const ascending = sortDir === 'asc'
    
    if (sortCol === 'latest_domestic_min_price_21d') {
      query = query.order('latest_domestic_min_price_21d', { 
        ascending, 
        nullsFirst: false 
      })
    } else if (sortCol === 'active_domestic_vendor_count_21d') {
      query = query.order('active_domestic_vendor_count_21d', { ascending })
    } else if (sortCol === 'last_seen_global_date') {
      query = query.order('last_seen_global_date', { ascending })
    } else {
      query = query.order('latest_domestic_min_price_21d', { 
        ascending: true, 
        nullsFirst: false 
      })
    }

    // Always add secondary sort for consistency
    query = query.order('upc_text', { ascending: true })

    // Apply pagination
    query = query.range(filters.offset!, filters.offset! + filters.limit! - 1)

    const { data: items, error, count } = await query

    if (error) {
      console.error('Items query error:', error)
      throw error
    }

    // Calculate KPIs from the filtered data
    // For a real implementation, you'd want to do this in the database
    let domesticVendorTotal = 0
    const prices: number[] = []
    
    if (items) {
      items.forEach(item => {
        domesticVendorTotal += item.active_domestic_vendor_count_21d || 0
        if (item.latest_domestic_min_price_21d !== null) {
          prices.push(item.latest_domestic_min_price_21d)
        }
      })
    }

    // Calculate median
    let medianPrice = null
    if (prices.length > 0) {
      prices.sort((a, b) => a - b)
      const mid = Math.floor(prices.length / 2)
      medianPrice = prices.length % 2 === 0
        ? (prices[mid - 1] + prices[mid]) / 2
        : prices[mid]
    }

    const response: ItemsResponse = {
      items: items || [],
      kpis: {
        items_count: count || 0,
        domestic_vendor_total: domesticVendorTotal,
        median_min_price: medianPrice
      },
      total: count || 0
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