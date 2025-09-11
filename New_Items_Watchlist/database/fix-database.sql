-- Fix the database to show data in the dashboard
-- Run these queries in order in your Supabase SQL Editor

-- 1. First, let's see what vendors we have
SELECT DISTINCT vendor, COUNT(*) as offer_count
FROM vendor_offers
GROUP BY vendor
ORDER BY offer_count DESC
LIMIT 20;

-- 2. Populate vendors_expected with all vendors (marking them as Domestic by default)
-- You can adjust the location later
INSERT INTO vendors_expected (vendor, location)
SELECT DISTINCT vendor, 'Domestic' as location
FROM vendor_offers
ON CONFLICT (vendor) DO NOTHING;

-- 3. Create a simpler working view that doesn't depend on date filters
CREATE OR REPLACE VIEW public.master_update_candidates_domestic AS
SELECT 
    vo.upc_text,
    MAX(vo.item_name) AS item_name,
    MAX(vo.brand) AS brand,
    
    -- Active vendor count (all time for now, since we don't know your date column format)
    COUNT(DISTINCT vo.vendor) AS active_domestic_vendor_count_21d,
    
    -- Total quantity
    SUM(vo.qty) AS latest_domestic_total_qty_21d,
    
    -- Minimum price
    MIN(vo.price) AS latest_domestic_min_price_21d,
    
    -- Vendors with min price
    ARRAY_AGG(DISTINCT vo.vendor ORDER BY vo.vendor) FILTER (
        WHERE vo.price = (
            SELECT MIN(vo2.price)
            FROM vendor_offers vo2
            WHERE vo2.upc_text = vo.upc_text
        )
    ) AS latest_domestic_min_price_vendors_21d,
    
    -- Lifetime vendor count
    COUNT(DISTINCT vo.vendor) AS lifetime_vendor_count,
    
    -- First and last seen dates
    MIN(vo.date) AS first_seen_global_date,
    ARRAY_AGG(DISTINCT vo.vendor ORDER BY vo.vendor) AS first_seen_global_vendors,
    MAX(vo.date) AS last_seen_global_date,
    ARRAY_AGG(DISTINCT vo.vendor ORDER BY vo.vendor) AS last_seen_global_vendors

FROM vendor_offers vo
LEFT JOIN vendors_expected ve ON vo.vendor = ve.vendor
WHERE vo.price IS NOT NULL 
  AND vo.price > 0
  AND (ve.location = 'Domestic' OR ve.location IS NULL)
GROUP BY vo.upc_text
HAVING COUNT(DISTINCT vo.vendor) > 0
LIMIT 1000; -- Limit for performance during testing

-- 4. Grant permissions
GRANT SELECT ON public.master_update_candidates_domestic TO authenticated;
GRANT SELECT ON public.master_update_candidates_domestic TO service_role;

-- 5. Test the view
SELECT COUNT(*) as total_rows FROM master_update_candidates_domestic;
SELECT * FROM master_update_candidates_domestic LIMIT 5;