-- SUPABASE VIEW for Optimized Dashboard Data Fetching
-- This view pre-filters vendor offers to only the latest file per vendor within 21 days

-- Step 1: Create a view that identifies the latest date for each vendor within 21 days
CREATE OR REPLACE VIEW vendor_latest_dates AS
SELECT 
    vendor,
    MAX(date) as latest_date
FROM vendor_offers
WHERE date >= CURRENT_DATE - INTERVAL '21 days'
GROUP BY vendor;

-- Step 2: Create the main view that joins to get only the latest offers
CREATE OR REPLACE VIEW vendor_offers_latest AS
SELECT 
    vo.*,
    ve.location as vendor_location
FROM vendor_offers vo
INNER JOIN vendor_latest_dates vld 
    ON vo.vendor = vld.vendor 
    AND vo.date = vld.latest_date
LEFT JOIN vendors_expected ve 
    ON vo.vendor = ve.vendor;

-- Step 3: Create a summary view for quick metrics
CREATE OR REPLACE VIEW dashboard_metrics_summary AS
WITH latest_offers AS (
    SELECT * FROM vendor_offers_latest
),
inventory AS (
    SELECT COUNT(DISTINCT upc_text) as total_inventory
    FROM current_inventory
)
SELECT 
    COUNT(DISTINCT lo.vendor) as total_vendors,
    COUNT(*) as total_offers,
    COUNT(DISTINCT lo.upc) as unique_items,
    COUNT(DISTINCT CASE WHEN lo.vendor_location = 'Domestic' THEN lo.vendor END) as domestic_vendors,
    COUNT(DISTINCT CASE WHEN lo.vendor_location = 'International' THEN lo.vendor END) as international_vendors,
    (SELECT total_inventory FROM inventory) as inventory_count
FROM latest_offers lo;

-- Usage in your API:
-- Instead of complex pagination and filtering, just query:
-- SELECT * FROM vendor_offers_latest;
-- This gives you ALL the latest offers directly!

-- For metrics:
-- SELECT * FROM dashboard_metrics_summary;

-- Benefits:
-- 1. No need to paginate through 101,000 vendor dates
-- 2. No need to filter for latest dates in application code
-- 3. Much faster - database does the heavy lifting
-- 4. Always returns complete data (no limits)
-- 5. Single query instead of 100+ queries

-- Step 4: Create a view for NEW ITEMS ONLY (not in current inventory)
-- Note: current_inventory has both UPC (numeric) and upc_text (text) columns
CREATE OR REPLACE VIEW vendor_offers_latest_new AS
SELECT 
    vol.*
FROM vendor_offers_latest vol
WHERE NOT EXISTS (
    SELECT 1 
    FROM current_inventory ci 
    WHERE ci.upc_text = CAST(vol.upc AS TEXT)
);

-- Step 5: Create aggregated view by UPC for new items with vendor details
CREATE OR REPLACE VIEW new_items_dashboard AS
WITH item_aggregates AS (
    SELECT 
        upc,
        MAX(item_name) as item_name,  -- Longest name
        MAX(brand) as brand,
        MAX(sku) as sku,
        MIN(CASE WHEN price > 0 THEN price END) as min_price,
        MAX(CASE WHEN price > 0 THEN price END) as max_price,
        AVG(CASE WHEN price > 0 THEN price END) as avg_price,
        COUNT(DISTINCT vendor) as total_vendor_count,
        COUNT(DISTINCT CASE WHEN vendor_location = 'Domestic' THEN vendor END) as domestic_vendor_count,
        COUNT(DISTINCT CASE WHEN vendor_location = 'International' THEN vendor END) as international_vendor_count,
        STRING_AGG(DISTINCT vendor, ', ' ORDER BY vendor) as vendor_list,
        MIN(date) as first_seen,
        MAX(date) as last_seen,
        SUM(qty) as total_qty,
        COUNT(*) as offer_count
    FROM vendor_offers_latest_new
    GROUP BY upc
)
SELECT 
    *,
    CASE 
        WHEN domestic_vendor_count >= 3 THEN '3+ Vendors'
        WHEN domestic_vendor_count = 2 THEN '2 Vendors'
        WHEN domestic_vendor_count = 1 THEN '1 Vendor'
        ELSE 'No Domestic'
    END as vendor_category
FROM item_aggregates
ORDER BY domestic_vendor_count DESC, min_price ASC;

-- Usage examples:
-- Get all new items with 3+ domestic vendors:
-- SELECT * FROM new_items_dashboard WHERE domestic_vendor_count >= 3;

-- Get count of new items by vendor category:
-- SELECT vendor_category, COUNT(*) FROM new_items_dashboard GROUP BY vendor_category;