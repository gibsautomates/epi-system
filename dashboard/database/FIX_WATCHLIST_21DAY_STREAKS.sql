-- ============================================
-- COMPLETE WATCHLIST FIX: 21-DAY LOGIC + STREAK RECALCULATION
-- This script fixes both the streak reset issue and implements proper 21-day vendor logic
-- ============================================

-- STEP 1: RECALCULATE ACTUAL STREAKS FROM HISTORICAL DATA
-- ============================================
CREATE OR REPLACE FUNCTION recalculate_streak_data()
RETURNS void AS $$
DECLARE
    rec RECORD;
    current_status VARCHAR;
    current_streak INTEGER;
    previous_status VARCHAR;
BEGIN
    -- For each unique UPC, recalculate streaks based on actual status transitions
    FOR rec IN 
        SELECT DISTINCT upc 
        FROM watchlist_tracking 
        ORDER BY upc
    LOOP
        current_status := NULL;
        current_streak := 0;
        previous_status := NULL;
        
        -- Process each UPC's tracking records in chronological order
        FOR rec IN 
            SELECT * FROM watchlist_tracking 
            WHERE upc = rec.upc 
            ORDER BY snapshot_date ASC, created_at ASC
        LOOP
            -- If this is the first record or status changed, reset streak
            IF current_status IS NULL OR current_status != rec.status THEN
                previous_status := current_status;
                current_status := rec.status;
                current_streak := 1;
            ELSE
                -- Same status, increment streak
                current_streak := current_streak + 1;
            END IF;
            
            -- Update the record with correct streak values
            UPDATE watchlist_tracking 
            SET 
                status_streak = current_streak,
                previous_status = previous_status
            WHERE id = rec.id;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Streak recalculation completed for all items';
END;
$$ LANGUAGE plpgsql;

-- STEP 2: CREATE NEW 21-DAY DASHBOARD VIEW
-- ============================================
DROP VIEW IF EXISTS new_items_dashboard_21day CASCADE;

CREATE OR REPLACE VIEW new_items_dashboard_21day AS
WITH vendor_offers_21d AS (
    -- Get latest offer from each vendor within 21 days
    SELECT DISTINCT ON (upc, vendor)
        upc,
        item_name,
        brand,
        vendor,
        price,
        qty,
        date as offer_date,
        location,
        msrp
    FROM vendor_offers
    WHERE date >= CURRENT_DATE - INTERVAL '21 days'
        AND price IS NOT NULL
    ORDER BY upc, vendor, date DESC
),
items_with_3plus_domestic AS (
    -- Only items with 3+ domestic vendors
    SELECT 
        vo.upc,
        MAX(vo.item_name) as item_name,
        MAX(vo.brand) as brand,
        COUNT(DISTINCT CASE WHEN vo.location = 'Domestic' THEN vo.vendor END) as domestic_vendor_count,
        COUNT(DISTINCT vo.vendor) as total_vendor_count,
        MIN(CASE WHEN vo.location = 'Domestic' THEN vo.price END) as min_price,
        AVG(CASE WHEN vo.location = 'Domestic' THEN vo.price END) as avg_price,
        MAX(CASE WHEN vo.location = 'Domestic' THEN vo.price END) as max_price,
        SUM(CASE WHEN vo.location = 'Domestic' THEN COALESCE(vo.qty, 0) END) as total_qty,
        MIN(vo.offer_date) as first_seen,
        MAX(vo.offer_date) as last_seen,
        STRING_AGG(DISTINCT CASE WHEN vo.location = 'Domestic' THEN vo.vendor END, ', ' ORDER BY CASE WHEN vo.location = 'Domestic' THEN vo.vendor END) as vendor_list,
        ARRAY_AGG(DISTINCT CASE WHEN vo.location = 'Domestic' THEN vo.vendor END) as vendor_array
    FROM vendor_offers_21d vo
    GROUP BY vo.upc
    HAVING COUNT(DISTINCT CASE WHEN vo.location = 'Domestic' THEN vo.vendor END) >= 3
),
latest_tracking AS (
    -- Get most recent tracking data for each item
    SELECT DISTINCT ON (upc) 
        upc,
        status,
        snapshot_date,
        status_streak,
        times_seen,
        previous_status
    FROM watchlist_tracking
    ORDER BY upc, snapshot_date DESC, created_at DESC
),
previous_tracking AS (
    -- Get previous tracking data for comparison
    SELECT DISTINCT ON (wt.upc)
        wt.upc,
        wt.status as prev_status,
        wt.lowest_price as prev_price,
        wt.domestic_vendor_count as prev_vendor_count,
        wt.snapshot_date as prev_date
    FROM watchlist_tracking wt
    INNER JOIN (
        SELECT DISTINCT upc, snapshot_date
        FROM watchlist_tracking
        WHERE snapshot_date < (SELECT MAX(snapshot_date) FROM watchlist_tracking)
    ) prev_dates ON wt.upc = prev_dates.upc AND wt.snapshot_date = prev_dates.snapshot_date
    ORDER BY wt.upc, wt.snapshot_date DESC, wt.created_at DESC
)
SELECT 
    i3d.upc,
    i3d.item_name,
    i3d.brand,
    i3d.domestic_vendor_count,
    i3d.total_vendor_count as total_vendor_count,
    i3d.min_price,
    i3d.avg_price,
    i3d.max_price,
    i3d.total_qty,
    i3d.first_seen,
    i3d.last_seen,
    i3d.vendor_list,
    
    -- Status from tracking or determine new status
    COALESCE(
        lt.status,
        CASE 
            WHEN lt.upc IS NULL THEN 'NEW_CANDIDATE'
            ELSE 'WATCHING'
        END
    ) as status,
    
    -- Price trend analysis
    CASE 
        WHEN pt.prev_price IS NULL THEN 'new'
        WHEN i3d.min_price > pt.prev_price * 1.05 THEN 'up'
        WHEN i3d.min_price < pt.prev_price * 0.95 THEN 'down'
        ELSE 'stable'
    END as price_trend,
    
    CASE 
        WHEN pt.prev_price > 0 AND pt.prev_price IS NOT NULL
        THEN ROUND(((i3d.min_price - pt.prev_price) / pt.prev_price * 100)::numeric, 2)
        ELSE 0
    END as price_change_pct,
    
    -- Days calculations
    CURRENT_DATE - i3d.first_seen::date as days_on_watchlist,
    
    -- Tracking information
    lt.snapshot_date as last_tracked_date,
    pt.prev_date as previous_update_date,
    CASE 
        WHEN pt.prev_date IS NOT NULL 
        THEN CURRENT_DATE - pt.prev_date 
        ELSE NULL 
    END as days_since_last_update,
    
    -- Previous values
    pt.prev_price as previous_price,
    pt.prev_vendor_count as previous_vendor_count,
    
    -- Vendor change analysis
    CASE 
        WHEN pt.prev_vendor_count IS NULL THEN i3d.domestic_vendor_count
        ELSE i3d.domestic_vendor_count - pt.prev_vendor_count
    END as vendor_count_change,
    
    CASE 
        WHEN pt.prev_vendor_count IS NULL THEN 'NEW'
        WHEN i3d.domestic_vendor_count > pt.prev_vendor_count THEN 'GAINING_VENDORS'
        WHEN i3d.domestic_vendor_count < pt.prev_vendor_count THEN 'LOSING_VENDORS'
        ELSE 'STABLE_VENDORS'
    END as vendor_change_status,
    
    -- Streak information (corrected)
    COALESCE(lt.status_streak, 1) as status_streak,
    COALESCE(lt.times_seen, 1) as times_seen,
    lt.previous_status
    
FROM items_with_3plus_domestic i3d
LEFT JOIN latest_tracking lt ON i3d.upc = lt.upc
LEFT JOIN previous_tracking pt ON i3d.upc = pt.upc
ORDER BY i3d.domestic_vendor_count DESC, i3d.min_price ASC;

-- STEP 3: CREATE UPDATED TRACKING FUNCTION WITH 21-DAY LOGIC
-- ============================================
CREATE OR REPLACE FUNCTION update_watchlist_tracking_21day()
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
    
    -- Insert today's snapshot using 21-day logic
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
        nd.upc,
        CASE 
            -- New item never seen before
            WHEN prev.upc IS NULL THEN 'NEW_CANDIDATE'
            -- Item was removed and is now back
            WHEN prev.status = 'REMOVED' THEN 'BACK_IN_FEED'
            -- Check if item was acquired
            WHEN EXISTS (
                SELECT 1 FROM current_inventory ci 
                WHERE ci.upc_text = nd.upc
            ) THEN 'ACQUIRED'
            -- Otherwise it's being watched
            ELSE 'WATCHING'
        END as status,
        nd.total_vendor_count,
        nd.min_price,
        nd.item_name,
        nd.domestic_vendor_count,
        nd.vendor_list,
        CURRENT_DATE,
        
        -- Calculate status streak with proper logic
        CASE 
            WHEN prev.upc IS NULL THEN 1  -- First time seen
            WHEN prev.status = 'REMOVED' AND nd.domestic_vendor_count >= 3 THEN 1  -- Reset streak when back
            WHEN prev.status = CASE 
                WHEN EXISTS (SELECT 1 FROM current_inventory ci WHERE ci.upc_text = nd.upc) THEN 'ACQUIRED'
                ELSE 'WATCHING'
            END THEN COALESCE(prev.status_streak, 0) + 1  -- Same status, increment streak
            ELSE 1  -- Status changed, reset streak
        END,
        
        -- Increment times seen properly
        COALESCE(prev.times_seen, 0) + 1,
        -- Store previous status
        prev.status
        
    FROM new_items_dashboard_21day nd
    LEFT JOIN (
        -- Get the most recent tracking record for each item
        SELECT DISTINCT ON (upc) 
            upc, status, domestic_vendor_count, lowest_price, status_streak, times_seen
        FROM watchlist_tracking
        WHERE snapshot_date = last_update_date
        ORDER BY upc, created_at DESC
    ) prev ON nd.upc = prev.upc
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
        
    -- Mark items as REMOVED if they haven't been seen for 21+ days
    -- (Only if they were previously being tracked and now fall outside 21-day window)
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
        SELECT 1 FROM new_items_dashboard_21day nd 
        WHERE nd.upc = prev.upc
    )
    ON CONFLICT (upc, snapshot_date) DO NOTHING;
    
    -- Log summary
    RAISE NOTICE 'Update complete. New snapshot created for % using 21-day logic', CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- STEP 4: UPDATE THE ENHANCED VIEW TO USE 21-DAY DATA
-- ============================================
DROP VIEW IF EXISTS new_items_dashboard_enhanced CASCADE;

-- Create the enhanced view as an alias to the 21-day view for compatibility
CREATE OR REPLACE VIEW new_items_dashboard_enhanced AS
SELECT * FROM new_items_dashboard_21day;

-- STEP 5: EXECUTION COMMANDS
-- ============================================

-- Execute streak recalculation (fixes the "all showing 1" issue)
SELECT recalculate_streak_data();

-- Run the 21-day update function to populate with correct data
SELECT update_watchlist_tracking_21day();

-- STEP 6: GRANT PERMISSIONS
-- ============================================
GRANT SELECT ON new_items_dashboard_21day TO authenticated;
GRANT SELECT ON new_items_dashboard_21day TO anon;
GRANT SELECT ON new_items_dashboard_21day TO service_role;

GRANT EXECUTE ON FUNCTION recalculate_streak_data() TO authenticated;
GRANT EXECUTE ON FUNCTION update_watchlist_tracking_21day() TO authenticated;
GRANT EXECUTE ON FUNCTION recalculate_streak_data() TO service_role;
GRANT EXECUTE ON FUNCTION update_watchlist_tracking_21day() TO service_role;

-- STEP 7: VERIFICATION QUERIES
-- ============================================

-- Check streak distribution after fix
SELECT 
    status,
    COUNT(*) as item_count,
    MIN(status_streak) as min_streak,
    MAX(status_streak) as max_streak,
    AVG(status_streak) as avg_streak
FROM new_items_dashboard_enhanced
GROUP BY status;

-- Check date ranges
SELECT 
    MIN(first_seen) as earliest_item,
    MAX(last_seen) as latest_offer,
    COUNT(*) as total_items
FROM new_items_dashboard_enhanced;

-- Sample of items with their streaks
SELECT 
    upc,
    item_name,
    status,
    status_streak,
    times_seen,
    days_on_watchlist,
    domestic_vendor_count,
    vendor_change_status
FROM new_items_dashboard_enhanced
ORDER BY status_streak DESC
LIMIT 10;

RAISE NOTICE 'WATCHLIST 21-DAY FIX COMPLETED SUCCESSFULLY!';
RAISE NOTICE 'Streaks have been recalculated and 21-day vendor logic is now active.';