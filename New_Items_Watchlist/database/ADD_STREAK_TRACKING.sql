-- ============================================
-- ADD STREAK TRACKING TO WATCHLIST
-- Tracks how many consecutive updates an item has been in each status
-- ============================================

-- Step 1: Add streak columns to tracking table
ALTER TABLE watchlist_tracking 
ADD COLUMN IF NOT EXISTS status_streak INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS times_seen INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS previous_status VARCHAR(20);

-- Step 2: Create an improved tracking function with streak logic
CREATE OR REPLACE FUNCTION update_watchlist_tracking_with_streaks()
RETURNS void AS $$
DECLARE
    last_update_date DATE;
    days_since_update INTEGER;
BEGIN
    -- Get the most recent snapshot date
    SELECT MAX(snapshot_date) INTO last_update_date
    FROM watchlist_tracking
    WHERE snapshot_date < CURRENT_DATE;
    
    -- If no previous data, set a default
    IF last_update_date IS NULL THEN
        last_update_date := CURRENT_DATE - INTERVAL '7 days';
    END IF;
    
    -- Calculate days since last update
    days_since_update := CURRENT_DATE - last_update_date;
    
    RAISE NOTICE 'Last update was on %, % days ago', last_update_date, days_since_update;
    
    -- Insert today's snapshot with streak tracking
    INSERT INTO watchlist_tracking (
        upc, 
        status, 
        vendor_count,
        lowest_price,
        item_name,
        domestic_vendor_count,
        vendor_list,
        snapshot_date,
        status_streak,
        times_seen,
        previous_status
    )
    SELECT 
        CAST(nd.upc AS TEXT),
        CASE 
            -- New item never seen before
            WHEN prev.upc IS NULL THEN 'NEW_CANDIDATE'
            -- Item was removed and is now back
            WHEN prev.status = 'REMOVED' THEN 'BACK_IN_FEED'
            -- Check if vendor count dropped below threshold
            WHEN nd.domestic_vendor_count < 3 AND prev.domestic_vendor_count >= 3 THEN 'REMOVED'
            -- Check if item was acquired
            WHEN EXISTS (
                SELECT 1 FROM current_inventory ci 
                WHERE ci.upc_text = CAST(nd.upc AS TEXT)
            ) THEN 'ACQUIRED'
            -- Otherwise it's still being watched
            ELSE 'WATCHING'
        END as status,
        nd.total_vendor_count,
        nd.min_price,
        nd.item_name,
        nd.domestic_vendor_count,
        nd.vendor_list,
        CURRENT_DATE,
        -- Calculate status streak
        CASE 
            WHEN prev.upc IS NULL THEN 1  -- First time seen
            WHEN prev.status = 'REMOVED' AND nd.domestic_vendor_count >= 3 THEN 1  -- Reset streak when back
            WHEN prev.status = CASE 
                WHEN nd.domestic_vendor_count < 3 THEN 'REMOVED'
                WHEN EXISTS (SELECT 1 FROM current_inventory ci WHERE ci.upc_text = CAST(nd.upc AS TEXT)) THEN 'ACQUIRED'
                ELSE 'WATCHING'
            END THEN COALESCE(prev.status_streak, 0) + 1  -- Same status, increment streak
            ELSE 1  -- Status changed, reset streak
        END,
        -- Increment times seen
        COALESCE(prev.times_seen, 0) + 1,
        -- Store previous status
        prev.status
    FROM new_items_dashboard nd
    LEFT JOIN (
        -- Get the most recent tracking record for each item
        SELECT DISTINCT ON (upc) 
            upc, status, domestic_vendor_count, lowest_price, status_streak, times_seen
        FROM watchlist_tracking
        WHERE snapshot_date = last_update_date
        ORDER BY upc, created_at DESC
    ) prev ON CAST(nd.upc AS TEXT) = prev.upc
    WHERE nd.upc IS NOT NULL
    ON CONFLICT (upc, snapshot_date) 
    DO UPDATE SET 
        status = EXCLUDED.status,
        vendor_count = EXCLUDED.vendor_count,
        lowest_price = EXCLUDED.lowest_price,
        item_name = EXCLUDED.item_name,
        domestic_vendor_count = EXCLUDED.domestic_vendor_count,
        vendor_list = EXCLUDED.vendor_list,
        status_streak = EXCLUDED.status_streak,
        times_seen = EXCLUDED.times_seen,
        previous_status = EXCLUDED.previous_status,
        created_at = NOW();
        
    -- Mark items as REMOVED if they're not in today's feed but were in last update
    INSERT INTO watchlist_tracking (
        upc, status, vendor_count, lowest_price, item_name, 
        domestic_vendor_count, vendor_list, snapshot_date,
        status_streak, times_seen, previous_status
    )
    SELECT 
        prev.upc, 
        'REMOVED', 
        0, 
        prev.lowest_price, 
        prev.item_name,
        0, 
        prev.vendor_list, 
        CURRENT_DATE,
        1,  -- Reset streak for REMOVED status
        prev.times_seen,  -- Keep times seen count
        prev.status  -- Store what status it was before removal
    FROM (
        SELECT DISTINCT ON (upc) 
            upc, item_name, lowest_price, vendor_list, status, times_seen
        FROM watchlist_tracking
        WHERE snapshot_date = last_update_date
            AND status IN ('WATCHING', 'NEW_CANDIDATE', 'BACK_IN_FEED')
        ORDER BY upc, created_at DESC
    ) prev
    WHERE NOT EXISTS (
        SELECT 1 FROM new_items_dashboard nd 
        WHERE CAST(nd.upc AS TEXT) = prev.upc
    )
    ON CONFLICT (upc, snapshot_date) DO NOTHING;
    
    -- Log summary
    RAISE NOTICE 'Update complete. New snapshot created for %', CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Drop the old enhanced view and recreate with proper trend calculation
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
)
SELECT 
    nd.*,
    nd.min_price as lowest_price,  -- Rename for consistency
    
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
ORDER BY nd.domestic_vendor_count DESC, nd.min_price ASC;

-- Step 4: Grant permissions
GRANT SELECT ON new_items_dashboard_enhanced TO authenticated;
GRANT SELECT ON new_items_dashboard_enhanced TO anon;
GRANT EXECUTE ON FUNCTION update_watchlist_tracking_with_streaks() TO authenticated;

-- Step 5: Update existing records to have streak values (one-time update)
UPDATE watchlist_tracking wt
SET 
    status_streak = 1,
    times_seen = 1
WHERE status_streak IS NULL;

-- Step 6: Test the new view
SELECT 
    upc,
    item_name,
    status,
    status_streak,
    times_seen,
    price_trend,
    price_change_pct,
    vendor_change_status
FROM new_items_dashboard_enhanced
LIMIT 5;