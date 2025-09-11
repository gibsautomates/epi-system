-- ============================================
-- VENDOR-SPECIFIC ANALYSIS QUERIES
-- Analyze vendor behavior and patterns
-- ============================================

-- 1. Vendor Activity Dashboard - See what each vendor did today
SELECT 
    vendor,
    vendor_status,
    COUNT(*) as item_count,
    AVG(price) as avg_price,
    STRING_AGG(item_name, ', ' ORDER BY price LIMIT 5) as sample_items
FROM vendor_item_tracking
WHERE snapshot_date = CURRENT_DATE
GROUP BY vendor, vendor_status
ORDER BY vendor, vendor_status;

-- 2. Top Vendors Adding New Items
SELECT 
    vendor,
    COUNT(*) as new_items_count,
    AVG(price) as avg_price_new_items,
    MIN(price) as lowest_price_offered,
    STRING_AGG(item_name || ' ($' || price || ')', ', ' ORDER BY price LIMIT 3) as top_new_items
FROM vendor_item_tracking
WHERE snapshot_date = CURRENT_DATE
    AND vendor_status = 'NEW'
GROUP BY vendor
ORDER BY new_items_count DESC
LIMIT 10;

-- 3. Vendors Removing Most Items
SELECT 
    vendor,
    COUNT(*) as removed_items_count,
    AVG(price) as avg_price_removed,
    STRING_AGG(item_name, ', ' ORDER BY item_name LIMIT 5) as sample_removed
FROM vendor_item_tracking
WHERE snapshot_date = CURRENT_DATE
    AND vendor_status = 'REMOVED'
GROUP BY vendor
ORDER BY removed_items_count DESC
LIMIT 10;

-- 4. Vendor Stability Score - Which vendors are most consistent
WITH vendor_changes AS (
    SELECT 
        vendor,
        snapshot_date,
        SUM(CASE WHEN vendor_status = 'NEW' THEN 1 ELSE 0 END) as adds,
        SUM(CASE WHEN vendor_status = 'REMOVED' THEN 1 ELSE 0 END) as removes,
        SUM(CASE WHEN vendor_status = 'OFFERING' THEN 1 ELSE 0 END) as stable
    FROM vendor_item_tracking
    WHERE snapshot_date >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY vendor, snapshot_date
)
SELECT 
    vendor,
    SUM(stable) as stable_items,
    SUM(adds) as total_adds,
    SUM(removes) as total_removes,
    ROUND(SUM(stable)::numeric / NULLIF(SUM(stable + adds + removes), 0) * 100, 2) as stability_score
FROM vendor_changes
GROUP BY vendor
HAVING SUM(stable + adds + removes) > 10  -- Only vendors with significant activity
ORDER BY stability_score DESC;

-- 5. Items with Most Vendor Churn
SELECT 
    ned.upc,
    ned.item_name,
    ned.lowest_price,
    ned.domestic_vendor_count as current_vendors,
    ned.vendors_new_count as new_vendors_today,
    ned.vendors_removed_count as lost_vendors_today,
    ned.new_vendors,
    ned.removed_vendors
FROM new_items_dashboard_enhanced ned
WHERE ned.vendors_new_count > 0 OR ned.vendors_removed_count > 0
ORDER BY ned.vendors_removed_count DESC, ned.vendors_new_count DESC
LIMIT 20;

-- 6. Vendor Competition Analysis - Which vendors offer same items
WITH vendor_pairs AS (
    SELECT 
        v1.vendor as vendor1,
        v2.vendor as vendor2,
        COUNT(DISTINCT v1.upc) as shared_items,
        AVG(ABS(v1.price - v2.price)) as avg_price_diff
    FROM vendor_item_tracking v1
    JOIN vendor_item_tracking v2 
        ON v1.upc = v2.upc 
        AND v1.vendor < v2.vendor  -- Avoid duplicates
        AND v1.snapshot_date = v2.snapshot_date
    WHERE v1.snapshot_date = CURRENT_DATE
        AND v1.vendor_status IN ('NEW', 'OFFERING', 'BACK')
        AND v2.vendor_status IN ('NEW', 'OFFERING', 'BACK')
    GROUP BY v1.vendor, v2.vendor
    HAVING COUNT(DISTINCT v1.upc) > 10  -- Only significant overlaps
)
SELECT 
    vendor1,
    vendor2,
    shared_items,
    ROUND(avg_price_diff::numeric, 2) as avg_price_difference,
    CASE 
        WHEN avg_price_diff < 1 THEN 'Very Similar Pricing'
        WHEN avg_price_diff < 5 THEN 'Similar Pricing'
        WHEN avg_price_diff < 10 THEN 'Moderate Difference'
        ELSE 'Large Difference'
    END as price_alignment
FROM vendor_pairs
ORDER BY shared_items DESC
LIMIT 20;

-- 7. Weekly Vendor Performance Trend
SELECT 
    vendor,
    DATE_TRUNC('week', snapshot_date) as week,
    SUM(CASE WHEN vendor_status = 'NEW' THEN 1 ELSE 0 END) as items_added,
    SUM(CASE WHEN vendor_status = 'REMOVED' THEN 1 ELSE 0 END) as items_removed,
    COUNT(DISTINCT upc) as unique_items,
    AVG(CASE WHEN price > 0 THEN price END) as avg_price
FROM vendor_item_tracking
WHERE snapshot_date >= CURRENT_DATE - INTERVAL '4 weeks'
GROUP BY vendor, DATE_TRUNC('week', snapshot_date)
ORDER BY vendor, week DESC;

-- 8. Find Items Where Specific Vendor Changed Status
-- Replace 'CBS' with vendor of interest
SELECT 
    vit.upc,
    vit.item_name,
    vit.vendor_status as vendor_status_today,
    vit.price as current_price,
    vit_old.vendor_status as vendor_status_yesterday,
    vit_old.price as yesterday_price,
    ned.global_status,
    ned.domestic_vendor_count
FROM vendor_item_tracking vit
LEFT JOIN vendor_item_tracking vit_old 
    ON vit.upc = vit_old.upc 
    AND vit.vendor = vit_old.vendor
    AND vit_old.snapshot_date = CURRENT_DATE - INTERVAL '1 day'
LEFT JOIN new_items_dashboard_enhanced ned ON vit.upc = ned.upc
WHERE vit.vendor = 'CBS'
    AND vit.snapshot_date = CURRENT_DATE
    AND (vit.vendor_status != COALESCE(vit_old.vendor_status, 'NONE'))
ORDER BY vit.vendor_status, vit.price;

-- 9. Vendor Portfolio Analysis
SELECT 
    v.vendor,
    COUNT(DISTINCT CASE WHEN price < 25 THEN upc END) as items_under_25,
    COUNT(DISTINCT CASE WHEN price BETWEEN 25 AND 50 THEN upc END) as items_25_to_50,
    COUNT(DISTINCT CASE WHEN price BETWEEN 50 AND 100 THEN upc END) as items_50_to_100,
    COUNT(DISTINCT CASE WHEN price > 100 THEN upc END) as items_over_100,
    COUNT(DISTINCT upc) as total_items,
    MIN(price) as min_price,
    MAX(price) as max_price,
    AVG(price) as avg_price
FROM vendor_item_tracking v
WHERE snapshot_date = CURRENT_DATE
    AND vendor_status IN ('NEW', 'OFFERING', 'BACK')
GROUP BY vendor
ORDER BY total_items DESC;

-- 10. Alert: Items Lost by Multiple Vendors
SELECT 
    ned.upc,
    ned.item_name,
    ned.lowest_price,
    ned.vendors_removed_count,
    ned.removed_vendors,
    ned.domestic_vendor_count as remaining_vendors,
    CASE 
        WHEN ned.domestic_vendor_count < 3 THEN 'CRITICAL - Below 3 vendors'
        WHEN ned.vendors_removed_count >= 3 THEN 'WARNING - Lost 3+ vendors'
        ELSE 'MONITOR'
    END as alert_level
FROM new_items_dashboard_enhanced ned
WHERE ned.vendors_removed_count > 0
ORDER BY 
    CASE 
        WHEN ned.domestic_vendor_count < 3 THEN 1
        WHEN ned.vendors_removed_count >= 3 THEN 2
        ELSE 3
    END,
    ned.vendors_removed_count DESC
LIMIT 20;