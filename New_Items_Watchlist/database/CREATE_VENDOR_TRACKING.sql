-- ============================================
-- VENDOR-LEVEL TRACKING SYSTEM
-- Track item status changes per individual vendor
-- ============================================

-- Step 1: Create vendor-level tracking table
CREATE TABLE IF NOT EXISTS vendor_item_tracking (
    id SERIAL PRIMARY KEY,
    upc BIGINT NOT NULL,
    vendor VARCHAR(100) NOT NULL,
    vendor_status VARCHAR(20) NOT NULL,  -- NEW, OFFERING, REMOVED, BACK
    price NUMERIC(10,2),
    qty INTEGER,
    item_name TEXT,
    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Composite unique constraint
    UNIQUE(upc, vendor, snapshot_date)
);

-- Create indexes for performance
CREATE INDEX idx_vendor_tracking_upc ON vendor_item_tracking(upc);
CREATE INDEX idx_vendor_tracking_vendor ON vendor_item_tracking(vendor);
CREATE INDEX idx_vendor_tracking_date ON vendor_item_tracking(snapshot_date DESC);
CREATE INDEX idx_vendor_tracking_status ON vendor_item_tracking(vendor_status);

-- Step 2: Function to update vendor-level tracking
CREATE OR REPLACE FUNCTION update_vendor_tracking()
RETURNS void AS $$
DECLARE
    yesterday_date DATE := CURRENT_DATE - INTERVAL '1 day';
BEGIN
    -- Insert/update today's vendor-item relationships
    INSERT INTO vendor_item_tracking (
        upc,
        vendor,
        vendor_status,
        price,
        qty,
        item_name,
        snapshot_date
    )
    SELECT 
        vol.upc,
        vol.vendor,
        CASE 
            -- Check if this vendor offered this item yesterday
            WHEN vt_yesterday.vendor IS NULL THEN 'NEW'
            -- Check if vendor removed it recently and now back
            WHEN vt_recent_removed.vendor IS NOT NULL THEN 'BACK'
            -- Otherwise vendor is still offering it
            ELSE 'OFFERING'
        END as vendor_status,
        vol.price,
        vol.qty,
        vol.item_name,
        CURRENT_DATE
    FROM vendor_offers_latest_new vol
    LEFT JOIN vendor_item_tracking vt_yesterday 
        ON vol.upc = vt_yesterday.upc 
        AND vol.vendor = vt_yesterday.vendor
        AND vt_yesterday.snapshot_date = yesterday_date
        AND vt_yesterday.vendor_status IN ('OFFERING', 'NEW', 'BACK')
    LEFT JOIN LATERAL (
        SELECT vendor 
        FROM vendor_item_tracking 
        WHERE upc = vol.upc 
            AND vendor = vol.vendor
            AND vendor_status = 'REMOVED'
            AND snapshot_date >= CURRENT_DATE - INTERVAL '7 days'
        LIMIT 1
    ) vt_recent_removed ON true
    ON CONFLICT (upc, vendor, snapshot_date) 
    DO UPDATE SET 
        vendor_status = EXCLUDED.vendor_status,
        price = EXCLUDED.price,
        qty = EXCLUDED.qty,
        item_name = EXCLUDED.item_name;
    
    -- Mark items as REMOVED if vendor stopped offering them
    INSERT INTO vendor_item_tracking (
        upc,
        vendor,
        vendor_status,
        price,
        qty,
        item_name,
        snapshot_date
    )
    SELECT 
        vt.upc,
        vt.vendor,
        'REMOVED',
        vt.price,  -- Keep last known price
        0,
        vt.item_name,
        CURRENT_DATE
    FROM vendor_item_tracking vt
    WHERE vt.snapshot_date = yesterday_date
        AND vt.vendor_status IN ('OFFERING', 'NEW', 'BACK')
        AND NOT EXISTS (
            SELECT 1 
            FROM vendor_offers_latest_new vol
            WHERE vol.upc = vt.upc 
                AND vol.vendor = vt.vendor
        )
    ON CONFLICT (upc, vendor, snapshot_date) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Enhanced view with both global and vendor-level status
DROP VIEW IF EXISTS new_items_dashboard_enhanced CASCADE;

CREATE OR REPLACE VIEW new_items_dashboard_enhanced AS
WITH item_details AS (
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
        MIN(CASE WHEN price > 0 THEN price END) as lowest_price,
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
        MAX(CASE WHEN id.price_rank = 1 THEN id.vendor END) as lowest_vendor
    FROM item_details id
    GROUP BY upc
),
global_tracking AS (
    SELECT DISTINCT ON (upc) 
        upc,
        status as global_status,
        snapshot_date as last_tracked_date
    FROM watchlist_tracking
    ORDER BY upc, snapshot_date DESC
),
vendor_status_summary AS (
    -- Aggregate vendor-level statuses for today
    SELECT 
        upc,
        COUNT(CASE WHEN vendor_status = 'NEW' THEN 1 END) as vendors_new,
        COUNT(CASE WHEN vendor_status = 'OFFERING' THEN 1 END) as vendors_offering,
        COUNT(CASE WHEN vendor_status = 'REMOVED' THEN 1 END) as vendors_removed,
        COUNT(CASE WHEN vendor_status = 'BACK' THEN 1 END) as vendors_back,
        STRING_AGG(
            CASE WHEN vendor_status = 'NEW' THEN vendor END, 
            ', ' ORDER BY vendor
        ) as new_vendors,
        STRING_AGG(
            CASE WHEN vendor_status = 'REMOVED' THEN vendor END, 
            ', ' ORDER BY vendor
        ) as removed_vendors
    FROM vendor_item_tracking
    WHERE snapshot_date = CURRENT_DATE
    GROUP BY upc
),
price_trends AS (
    SELECT 
        upc,
        AVG(CASE 
            WHEN date >= CURRENT_DATE - INTERVAL '7 days' 
            THEN AVG(CASE WHEN price > 0 THEN price END)
        END) as recent_avg,
        AVG(CASE 
            WHEN date < CURRENT_DATE - INTERVAL '7 days' 
            AND date >= CURRENT_DATE - INTERVAL '28 days'
            THEN AVG(CASE WHEN price > 0 THEN price END)
        END) as previous_avg,
        AVG(CASE WHEN price > 0 THEN price END) as monthly_avg
    FROM vendor_offers
    WHERE date >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY upc, date
)
SELECT 
    ia.*,
    
    -- Global status (overall item status)
    COALESCE(gt.global_status, 'NEW_CANDIDATE') as global_status,
    
    -- Vendor-level tracking summary
    COALESCE(vss.vendors_new, 0) as vendors_new_count,
    COALESCE(vss.vendors_offering, 0) as vendors_offering_count,
    COALESCE(vss.vendors_removed, 0) as vendors_removed_count,
    COALESCE(vss.vendors_back, 0) as vendors_back_count,
    vss.new_vendors,
    vss.removed_vendors,
    
    -- Vendor status indicator (for quick filtering)
    CASE 
        WHEN vss.vendors_new > 0 THEN 'HAS_NEW_VENDORS'
        WHEN vss.vendors_removed > 0 THEN 'LOST_VENDORS'
        WHEN vss.vendors_back > 0 THEN 'REGAINED_VENDORS'
        ELSE 'STABLE_VENDORS'
    END as vendor_change_status,
    
    -- Price trend
    CASE 
        WHEN pt.recent_avg IS NULL OR pt.previous_avg IS NULL THEN 'stable'
        WHEN pt.recent_avg > pt.previous_avg * 1.05 THEN 'up'
        WHEN pt.recent_avg < pt.previous_avg * 0.95 THEN 'down'
        ELSE 'stable'
    END as price_trend,
    
    ROUND(((pt.recent_avg - pt.previous_avg) / NULLIF(pt.previous_avg, 0) * 100)::numeric, 2) as price_change_pct,
    COALESCE(ROUND(pt.monthly_avg::numeric, 2), ia.avg_price) as monthly_avg_price,
    
    -- Vendor category
    CASE 
        WHEN ia.domestic_vendor_count >= 3 THEN '3+ Vendors'
        WHEN ia.domestic_vendor_count = 2 THEN '2 Vendors'
        WHEN ia.domestic_vendor_count = 1 THEN '1 Vendor'
        ELSE 'No Domestic'
    END as vendor_category,
    
    CURRENT_DATE - ia.first_seen::date as days_on_watchlist,
    ia.total_qty as qty_available,
    gt.last_tracked_date
    
FROM item_aggregates ia
LEFT JOIN global_tracking gt ON ia.upc = gt.upc
LEFT JOIN vendor_status_summary vss ON ia.upc = vss.upc
LEFT JOIN price_trends pt ON ia.upc = pt.upc
ORDER BY ia.domestic_vendor_count DESC, ia.lowest_price ASC;

-- Step 4: Vendor analysis view
CREATE OR REPLACE VIEW vendor_performance_analysis AS
SELECT 
    vendor,
    snapshot_date,
    COUNT(CASE WHEN vendor_status = 'NEW' THEN 1 END) as items_added,
    COUNT(CASE WHEN vendor_status = 'REMOVED' THEN 1 END) as items_removed,
    COUNT(CASE WHEN vendor_status = 'BACK' THEN 1 END) as items_returned,
    COUNT(CASE WHEN vendor_status = 'OFFERING' THEN 1 END) as items_continuing,
    COUNT(*) as total_items,
    AVG(CASE WHEN price > 0 THEN price END) as avg_price
FROM vendor_item_tracking
WHERE snapshot_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY vendor, snapshot_date
ORDER BY snapshot_date DESC, vendor;

-- Step 5: Initialize vendor tracking with current data
INSERT INTO vendor_item_tracking (
    upc,
    vendor,
    vendor_status,
    price,
    qty,
    item_name,
    snapshot_date
)
SELECT 
    upc,
    vendor,
    'NEW',  -- All current items start as new for each vendor
    price,
    qty,
    item_name,
    CURRENT_DATE
FROM vendor_offers_latest_new
ON CONFLICT (upc, vendor, snapshot_date) DO NOTHING;

-- Step 6: Combined daily update function
CREATE OR REPLACE FUNCTION run_complete_tracking_update()
RETURNS TABLE(
    update_type TEXT,
    status TEXT,
    count INTEGER
) AS $$
BEGIN
    -- Update global tracking
    PERFORM update_watchlist_tracking();
    
    -- Update vendor tracking
    PERFORM update_vendor_tracking();
    
    -- Return combined summary
    RETURN QUERY
    -- Global status counts
    SELECT 
        'GLOBAL'::TEXT as update_type,
        status,
        COUNT(*)::INTEGER
    FROM watchlist_tracking
    WHERE snapshot_date = CURRENT_DATE
    GROUP BY status
    
    UNION ALL
    
    -- Vendor status counts
    SELECT 
        'VENDOR'::TEXT as update_type,
        vendor_status as status,
        COUNT(*)::INTEGER
    FROM vendor_item_tracking
    WHERE snapshot_date = CURRENT_DATE
    GROUP BY vendor_status
    
    ORDER BY update_type, status;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Grant permissions
GRANT SELECT, INSERT, UPDATE ON vendor_item_tracking TO authenticated;
GRANT SELECT ON vendor_performance_analysis TO authenticated;
GRANT SELECT ON vendor_performance_analysis TO anon;