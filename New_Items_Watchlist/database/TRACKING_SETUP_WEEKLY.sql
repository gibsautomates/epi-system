-- ============================================
-- TRACKING TABLE SETUP FOR WEEKLY UPDATES
-- Designed for 1-3 updates per week, not daily
-- ============================================

-- Step 1: Drop existing objects to start clean
DROP INDEX IF EXISTS idx_watchlist_tracking_upc;
DROP INDEX IF EXISTS idx_watchlist_tracking_date;
DROP INDEX IF EXISTS idx_watchlist_tracking_status;
DROP VIEW IF EXISTS new_items_dashboard_enhanced CASCADE;
DROP FUNCTION IF EXISTS update_watchlist_tracking();
DROP TABLE IF EXISTS watchlist_tracking CASCADE;

-- Step 2: Create tracking table
CREATE TABLE watchlist_tracking (
    id SERIAL PRIMARY KEY,
    upc TEXT NOT NULL,
    status VARCHAR(20) NOT NULL,
    vendor_count INTEGER,
    lowest_price NUMERIC(10,2),
    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Additional tracking fields
    item_name TEXT,
    domestic_vendor_count INTEGER,
    vendor_list TEXT,
    
    -- Create composite index for faster queries
    UNIQUE(upc, snapshot_date)
);

-- Step 3: Create indexes
CREATE INDEX idx_watchlist_tracking_upc ON watchlist_tracking(upc);
CREATE INDEX idx_watchlist_tracking_date ON watchlist_tracking(snapshot_date DESC);
CREATE INDEX idx_watchlist_tracking_status ON watchlist_tracking(status);

-- Step 4: Function to update tracking table (works with irregular update schedule)
CREATE OR REPLACE FUNCTION update_watchlist_tracking()
RETURNS void AS $$
DECLARE
    last_update_date DATE;
    days_since_update INTEGER;
BEGIN
    -- Get the most recent snapshot date (could be 1-7 days ago)
    SELECT MAX(snapshot_date) INTO last_update_date
    FROM watchlist_tracking;
    
    -- If no previous data, set a default
    IF last_update_date IS NULL THEN
        last_update_date := CURRENT_DATE - INTERVAL '7 days';
    END IF;
    
    -- Calculate days since last update
    days_since_update := CURRENT_DATE - last_update_date;
    
    RAISE NOTICE 'Last update was on %, % days ago', last_update_date, days_since_update;
    
    -- Insert today's snapshot
    INSERT INTO watchlist_tracking (
        upc, 
        status, 
        vendor_count,
        lowest_price,
        item_name,
        domestic_vendor_count,
        vendor_list,
        snapshot_date
    )
    SELECT 
        CAST(nd.upc AS TEXT),
        CASE 
            -- Check if item existed in the last update (whenever that was)
            WHEN prev.upc IS NULL THEN 'NEW_CANDIDATE'
            -- Check if item was removed and is now back
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
        CURRENT_DATE
    FROM new_items_dashboard nd
    LEFT JOIN (
        -- Get the most recent status for each item (from last update)
        SELECT DISTINCT ON (upc) 
            upc, status, domestic_vendor_count, lowest_price
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
        created_at = NOW();  -- Update timestamp
        
    -- Mark items as REMOVED if they're not in today's feed but were in last update
    INSERT INTO watchlist_tracking (
        upc, status, vendor_count, lowest_price, item_name, 
        domestic_vendor_count, vendor_list, snapshot_date
    )
    SELECT 
        prev.upc, 
        'REMOVED', 
        0, 
        prev.lowest_price, 
        prev.item_name,
        0, 
        prev.vendor_list, 
        CURRENT_DATE
    FROM (
        SELECT DISTINCT ON (upc) 
            upc, item_name, lowest_price, vendor_list, status
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

-- Step 5: Create enhanced view
CREATE OR REPLACE VIEW new_items_dashboard_enhanced AS
WITH latest_tracking AS (
    -- Get the most recent tracking record for each item
    SELECT DISTINCT ON (upc) 
        upc,
        status,
        snapshot_date,
        lowest_price as tracked_price,
        domestic_vendor_count as tracked_vendor_count
    FROM watchlist_tracking
    ORDER BY upc, snapshot_date DESC, created_at DESC
),
previous_tracking AS (
    -- Get the previous tracking record (from last update)
    SELECT DISTINCT ON (wt.upc)
        wt.upc,
        wt.status as prev_status,
        wt.lowest_price as prev_price,
        wt.domestic_vendor_count as prev_vendor_count,
        wt.snapshot_date as prev_date
    FROM watchlist_tracking wt
    INNER JOIN (
        SELECT upc, MAX(snapshot_date) as max_date
        FROM watchlist_tracking
        WHERE snapshot_date < CURRENT_DATE
        GROUP BY upc
    ) prev_max ON wt.upc = prev_max.upc AND wt.snapshot_date = prev_max.max_date
    ORDER BY wt.upc, wt.created_at DESC
)
SELECT 
    nd.*,
    nd.min_price as lowest_price,  -- Rename for consistency
    
    -- Status from tracking or default
    COALESCE(lt.status, 'NEW_CANDIDATE') as status,
    
    -- Price trend based on comparison with last update
    CASE 
        WHEN pt.prev_price IS NULL THEN 'new'
        WHEN nd.min_price > pt.prev_price * 1.05 THEN 'up'
        WHEN nd.min_price < pt.prev_price * 0.95 THEN 'down'
        ELSE 'stable'
    END as price_trend,
    
    -- Price change percentage
    CASE 
        WHEN pt.prev_price > 0 
        THEN ROUND(((nd.min_price - pt.prev_price) / pt.prev_price * 100)::numeric, 2)
        ELSE 0
    END as price_change_pct,
    
    -- Use average as monthly (since updates are irregular)
    nd.avg_price as monthly_avg_price,
    
    -- Days since first seen
    CURRENT_DATE - nd.first_seen::date as days_on_watchlist,
    nd.total_qty as qty_available,
    
    -- Tracking dates
    lt.snapshot_date as last_tracked_date,
    pt.prev_date as previous_update_date,
    CURRENT_DATE - pt.prev_date as days_since_last_update,
    
    -- Previous values for comparison
    pt.prev_price as previous_price,
    pt.prev_vendor_count as previous_vendor_count,
    
    -- Vendor change indicators
    CASE 
        WHEN pt.prev_vendor_count IS NULL THEN nd.domestic_vendor_count
        ELSE nd.domestic_vendor_count - pt.prev_vendor_count
    END as vendor_count_change,
    
    -- Simple vendor status
    CASE 
        WHEN pt.prev_vendor_count IS NULL THEN 'NEW'
        WHEN nd.domestic_vendor_count > pt.prev_vendor_count THEN 'GAINING_VENDORS'
        WHEN nd.domestic_vendor_count < pt.prev_vendor_count THEN 'LOSING_VENDORS'
        ELSE 'STABLE_VENDORS'
    END as vendor_change_status
    
FROM new_items_dashboard nd
LEFT JOIN latest_tracking lt ON CAST(nd.upc AS TEXT) = lt.upc
LEFT JOIN previous_tracking pt ON CAST(nd.upc AS TEXT) = pt.upc
ORDER BY nd.domestic_vendor_count DESC, nd.min_price ASC;

-- Step 6: Create a function to get update history
CREATE OR REPLACE FUNCTION get_update_history()
RETURNS TABLE(
    snapshot_date DATE,
    total_items INTEGER,
    new_candidates INTEGER,
    watching INTEGER,
    removed INTEGER,
    back_in_feed INTEGER,
    acquired INTEGER,
    days_since_previous INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH snapshot_summary AS (
        SELECT 
            wt.snapshot_date,
            COUNT(*) as total_items,
            COUNT(CASE WHEN status = 'NEW_CANDIDATE' THEN 1 END) as new_candidates,
            COUNT(CASE WHEN status = 'WATCHING' THEN 1 END) as watching,
            COUNT(CASE WHEN status = 'REMOVED' THEN 1 END) as removed,
            COUNT(CASE WHEN status = 'BACK_IN_FEED' THEN 1 END) as back_in_feed,
            COUNT(CASE WHEN status = 'ACQUIRED' THEN 1 END) as acquired
        FROM watchlist_tracking wt
        GROUP BY wt.snapshot_date
    )
    SELECT 
        ss.*,
        ss.snapshot_date - LAG(ss.snapshot_date) OVER (ORDER BY ss.snapshot_date) as days_since_previous
    FROM snapshot_summary ss
    ORDER BY ss.snapshot_date DESC;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Initialize with current data (first run only)
INSERT INTO watchlist_tracking (
    upc, status, vendor_count, lowest_price, item_name,
    domestic_vendor_count, vendor_list, snapshot_date
)
SELECT 
    CAST(upc AS TEXT), 
    'NEW_CANDIDATE',  -- All items are new on first run
    total_vendor_count,
    min_price, 
    item_name, 
    domestic_vendor_count, 
    vendor_list, 
    CURRENT_DATE
FROM new_items_dashboard
WHERE upc IS NOT NULL AND min_price IS NOT NULL
ON CONFLICT (upc, snapshot_date) DO NOTHING;

-- Step 8: Grant permissions
GRANT SELECT, INSERT, UPDATE ON watchlist_tracking TO authenticated;
GRANT SELECT ON new_items_dashboard_enhanced TO authenticated;
GRANT SELECT ON new_items_dashboard_enhanced TO anon;
GRANT EXECUTE ON FUNCTION update_watchlist_tracking() TO authenticated;
GRANT EXECUTE ON FUNCTION get_update_history() TO authenticated;

-- Step 9: Test and show update history
SELECT * FROM get_update_history();

-- Show current status summary
SELECT status, COUNT(*) as count 
FROM watchlist_tracking 
WHERE snapshot_date = CURRENT_DATE 
GROUP BY status;

-- Show when updates occurred
SELECT 
    snapshot_date,
    COUNT(DISTINCT upc) as items_tracked,
    MIN(created_at) as update_started,
    MAX(created_at) as update_completed
FROM watchlist_tracking
GROUP BY snapshot_date
ORDER BY snapshot_date DESC
LIMIT 10;