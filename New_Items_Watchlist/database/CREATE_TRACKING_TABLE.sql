-- ============================================
-- WATCHLIST TRACKING TABLE AND ENHANCED VIEW
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Create tracking table to maintain history of items
CREATE TABLE IF NOT EXISTS watchlist_tracking (
    id SERIAL PRIMARY KEY,
    upc BIGINT NOT NULL,
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

-- Create index for performance
CREATE INDEX idx_watchlist_tracking_upc ON watchlist_tracking(upc);
CREATE INDEX idx_watchlist_tracking_date ON watchlist_tracking(snapshot_date DESC);
CREATE INDEX idx_watchlist_tracking_status ON watchlist_tracking(status);

-- Step 2: Function to update tracking table daily
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
        nd.upc,
        CASE 
            -- Check if item existed yesterday
            WHEN yt.upc IS NULL THEN 'NEW_CANDIDATE'
            -- Check if item was removed recently (within last 7 days)
            WHEN yt.status = 'REMOVED' THEN 'BACK_IN_FEED'
            -- Check if it now has less than 3 vendors (being removed)
            WHEN nd.domestic_vendor_count < 3 AND yt.domestic_vendor_count >= 3 THEN 'REMOVED'
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
    LEFT JOIN watchlist_tracking yt ON nd.upc = yt.upc 
        AND yt.snapshot_date = yesterday_date
    ON CONFLICT (upc, snapshot_date) 
    DO UPDATE SET 
        status = EXCLUDED.status,
        vendor_count = EXCLUDED.vendor_count,
        lowest_price = EXCLUDED.lowest_price,
        item_name = EXCLUDED.item_name,
        domestic_vendor_count = EXCLUDED.domestic_vendor_count,
        vendor_list = EXCLUDED.vendor_list;
        
    -- Mark items as REMOVED if they're not in today's feed but were yesterday
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
        yt.upc,
        'REMOVED',
        0,
        yt.lowest_price,
        yt.item_name,
        0,
        yt.vendor_list,
        CURRENT_DATE
    FROM watchlist_tracking yt
    WHERE yt.snapshot_date = yesterday_date
        AND yt.status IN ('WATCHING', 'NEW_CANDIDATE', 'BACK_IN_FEED')
        AND NOT EXISTS (
            SELECT 1 FROM new_items_dashboard nd 
            WHERE nd.upc = yt.upc
        )
    ON CONFLICT (upc, snapshot_date) DO NOTHING;
    
    -- Mark items as ACQUIRED if they're now in current_inventory
    UPDATE watchlist_tracking wt
    SET status = 'ACQUIRED'
    WHERE wt.snapshot_date = CURRENT_DATE
        AND EXISTS (
            SELECT 1 FROM current_inventory ci 
            WHERE CAST(ci.upc_text AS BIGINT) = wt.upc
        );
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create enhanced view with proper status and renamed fields
DROP VIEW IF EXISTS new_items_dashboard_enhanced CASCADE;

CREATE OR REPLACE VIEW new_items_dashboard_enhanced AS
WITH item_details AS (
    -- Get all items with vendor details
    SELECT 
        vol.*,
        ROW_NUMBER() OVER (PARTITION BY vol.upc ORDER BY vol.price ASC NULLS LAST) as price_rank
    FROM vendor_offers_latest_new vol
),
item_aggregates AS (
    SELECT 
        upc,
        MAX(item_name) as item_name,
        MAX(brand) as brand,
        MAX(sku) as sku,
        MIN(CASE WHEN price > 0 THEN price END) as lowest_price,  -- Renamed from min_price
        MAX(CASE WHEN price > 0 THEN price END) as max_price,
        AVG(CASE WHEN price > 0 THEN price END) as avg_price,
        COUNT(DISTINCT vendor) as total_vendor_count,
        COUNT(DISTINCT CASE WHEN vendor_location = 'Domestic' THEN vendor END) as domestic_vendor_count,
        COUNT(DISTINCT CASE WHEN vendor_location = 'International' THEN vendor END) as international_vendor_count,
        STRING_AGG(DISTINCT vendor, ', ' ORDER BY vendor) as vendor_list,
        MIN(date) as first_seen,
        MAX(date) as last_seen,
        SUM(qty) as total_qty,
        COUNT(*) as offer_count,
        -- Get the vendor with lowest price
        MAX(CASE WHEN id.price_rank = 1 THEN id.vendor END) as lowest_vendor
    FROM item_details id
    GROUP BY upc
),
latest_tracking AS (
    -- Get the most recent tracking status for each item
    SELECT DISTINCT ON (upc) 
        upc,
        status as tracking_status,
        snapshot_date as last_tracked_date
    FROM watchlist_tracking
    ORDER BY upc, snapshot_date DESC
),
previous_tracking AS (
    -- Get yesterday's tracking data
    SELECT 
        upc,
        status as yesterday_status,
        lowest_price as yesterday_price,
        domestic_vendor_count as yesterday_vendor_count
    FROM watchlist_tracking
    WHERE snapshot_date = CURRENT_DATE - INTERVAL '1 day'
),
price_history AS (
    -- Get price trends over last 30 days
    SELECT 
        upc,
        date,
        AVG(CASE WHEN price > 0 THEN price END) as daily_avg_price
    FROM vendor_offers
    WHERE date >= CURRENT_DATE - INTERVAL '30 days'
        AND price > 0
    GROUP BY upc, date
),
price_trends AS (
    -- Calculate price trend
    SELECT 
        upc,
        AVG(CASE 
            WHEN date >= CURRENT_DATE - INTERVAL '7 days' 
            THEN daily_avg_price 
        END) as recent_avg,
        AVG(CASE 
            WHEN date < CURRENT_DATE - INTERVAL '7 days' 
            AND date >= CURRENT_DATE - INTERVAL '28 days'
            THEN daily_avg_price 
        END) as previous_avg,
        AVG(daily_avg_price) as monthly_avg
    FROM price_history
    GROUP BY upc
)
SELECT 
    ia.*,
    -- Calculate proper status based on tracking history
    COALESCE(
        lt.tracking_status,
        CASE 
            -- If not in tracking table, it's new
            WHEN lt.upc IS NULL THEN 'NEW_CANDIDATE'
            -- If it was removed yesterday but back today
            WHEN pt.yesterday_status = 'REMOVED' THEN 'BACK_IN_FEED'
            -- If vendor count dropped below 3
            WHEN ia.domestic_vendor_count < 3 AND pt.yesterday_vendor_count >= 3 THEN 'REMOVED'
            -- Default to watching
            ELSE 'WATCHING'
        END
    ) as status,
    
    -- Price trend
    CASE 
        WHEN pt2.recent_avg IS NULL OR pt2.previous_avg IS NULL THEN 'stable'
        WHEN pt2.recent_avg > pt2.previous_avg * 1.05 THEN 'up'
        WHEN pt2.recent_avg < pt2.previous_avg * 0.95 THEN 'down'
        ELSE 'stable'
    END as price_trend,
    
    -- Price change percentage
    CASE 
        WHEN pt2.previous_avg > 0 
        THEN ROUND(((pt2.recent_avg - pt2.previous_avg) / pt2.previous_avg * 100)::numeric, 2)
        ELSE 0
    END as price_change_pct,
    
    -- Monthly average price
    COALESCE(ROUND(pt2.monthly_avg::numeric, 2), ia.avg_price) as monthly_avg_price,
    
    -- Vendor category
    CASE 
        WHEN ia.domestic_vendor_count >= 3 THEN '3+ Vendors'
        WHEN ia.domestic_vendor_count = 2 THEN '2 Vendors'
        WHEN ia.domestic_vendor_count = 1 THEN '1 Vendor'
        ELSE 'No Domestic'
    END as vendor_category,
    
    -- Additional tracking fields
    CURRENT_DATE - ia.first_seen::date as days_on_watchlist,
    ia.total_qty as qty_available,
    lt.last_tracked_date,
    pt.yesterday_price as previous_price,
    pt.yesterday_vendor_count as previous_vendor_count
    
FROM item_aggregates ia
LEFT JOIN latest_tracking lt ON ia.upc = lt.upc
LEFT JOIN previous_tracking pt ON ia.upc = pt.upc
LEFT JOIN price_trends pt2 ON ia.upc = pt2.upc
ORDER BY ia.domestic_vendor_count DESC, ia.lowest_price ASC;

-- Step 4: Initialize tracking with current data
-- This populates the tracking table with initial snapshot
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
    upc,
    'NEW_CANDIDATE',  -- All items start as new
    total_vendor_count,
    min_price,
    item_name,
    domestic_vendor_count,
    vendor_list,
    CURRENT_DATE
FROM new_items_dashboard
ON CONFLICT (upc, snapshot_date) DO NOTHING;

-- Step 5: Create a scheduled function to run daily (you'll need to set up pg_cron)
-- Or call this function manually or via your application daily
-- SELECT update_watchlist_tracking();

-- Step 6: Grant permissions
GRANT SELECT, INSERT, UPDATE ON watchlist_tracking TO authenticated;
GRANT SELECT ON new_items_dashboard_enhanced TO authenticated;
GRANT SELECT ON new_items_dashboard_enhanced TO anon;

-- Step 7: Test the view
SELECT 
    upc,
    item_name,
    status,
    lowest_price,
    lowest_vendor,
    price_trend,
    domestic_vendor_count,
    last_tracked_date
FROM new_items_dashboard_enhanced
LIMIT 10;