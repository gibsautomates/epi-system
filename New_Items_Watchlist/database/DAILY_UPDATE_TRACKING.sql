-- ============================================
-- DAILY TRACKING UPDATE SCRIPT
-- Run this daily to update item statuses
-- ============================================

-- Function to run daily updates
CREATE OR REPLACE FUNCTION run_daily_watchlist_update()
RETURNS TABLE(
    status_type TEXT,
    item_count INTEGER
) AS $$
DECLARE
    new_candidates INTEGER := 0;
    watching INTEGER := 0;
    removed INTEGER := 0;
    back_in_feed INTEGER := 0;
    acquired INTEGER := 0;
BEGIN
    -- First, update the tracking table
    PERFORM update_watchlist_tracking();
    
    -- Get counts for each status type from today's snapshot
    SELECT COUNT(*) INTO new_candidates
    FROM watchlist_tracking
    WHERE snapshot_date = CURRENT_DATE
        AND status = 'NEW_CANDIDATE';
        
    SELECT COUNT(*) INTO watching
    FROM watchlist_tracking
    WHERE snapshot_date = CURRENT_DATE
        AND status = 'WATCHING';
        
    SELECT COUNT(*) INTO removed
    FROM watchlist_tracking
    WHERE snapshot_date = CURRENT_DATE
        AND status = 'REMOVED';
        
    SELECT COUNT(*) INTO back_in_feed
    FROM watchlist_tracking
    WHERE snapshot_date = CURRENT_DATE
        AND status = 'BACK_IN_FEED';
        
    SELECT COUNT(*) INTO acquired
    FROM watchlist_tracking
    WHERE snapshot_date = CURRENT_DATE
        AND status = 'ACQUIRED';
    
    -- Return summary
    RETURN QUERY
    SELECT 'NEW_CANDIDATE'::TEXT, new_candidates
    UNION ALL
    SELECT 'WATCHING'::TEXT, watching
    UNION ALL
    SELECT 'REMOVED'::TEXT, removed
    UNION ALL
    SELECT 'BACK_IN_FEED'::TEXT, back_in_feed
    UNION ALL
    SELECT 'ACQUIRED'::TEXT, acquired
    UNION ALL
    SELECT 'TOTAL'::TEXT, new_candidates + watching + removed + back_in_feed + acquired;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- USAGE EXAMPLES
-- ============================================

-- 1. Run daily update and see summary
SELECT * FROM run_daily_watchlist_update();

-- 2. View today's new candidates
SELECT 
    wt.upc,
    wt.item_name,
    wt.lowest_price,
    wt.domestic_vendor_count,
    wt.vendor_list
FROM watchlist_tracking wt
WHERE wt.snapshot_date = CURRENT_DATE
    AND wt.status = 'NEW_CANDIDATE'
ORDER BY wt.lowest_price ASC
LIMIT 20;

-- 3. View items that came back after being removed
SELECT 
    wt.upc,
    wt.item_name,
    wt.lowest_price,
    wt.domestic_vendor_count,
    prev.snapshot_date as removed_date,
    CURRENT_DATE - prev.snapshot_date as days_removed
FROM watchlist_tracking wt
JOIN watchlist_tracking prev ON wt.upc = prev.upc
WHERE wt.snapshot_date = CURRENT_DATE
    AND wt.status = 'BACK_IN_FEED'
    AND prev.status = 'REMOVED'
    AND prev.snapshot_date = (
        SELECT MAX(snapshot_date) 
        FROM watchlist_tracking 
        WHERE upc = wt.upc 
            AND status = 'REMOVED'
            AND snapshot_date < CURRENT_DATE
    )
ORDER BY days_removed DESC;

-- 4. View items removed today
SELECT 
    wt.upc,
    wt.item_name,
    prev.lowest_price as last_price,
    prev.domestic_vendor_count as last_vendor_count,
    'Dropped from ' || prev.domestic_vendor_count || ' to below 3 vendors' as reason
FROM watchlist_tracking wt
LEFT JOIN watchlist_tracking prev ON wt.upc = prev.upc
    AND prev.snapshot_date = CURRENT_DATE - INTERVAL '1 day'
WHERE wt.snapshot_date = CURRENT_DATE
    AND wt.status = 'REMOVED'
ORDER BY prev.lowest_price ASC;

-- 5. View status changes over time for a specific item
-- Replace 123456789 with actual UPC
SELECT 
    snapshot_date,
    status,
    domestic_vendor_count,
    lowest_price,
    vendor_list
FROM watchlist_tracking
WHERE upc = 123456789
ORDER BY snapshot_date DESC
LIMIT 30;

-- 6. Get weekly summary report
SELECT 
    DATE_TRUNC('week', snapshot_date) as week_start,
    status,
    COUNT(*) as item_count
FROM watchlist_tracking
WHERE snapshot_date >= CURRENT_DATE - INTERVAL '4 weeks'
GROUP BY DATE_TRUNC('week', snapshot_date), status
ORDER BY week_start DESC, status;

-- 7. Find items with most vendor changes
SELECT 
    wt.upc,
    wt.item_name,
    MIN(wt.domestic_vendor_count) as min_vendors,
    MAX(wt.domestic_vendor_count) as max_vendors,
    COUNT(DISTINCT wt.status) as status_changes,
    STRING_AGG(DISTINCT wt.status, ', ' ORDER BY wt.status) as statuses_held
FROM watchlist_tracking wt
WHERE wt.snapshot_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY wt.upc, wt.item_name
HAVING COUNT(DISTINCT wt.status) > 1
ORDER BY status_changes DESC, max_vendors DESC
LIMIT 20;