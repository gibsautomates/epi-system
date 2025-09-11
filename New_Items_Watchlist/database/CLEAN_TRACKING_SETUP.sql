-- ============================================
-- CLEAN TRACKING TABLE SETUP
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Drop existing objects if they exist to start clean
DROP INDEX IF EXISTS idx_watchlist_tracking_upc;
DROP INDEX IF EXISTS idx_watchlist_tracking_date;
DROP INDEX IF EXISTS idx_watchlist_tracking_status;
DROP VIEW IF EXISTS new_items_dashboard_enhanced CASCADE;
DROP FUNCTION IF EXISTS update_watchlist_tracking();
DROP TABLE IF EXISTS watchlist_tracking CASCADE;

-- Step 2: Create tracking table to maintain history of items
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

-- Step 3: Create indexes for performance
CREATE INDEX idx_watchlist_tracking_upc ON watchlist_tracking(upc);
CREATE INDEX idx_watchlist_tracking_date ON watchlist_tracking(snapshot_date DESC);
CREATE INDEX idx_watchlist_tracking_status ON watchlist_tracking(status);

-- Step 4: Function to update tracking table daily
CREATE OR REPLACE FUNCTION update_watchlist_tracking()
RETURNS void AS $$
DECLARE
    yesterday_date DATE := CURRENT_DATE - INTERVAL '1 day';
BEGIN
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
            WHEN yt.upc IS NULL THEN 'NEW_CANDIDATE'
            WHEN yt.status = 'REMOVED' THEN 'BACK_IN_FEED'
            WHEN nd.domestic_vendor_count < 3 AND yt.domestic_vendor_count >= 3 THEN 'REMOVED'
            ELSE 'WATCHING'
        END as status,
        nd.total_vendor_count,
        nd.min_price,
        nd.item_name,
        nd.domestic_vendor_count,
        nd.vendor_list,
        CURRENT_DATE
    FROM new_items_dashboard nd
    LEFT JOIN watchlist_tracking yt ON CAST(nd.upc AS TEXT) = yt.upc 
        AND yt.snapshot_date = yesterday_date
    WHERE nd.upc IS NOT NULL
    ON CONFLICT (upc, snapshot_date) 
    DO UPDATE SET 
        status = EXCLUDED.status,
        vendor_count = EXCLUDED.vendor_count,
        lowest_price = EXCLUDED.lowest_price,
        item_name = EXCLUDED.item_name,
        domestic_vendor_count = EXCLUDED.domestic_vendor_count,
        vendor_list = EXCLUDED.vendor_list;
        
    -- Mark items as REMOVED if they're not in today's feed
    INSERT INTO watchlist_tracking (
        upc, status, vendor_count, lowest_price, item_name, 
        domestic_vendor_count, vendor_list, snapshot_date
    )
    SELECT 
        yt.upc, 'REMOVED', 0, yt.lowest_price, yt.item_name,
        0, yt.vendor_list, CURRENT_DATE
    FROM watchlist_tracking yt
    WHERE yt.snapshot_date = yesterday_date
        AND yt.status IN ('WATCHING', 'NEW_CANDIDATE', 'BACK_IN_FEED')
        AND NOT EXISTS (
            SELECT 1 FROM new_items_dashboard nd 
            WHERE CAST(nd.upc AS TEXT) = yt.upc
        )
    ON CONFLICT (upc, snapshot_date) DO NOTHING;
    
    -- Mark as ACQUIRED if in inventory
    UPDATE watchlist_tracking SET status = 'ACQUIRED'
    WHERE snapshot_date = CURRENT_DATE
        AND EXISTS (
            SELECT 1 FROM current_inventory ci 
            WHERE ci.upc_text = watchlist_tracking.upc
        );
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create simplified enhanced view (without complex joins that might cause errors)
CREATE OR REPLACE VIEW new_items_dashboard_enhanced AS
SELECT 
    nd.*,
    nd.min_price as lowest_price,  -- Rename for consistency
    COALESCE(wt.status, 'NEW_CANDIDATE') as status,
    CASE 
        WHEN nd.min_price IS NULL OR nd.max_price IS NULL THEN 'stable'
        WHEN nd.max_price > nd.min_price * 1.1 THEN 'up'
        WHEN nd.max_price < nd.min_price * 0.9 THEN 'down'
        ELSE 'stable'
    END as price_trend,
    0 as price_change_pct,
    nd.avg_price as monthly_avg_price,
    CURRENT_DATE - nd.first_seen::date as days_on_watchlist,
    nd.total_qty as qty_available,
    wt.snapshot_date as last_tracked_date,
    NULL::numeric as previous_price,
    NULL::integer as previous_vendor_count,
    
    -- Add placeholder vendor tracking fields
    0 as vendors_new_count,
    nd.domestic_vendor_count as vendors_offering_count,
    0 as vendors_removed_count,
    0 as vendors_back_count,
    NULL::text as new_vendors,
    NULL::text as removed_vendors,
    'STABLE_VENDORS' as vendor_change_status
    
FROM new_items_dashboard nd
LEFT JOIN (
    SELECT DISTINCT ON (upc) upc, status, snapshot_date
    FROM watchlist_tracking
    ORDER BY upc, snapshot_date DESC
) wt ON CAST(nd.upc AS TEXT) = wt.upc
ORDER BY nd.domestic_vendor_count DESC, nd.min_price ASC;

-- Step 6: Initialize with current data
INSERT INTO watchlist_tracking (
    upc, status, vendor_count, lowest_price, item_name,
    domestic_vendor_count, vendor_list, snapshot_date
)
SELECT 
    CAST(upc AS TEXT), 'NEW_CANDIDATE', total_vendor_count,
    min_price, item_name, domestic_vendor_count, vendor_list, CURRENT_DATE
FROM new_items_dashboard
WHERE upc IS NOT NULL AND min_price IS NOT NULL
ON CONFLICT (upc, snapshot_date) DO NOTHING;

-- Step 7: Grant permissions
GRANT SELECT, INSERT, UPDATE ON watchlist_tracking TO authenticated;
GRANT SELECT ON new_items_dashboard_enhanced TO authenticated;
GRANT SELECT ON new_items_dashboard_enhanced TO anon;

-- Step 8: Test
SELECT COUNT(*) as tracking_records FROM watchlist_tracking;
SELECT COUNT(*) as enhanced_view_records FROM new_items_dashboard_enhanced;
SELECT status, COUNT(*) FROM watchlist_tracking GROUP BY status;