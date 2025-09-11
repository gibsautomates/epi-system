-- Create the master_update_candidates_domestic view
-- This view aggregates vendor offer data for domestic vendors
-- Run this in your Supabase SQL editor

CREATE OR REPLACE VIEW public.master_update_candidates_domestic AS
SELECT 
    public.normalize_upc(vo.upc) AS upc_text,
    MAX(vo.item_name) AS item_name,
    MAX(vo.brand) AS brand,
    
    -- 21-day domestic vendor metrics
    COUNT(DISTINCT CASE 
        WHEN vo.offer_date >= CURRENT_DATE - INTERVAL '21 days' 
        AND ve.location = 'Domestic' 
        THEN vo.vendor 
    END) AS active_domestic_vendor_count_21d,
    
    SUM(CASE 
        WHEN vo.offer_date >= CURRENT_DATE - INTERVAL '21 days' 
        AND ve.location = 'Domestic' 
        THEN vo.quantity 
    END) AS latest_domestic_total_qty_21d,
    
    MIN(CASE 
        WHEN vo.offer_date >= CURRENT_DATE - INTERVAL '21 days' 
        AND ve.location = 'Domestic' 
        THEN vo.price 
    END) AS latest_domestic_min_price_21d,
    
    ARRAY_AGG(DISTINCT vo.vendor ORDER BY vo.vendor) FILTER (
        WHERE vo.offer_date >= CURRENT_DATE - INTERVAL '21 days' 
        AND ve.location = 'Domestic'
        AND vo.price = (
            SELECT MIN(vo2.price)
            FROM vendor_offers vo2
            JOIN vendors_expected ve2 ON vo2.vendor = ve2.vendor
            WHERE public.normalize_upc(vo2.upc) = public.normalize_upc(vo.upc)
            AND vo2.offer_date >= CURRENT_DATE - INTERVAL '21 days'
            AND ve2.location = 'Domestic'
        )
    ) AS latest_domestic_min_price_vendors_21d,
    
    -- Lifetime metrics
    COUNT(DISTINCT vo.vendor) AS lifetime_vendor_count,
    
    MIN(vo.offer_date) AS first_seen_global_date,
    ARRAY_AGG(DISTINCT vo.vendor ORDER BY vo.vendor) FILTER (
        WHERE vo.offer_date = (
            SELECT MIN(vo2.offer_date)
            FROM vendor_offers vo2
            WHERE public.normalize_upc(vo2.upc) = public.normalize_upc(vo.upc)
        )
    ) AS first_seen_global_vendors,
    
    MAX(vo.offer_date) AS last_seen_global_date,
    ARRAY_AGG(DISTINCT vo.vendor ORDER BY vo.vendor) FILTER (
        WHERE vo.offer_date = (
            SELECT MAX(vo2.offer_date)
            FROM vendor_offers vo2
            WHERE public.normalize_upc(vo2.upc) = public.normalize_upc(vo.upc)
        )
    ) AS last_seen_global_vendors

FROM vendor_offers vo
LEFT JOIN vendors_expected ve ON vo.vendor = ve.vendor
GROUP BY public.normalize_upc(vo.upc)
HAVING COUNT(DISTINCT CASE 
    WHEN vo.offer_date >= CURRENT_DATE - INTERVAL '21 days' 
    AND ve.location = 'Domestic' 
    THEN vo.vendor 
END) > 0;

-- Grant permissions
GRANT SELECT ON public.master_update_candidates_domestic TO authenticated;
GRANT SELECT ON public.master_update_candidates_domestic TO service_role;