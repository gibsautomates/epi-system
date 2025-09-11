-- ============================================
-- ADD LOWEST VENDOR TO ENHANCED VIEW (FIXED)
-- Uses the existing vendor_offers_latest view
-- ============================================

-- Drop and recreate the enhanced view with lowest_vendor field populated
DROP VIEW IF EXISTS new_items_dashboard_enhanced CASCADE;

CREATE OR REPLACE VIEW new_items_dashboard_enhanced AS
WITH latest_tracking AS (
    -- Get the most recent tracking record for each item
    SELECT DISTINCT ON (upc) 
        upc,
        status,
        snapshot_date,
        lowest_price as tracked_price,
        domestic_vendor_count as tracked_vendor_count,
        status_streak,
        times_seen,
        previous_status
    FROM watchlist_tracking
    ORDER BY upc, snapshot_date DESC, created_at DESC
),
previous_tracking AS (
    -- Get the previous tracking record (from last actual update)
    SELECT DISTINCT ON (wt.upc)
        wt.upc,
        wt.status as prev_status,
        wt.lowest_price as prev_price,
        wt.domestic_vendor_count as prev_vendor_count,
        wt.snapshot_date as prev_date
    FROM watchlist_tracking wt
    INNER JOIN (
        -- Find the second most recent snapshot for each item
        SELECT DISTINCT upc, snapshot_date
        FROM watchlist_tracking
        WHERE snapshot_date < (SELECT MAX(snapshot_date) FROM watchlist_tracking)
    ) prev_dates ON wt.upc = prev_dates.upc AND wt.snapshot_date = prev_dates.snapshot_date
    ORDER BY wt.upc, wt.snapshot_date DESC, wt.created_at DESC
),
lowest_vendor_calc AS (
    -- Get the vendor with lowest price from vendor_offers_latest view
    SELECT DISTINCT ON (vol.upc)
        vol.upc,
        vol.vendor_name as lowest_vendor,
        vol.qty,
        vol.price
    FROM vendor_offers_latest vol
    INNER JOIN (
        -- Get minimum price for each UPC from domestic vendors
        SELECT upc, MIN(price) as min_price
        FROM vendor_offers_latest
        WHERE vendor_type = 'DOMESTIC'
        GROUP BY upc
    ) min_prices ON vol.upc = min_prices.upc AND vol.price = min_prices.min_price
    WHERE vol.vendor_type = 'DOMESTIC'
    ORDER BY 
        vol.upc,
        CASE 
            WHEN vol.qty IS NULL THEN 0  -- NULL qty means plenty, so prioritize it
            ELSE 1 
        END,
        vol.qty DESC NULLS FIRST,  -- Then by highest qty (NULL first as it means unlimited)
        vol.vendor_name  -- Finally alphabetically as tiebreaker
)
SELECT 
    nd.*,
    nd.min_price as lowest_price,  -- Rename for consistency
    
    -- Get the lowest vendor name
    COALESCE(lvc.lowest_vendor, SPLIT_PART(nd.vendor_list, ', ', 1)) as lowest_vendor,
    
    -- Status from tracking or default
    COALESCE(lt.status, 'NEW_CANDIDATE') as status,
    
    -- Price trend based on actual previous tracking data
    CASE 
        WHEN pt.prev_price IS NULL THEN 'new'
        WHEN nd.min_price > pt.prev_price * 1.05 THEN 'up'
        WHEN nd.min_price < pt.prev_price * 0.95 THEN 'down'
        ELSE 'stable'
    END as price_trend,
    
    -- Price change percentage
    CASE 
        WHEN pt.prev_price > 0 AND pt.prev_price IS NOT NULL
        THEN ROUND(((nd.min_price - pt.prev_price) / pt.prev_price * 100)::numeric, 2)
        ELSE 0
    END as price_change_pct,
    
    -- Monthly average
    nd.avg_price as monthly_avg_price,
    
    -- Days since first seen
    CURRENT_DATE - nd.first_seen::date as days_on_watchlist,
    nd.total_qty as qty_available,
    
    -- Tracking dates
    lt.snapshot_date as last_tracked_date,
    pt.prev_date as previous_update_date,
    CASE 
        WHEN pt.prev_date IS NOT NULL 
        THEN CURRENT_DATE - pt.prev_date 
        ELSE NULL 
    END as days_since_last_update,
    
    -- Previous values for comparison
    pt.prev_price as previous_price,
    pt.prev_vendor_count as previous_vendor_count,
    
    -- Vendor change indicators
    CASE 
        WHEN pt.prev_vendor_count IS NULL THEN nd.domestic_vendor_count
        ELSE nd.domestic_vendor_count - pt.prev_vendor_count
    END as vendor_count_change,
    
    -- Vendor status
    CASE 
        WHEN pt.prev_vendor_count IS NULL THEN 'NEW'
        WHEN nd.domestic_vendor_count > pt.prev_vendor_count THEN 'GAINING_VENDORS'
        WHEN nd.domestic_vendor_count < pt.prev_vendor_count THEN 'LOSING_VENDORS'
        ELSE 'STABLE_VENDORS'
    END as vendor_change_status,
    
    -- Streak tracking
    COALESCE(lt.status_streak, 1) as status_streak,
    COALESCE(lt.times_seen, 1) as times_seen,
    lt.previous_status
    
FROM new_items_dashboard nd
LEFT JOIN latest_tracking lt ON CAST(nd.upc AS TEXT) = lt.upc
LEFT JOIN previous_tracking pt ON CAST(nd.upc AS TEXT) = pt.upc
LEFT JOIN lowest_vendor_calc lvc ON nd.upc = lvc.upc
ORDER BY nd.domestic_vendor_count DESC, nd.min_price ASC;

-- Grant permissions
GRANT SELECT ON new_items_dashboard_enhanced TO authenticated;
GRANT SELECT ON new_items_dashboard_enhanced TO anon;

-- Test to verify lowest_vendor is populated
SELECT 
    upc,
    item_name,
    lowest_price,
    lowest_vendor,
    vendor_list,
    status,
    status_streak,
    price_trend,
    price_change_pct
FROM new_items_dashboard_enhanced
LIMIT 5;