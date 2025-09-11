-- =====================================================
-- THREE-LEVEL VIEW SYSTEM FOR NEW ITEMS TRACKING
-- Run this in Supabase SQL Editor to create all views
-- =====================================================

-- 1. VENDOR LEVEL VIEW - Track each vendor's items individually
-- Shows missing/new/active status for each vendor specifically
CREATE OR REPLACE VIEW vendor_item_status_view AS
WITH vendor_latest AS (
  -- Get the most recent submission date for each vendor
  SELECT 
    vendor,
    location,
    MAX(date) as last_submission_date,
    COUNT(DISTINCT upc_text) as total_items
  FROM vendor_offers
  GROUP BY vendor, location
),
vendor_items AS (
  -- Get all items for each vendor with their latest info
  SELECT DISTINCT ON (vendor, upc_text)
    vo.vendor,
    vo.upc_text as upc,
    vo.item_name,
    vo.brand,
    vo.location,
    vo.price,
    vo.qty,
    vo.date as last_seen_date,
    vl.last_submission_date as vendor_last_submission
  FROM vendor_offers vo
  JOIN vendor_latest vl ON vo.vendor = vl.vendor
  ORDER BY vendor, upc_text, date DESC
),
inventory_check AS (
  -- Check if items are in current inventory
  SELECT DISTINCT upc_text FROM current_inventory
)
SELECT 
  vi.*,
  CASE 
    WHEN ic.upc_text IS NOT NULL THEN 'IN_INVENTORY'
    WHEN vi.last_seen_date = vi.vendor_last_submission THEN 'ACTIVE'
    WHEN vi.last_seen_date < vi.vendor_last_submission THEN 'MISSING'
    ELSE 'UNKNOWN'
  END as vendor_status,
  CASE 
    WHEN vi.last_seen_date < vi.vendor_last_submission 
    THEN DATE_PART('day', vi.vendor_last_submission::timestamp - vi.last_seen_date::timestamp)
    ELSE 0
  END as days_missing,
  ic.upc_text IS NULL as is_new_item
FROM vendor_items vi
LEFT JOIN inventory_check ic ON vi.upc = ic.upc_text;

-- 2. DOMESTIC LEVEL VIEW - Aggregate all domestic vendors
-- Shows combined domestic vendor availability
CREATE OR REPLACE VIEW domestic_item_status_view AS
WITH domestic_items AS (
  -- Get all unique items from domestic vendors
  SELECT 
    upc_text as upc,
    item_name,
    brand,
    COUNT(DISTINCT vendor) as domestic_vendor_count,
    STRING_AGG(DISTINCT vendor, ', ' ORDER BY vendor) as domestic_vendors,
    MIN(price) FILTER (WHERE price > 0) as min_price,
    AVG(price) FILTER (WHERE price > 0) as avg_price,
    MAX(price) FILTER (WHERE price > 0) as max_price,
    MIN(date) as first_seen_domestic,
    MAX(date) as last_seen_domestic,
    SUM(qty) FILTER (WHERE qty > 0) as total_qty_available
  FROM vendor_offers
  WHERE location = 'Domestic'
  GROUP BY upc_text, item_name, brand
),
recent_activity AS (
  -- Check if item had recent activity (last 21 days)
  SELECT 
    upc_text as upc,
    COUNT(DISTINCT vendor) as recent_vendor_count,
    MAX(date) as most_recent_date
  FROM vendor_offers
  WHERE location = 'Domestic' 
    AND date >= CURRENT_DATE - INTERVAL '21 days'
  GROUP BY upc_text
),
inventory_check AS (
  SELECT DISTINCT upc_text FROM current_inventory
)
SELECT 
  di.*,
  ra.recent_vendor_count,
  ra.most_recent_date,
  CASE 
    WHEN ic.upc_text IS NOT NULL THEN 'IN_INVENTORY'
    WHEN ra.most_recent_date >= CURRENT_DATE - INTERVAL '21 days' THEN 'ACTIVE'
    WHEN ra.most_recent_date >= CURRENT_DATE - INTERVAL '42 days' THEN 'STALE'
    ELSE 'INACTIVE'
  END as domestic_status,
  ic.upc_text IS NULL as is_new_item,
  DATE_PART('day', CURRENT_DATE::timestamp - di.last_seen_domestic::timestamp) as days_since_last_seen,
  -- Flag items with 3+ domestic vendors
  di.domestic_vendor_count >= 3 as qualifies_for_client
FROM domestic_items di
LEFT JOIN recent_activity ra ON di.upc = ra.upc
LEFT JOIN inventory_check ic ON di.upc = ic.upc_text;

-- 3. GLOBAL LEVEL VIEW - Combined domestic and international
-- Shows complete global availability
CREATE OR REPLACE VIEW global_item_status_view AS
WITH all_items AS (
  -- Get all unique items from all vendors
  SELECT 
    upc_text as upc,
    item_name,
    brand,
    COUNT(DISTINCT vendor) FILTER (WHERE location = 'Domestic') as domestic_vendor_count,
    COUNT(DISTINCT vendor) FILTER (WHERE location = 'International') as international_vendor_count,
    COUNT(DISTINCT vendor) as total_vendor_count,
    STRING_AGG(DISTINCT vendor, ', ' ORDER BY vendor) FILTER (WHERE location = 'Domestic') as domestic_vendors,
    STRING_AGG(DISTINCT vendor, ', ' ORDER BY vendor) FILTER (WHERE location = 'International') as international_vendors,
    MIN(price) FILTER (WHERE price > 0 AND location = 'Domestic') as min_price_domestic,
    AVG(price) FILTER (WHERE price > 0 AND location = 'Domestic') as avg_price_domestic,
    MAX(price) FILTER (WHERE price > 0 AND location = 'Domestic') as max_price_domestic,
    MIN(price) FILTER (WHERE price > 0 AND location = 'International') as min_price_international,
    AVG(price) FILTER (WHERE price > 0 AND location = 'International') as avg_price_international,
    MIN(date) as first_seen_global,
    MAX(date) as last_seen_global,
    MIN(date) FILTER (WHERE location = 'Domestic') as first_seen_domestic,
    MAX(date) FILTER (WHERE location = 'Domestic') as last_seen_domestic,
    SUM(qty) FILTER (WHERE qty > 0) as total_qty_global
  FROM vendor_offers
  GROUP BY upc_text, item_name, brand
),
recent_activity AS (
  -- Check recent activity globally
  SELECT 
    upc_text as upc,
    COUNT(DISTINCT vendor) as recent_vendor_count,
    COUNT(DISTINCT vendor) FILTER (WHERE location = 'Domestic') as recent_domestic_count,
    MAX(date) as most_recent_date
  FROM vendor_offers
  WHERE date >= CURRENT_DATE - INTERVAL '21 days'
  GROUP BY upc_text
),
inventory_check AS (
  SELECT DISTINCT upc_text FROM current_inventory
)
SELECT 
  ai.*,
  ra.recent_vendor_count,
  ra.recent_domestic_count,
  ra.most_recent_date,
  CASE 
    WHEN ic.upc_text IS NOT NULL THEN 'IN_INVENTORY'
    WHEN ra.most_recent_date >= CURRENT_DATE - INTERVAL '21 days' THEN 'ACTIVE'
    WHEN ra.most_recent_date >= CURRENT_DATE - INTERVAL '42 days' THEN 'STALE'
    ELSE 'INACTIVE'
  END as global_status,
  ic.upc_text IS NULL as is_new_item,
  DATE_PART('day', CURRENT_DATE::timestamp - ai.last_seen_global::timestamp) as days_since_last_seen,
  -- Client qualification flags
  ai.domestic_vendor_count >= 3 as qualifies_for_client,
  ra.recent_domestic_count >= 3 as qualifies_recent,
  -- Price comparison
  CASE 
    WHEN ai.avg_price_domestic IS NOT NULL AND ai.avg_price_international IS NOT NULL
    THEN ROUND(((ai.avg_price_domestic - ai.avg_price_international) / ai.avg_price_international * 100)::numeric, 2)
    ELSE NULL
  END as domestic_vs_intl_price_diff_pct
FROM all_items ai
LEFT JOIN recent_activity ra ON ai.upc = ra.upc
LEFT JOIN inventory_check ic ON ai.upc = ic.upc_text;

-- 4. VENDOR COMPARISON VIEW - Track vendor missing items
-- Compares current submission to their previous submission
CREATE OR REPLACE VIEW vendor_missing_items_view AS
WITH vendor_current_submission AS (
  -- Get items from each vendor's most recent submission
  SELECT 
    vendor,
    MAX(date) as latest_date,
    COUNT(DISTINCT upc_text) as current_item_count,
    ARRAY_AGG(DISTINCT upc_text) as current_upcs
  FROM vendor_offers
  WHERE date = (SELECT MAX(date) FROM vendor_offers vo2 WHERE vo2.vendor = vendor_offers.vendor)
  GROUP BY vendor
),
vendor_previous_submission AS (
  -- Get items from each vendor's second most recent submission
  SELECT 
    vendor,
    MAX(date) as previous_date,
    COUNT(DISTINCT upc_text) as previous_item_count,
    ARRAY_AGG(DISTINCT upc_text) as previous_upcs
  FROM vendor_offers vo1
  WHERE date = (
    SELECT MAX(date) 
    FROM vendor_offers vo2 
    WHERE vo2.vendor = vo1.vendor 
      AND vo2.date < (SELECT MAX(date) FROM vendor_offers vo3 WHERE vo3.vendor = vo1.vendor)
  )
  GROUP BY vendor
)
SELECT 
  vc.vendor,
  vc.latest_date,
  vp.previous_date,
  vc.current_item_count,
  vp.previous_item_count,
  vc.current_item_count - COALESCE(vp.previous_item_count, 0) as item_count_change,
  -- Calculate missing items (were in previous but not in current)
  CASE 
    WHEN vp.previous_upcs IS NOT NULL 
    THEN ARRAY_LENGTH(
      ARRAY(
        SELECT unnest(vp.previous_upcs) 
        EXCEPT 
        SELECT unnest(vc.current_upcs)
      ), 1
    )
    ELSE 0
  END as missing_items_count,
  -- Calculate new items (in current but not in previous)
  CASE 
    WHEN vp.previous_upcs IS NOT NULL 
    THEN ARRAY_LENGTH(
      ARRAY(
        SELECT unnest(vc.current_upcs) 
        EXCEPT 
        SELECT unnest(vp.previous_upcs)
      ), 1
    )
    ELSE vc.current_item_count
  END as new_items_count
FROM vendor_current_submission vc
LEFT JOIN vendor_previous_submission vp ON vc.vendor = vp.vendor
ORDER BY vc.latest_date DESC, vc.vendor;

-- 5. SUMMARY DASHBOARD VIEW - High-level metrics
CREATE OR REPLACE VIEW watchlist_summary_dashboard AS
SELECT 
  -- Overall counts
  (SELECT COUNT(DISTINCT upc_text) FROM vendor_offers) as total_unique_upcs,
  (SELECT COUNT(DISTINCT upc_text) FROM current_inventory) as inventory_count,
  (SELECT COUNT(*) FROM global_item_status_view WHERE is_new_item = true) as new_items_total,
  
  -- Qualified items (3+ domestic vendors)
  (SELECT COUNT(*) FROM domestic_item_status_view WHERE is_new_item = true AND qualifies_for_client = true) as qualified_items_count,
  
  -- Recent activity (last 21 days)
  (SELECT COUNT(*) FROM global_item_status_view WHERE is_new_item = true AND global_status = 'ACTIVE') as active_new_items,
  
  -- Vendor stats
  (SELECT COUNT(DISTINCT vendor) FROM vendor_offers WHERE location = 'Domestic') as domestic_vendor_count,
  (SELECT COUNT(DISTINCT vendor) FROM vendor_offers WHERE location = 'International') as international_vendor_count,
  
  -- Recent submissions
  (SELECT COUNT(DISTINCT vendor) FROM vendor_offers WHERE date >= CURRENT_DATE - INTERVAL '7 days') as vendors_submitted_week,
  (SELECT COUNT(DISTINCT vendor) FROM vendor_offers WHERE date >= CURRENT_DATE - INTERVAL '21 days') as vendors_submitted_21days,
  
  -- Data freshness
  (SELECT MAX(date) FROM vendor_offers) as latest_data_date,
  (SELECT MIN(date) FROM vendor_offers WHERE date >= CURRENT_DATE - INTERVAL '21 days') as oldest_recent_date,
  
  -- Report timestamp
  CURRENT_TIMESTAMP as report_generated_at;

-- 6. CLIENT PRIORITY VIEW - Ready-to-send items for clients
-- Only shows new items with 3+ domestic vendors from last 21 days
CREATE OR REPLACE VIEW client_priority_items AS
SELECT 
  upc,
  item_name,
  brand,
  domestic_vendor_count,
  domestic_vendors,
  ROUND(min_price::numeric, 2) as min_price,
  ROUND(avg_price::numeric, 2) as avg_price,
  ROUND(max_price::numeric, 2) as max_price,
  total_qty_available,
  first_seen_domestic,
  last_seen_domestic,
  days_since_last_seen
FROM domestic_item_status_view
WHERE is_new_item = true
  AND qualifies_for_client = true
  AND domestic_status = 'ACTIVE'
  AND last_seen_domestic >= CURRENT_DATE - INTERVAL '21 days'
ORDER BY domestic_vendor_count DESC, min_price ASC;

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to get vendor submission history
CREATE OR REPLACE FUNCTION get_vendor_submission_history(vendor_name TEXT)
RETURNS TABLE(
  submission_date DATE,
  item_count INTEGER,
  avg_price DECIMAL,
  location TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    date as submission_date,
    COUNT(DISTINCT upc_text)::INTEGER as item_count,
    AVG(price) FILTER (WHERE price > 0) as avg_price,
    MAX(location) as location
  FROM vendor_offers
  WHERE vendor = vendor_name
  GROUP BY date
  ORDER BY date DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- Function to track item price history
CREATE OR REPLACE FUNCTION get_item_price_history(item_upc TEXT, days_back INTEGER DEFAULT 30)
RETURNS TABLE(
  date DATE,
  vendor TEXT,
  price DECIMAL,
  location TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    vo.date,
    vo.vendor,
    vo.price,
    vo.location
  FROM vendor_offers vo
  WHERE vo.upc_text = item_upc
    AND vo.date >= CURRENT_DATE - days_back * INTERVAL '1 day'
    AND vo.price > 0
  ORDER BY vo.date DESC, vo.vendor;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- USAGE EXAMPLES
-- =====================================================

-- Get all new items with 3+ domestic vendors (for client):
-- SELECT * FROM client_priority_items;

-- Check specific vendor's missing items:
-- SELECT * FROM vendor_missing_items_view WHERE vendor = 'YourVendorName';

-- Get overall summary:
-- SELECT * FROM watchlist_summary_dashboard;

-- Track specific item across all levels:
-- SELECT * FROM vendor_item_status_view WHERE upc = 'YourUPC';
-- SELECT * FROM domestic_item_status_view WHERE upc = 'YourUPC';
-- SELECT * FROM global_item_status_view WHERE upc = 'YourUPC';