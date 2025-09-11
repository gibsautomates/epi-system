-- Corrected SQL to fix your database
-- Run these in your Supabase SQL Editor

-- 1. First, add the location column to vendors_expected table
ALTER TABLE vendors_expected 
ADD COLUMN IF NOT EXISTS location TEXT DEFAULT 'Domestic' 
CHECK (location IN ('Domestic', 'International'));

-- 2. Now populate vendors_expected with all vendors
INSERT INTO vendors_expected (vendor, active, location)
SELECT DISTINCT 
    vendor, 
    true as active,
    'Domestic' as location
FROM vendor_offers
ON CONFLICT (vendor) DO UPDATE 
SET location = COALESCE(vendors_expected.location, 'Domestic');

-- 3. Create a working view that uses the vendor_offers table structure
CREATE OR REPLACE VIEW public.master_update_candidates_domestic AS
SELECT 
    vo.upc_text,
    MAX(vo.item_name) AS item_name,
    MAX(vo.brand) AS brand,
    
    -- Count vendors from last 21 days using the date column
    COUNT(DISTINCT CASE 
        WHEN vo.date >= CURRENT_DATE - INTERVAL '21 days' 
        THEN vo.vendor 
    END) AS active_domestic_vendor_count_21d,
    
    -- Total quantity from last 21 days
    SUM(CASE 
        WHEN vo.date >= CURRENT_DATE - INTERVAL '21 days' 
        THEN vo.qty 
    END) AS latest_domestic_total_qty_21d,
    
    -- Minimum price from last 21 days
    MIN(CASE 
        WHEN vo.date >= CURRENT_DATE - INTERVAL '21 days' 
        THEN vo.price 
    END) AS latest_domestic_min_price_21d,
    
    -- Vendors with min price
    ARRAY_AGG(DISTINCT vo.vendor ORDER BY vo.vendor) FILTER (
        WHERE vo.date >= CURRENT_DATE - INTERVAL '21 days'
        AND vo.price = (
            SELECT MIN(vo2.price)
            FROM vendor_offers vo2
            WHERE vo2.upc_text = vo.upc_text
            AND vo2.date >= CURRENT_DATE - INTERVAL '21 days'
        )
    ) AS latest_domestic_min_price_vendors_21d,
    
    -- Lifetime vendor count
    COUNT(DISTINCT vo.vendor) AS lifetime_vendor_count,
    
    -- First and last seen dates
    MIN(vo.date) AS first_seen_global_date,
    ARRAY['Various'] AS first_seen_global_vendors, -- Simplified for performance
    MAX(vo.date) AS last_seen_global_date,
    ARRAY['Various'] AS last_seen_global_vendors -- Simplified for performance

FROM vendor_offers vo
LEFT JOIN vendors_expected ve ON vo.vendor = ve.vendor
WHERE vo.price IS NOT NULL 
  AND vo.price > 0
  AND vo.upc_text IS NOT NULL
  AND vo.upc_text != ''
  AND (ve.location = 'Domestic' OR ve.location IS NULL OR ve.vendor IS NULL)
GROUP BY vo.upc_text
HAVING COUNT(DISTINCT CASE 
    WHEN vo.date >= CURRENT_DATE - INTERVAL '21 days' 
    THEN vo.vendor 
END) > 0;

-- 4. Grant permissions
GRANT SELECT ON public.master_update_candidates_domestic TO authenticated;
GRANT SELECT ON public.master_update_candidates_domestic TO service_role;

-- 5. Test the view
SELECT COUNT(*) as total_rows FROM master_update_candidates_domestic;

-- 6. Show sample data
SELECT 
    upc_text,
    item_name,
    brand,
    active_domestic_vendor_count_21d,
    latest_domestic_min_price_21d
FROM master_update_candidates_domestic 
LIMIT 10;