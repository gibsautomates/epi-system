-- ==============================================================
-- 21-DAY VENDOR OFFERS ANALYSIS SQL FUNCTIONS
-- ==============================================================
-- Based on vendor_offers table structure analysis
-- 
-- Table Schema:
-- - id: SERIAL PRIMARY KEY
-- - upc: VARCHAR (item identification) 
-- - upc_text: VARCHAR (normalized UPC)
-- - item_name: TEXT (product name)
-- - brand: VARCHAR (brand name, can be null)
-- - price: DECIMAL(10,2) (vendor price)
-- - qty: INTEGER (available quantity, can be null)
-- - msrp: DECIMAL(10,2) (manufacturer suggested retail price, can be null)
-- - vendor: VARCHAR (vendor name)
-- - date: DATE (offer date - THIS IS THE KEY DATE FIELD)
-- - week: DATE (week grouping date)
-- - location: VARCHAR ('Domestic' or 'International')
-- - sku: VARCHAR (vendor SKU, can be null)
-- ==============================================================

-- Function 1: Get items with 3+ domestic vendors in last 21 days
CREATE OR REPLACE FUNCTION get_items_with_3plus_domestic_vendors_21d()
RETURNS TABLE (
    upc_code VARCHAR,
    item_name TEXT,
    brand VARCHAR,
    domestic_vendor_count BIGINT,
    total_vendor_count BIGINT,
    min_domestic_price DECIMAL(10,2),
    avg_domestic_price DECIMAL(10,2),
    max_domestic_price DECIMAL(10,2),
    total_domestic_qty BIGINT,
    latest_offer_date DATE,
    domestic_vendors TEXT[],
    lowest_price_vendors TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    WITH recent_offers AS (
        SELECT 
            vo.upc,
            vo.upc_text,
            vo.item_name,
            vo.brand,
            vo.vendor,
            vo.price,
            vo.qty,
            vo.date,
            vo.location
        FROM vendor_offers vo
        WHERE vo.date >= CURRENT_DATE - INTERVAL '21 days'
          AND vo.price IS NOT NULL
    ),
    upc_stats AS (
        SELECT 
            ro.upc,
            ro.item_name,
            ro.brand,
            COUNT(DISTINCT CASE WHEN ro.location = 'Domestic' THEN ro.vendor END) as domestic_vendors,
            COUNT(DISTINCT ro.vendor) as total_vendors,
            MIN(CASE WHEN ro.location = 'Domestic' THEN ro.price END) as min_price_domestic,
            AVG(CASE WHEN ro.location = 'Domestic' THEN ro.price END) as avg_price_domestic,
            MAX(CASE WHEN ro.location = 'Domestic' THEN ro.price END) as max_price_domestic,
            SUM(CASE WHEN ro.location = 'Domestic' THEN COALESCE(ro.qty, 0) END) as total_qty_domestic,
            MAX(ro.date) as latest_date,
            ARRAY_AGG(DISTINCT CASE WHEN ro.location = 'Domestic' THEN ro.vendor END) as domestic_vendor_list
        FROM recent_offers ro
        GROUP BY ro.upc, ro.item_name, ro.brand
        HAVING COUNT(DISTINCT CASE WHEN ro.location = 'Domestic' THEN ro.vendor END) >= 3
    ),
    lowest_price_vendors AS (
        SELECT 
            us.upc,
            us.min_price_domestic,
            ARRAY_AGG(DISTINCT ro.vendor) as lowest_vendors
        FROM upc_stats us
        JOIN recent_offers ro ON ro.upc = us.upc 
            AND ro.price = us.min_price_domestic 
            AND ro.location = 'Domestic'
        GROUP BY us.upc, us.min_price_domestic
    )
    SELECT 
        us.upc,
        us.item_name,
        us.brand,
        us.domestic_vendors,
        us.total_vendors,
        us.min_price_domestic,
        us.avg_price_domestic,
        us.max_price_domestic,
        us.total_qty_domestic,
        us.latest_date,
        us.domestic_vendor_list,
        lpv.lowest_vendors
    FROM upc_stats us
    LEFT JOIN lowest_price_vendors lpv ON lpv.upc = us.upc
    ORDER BY us.domestic_vendors DESC, us.min_price_domestic ASC;
END;
$$ LANGUAGE plpgsql;

-- Function 2: Get vendor performance in last 21 days
CREATE OR REPLACE FUNCTION get_vendor_performance_21d()
RETURNS TABLE (
    vendor_name VARCHAR,
    location VARCHAR,
    total_offers BIGINT,
    unique_items BIGINT,
    avg_price DECIMAL(10,2),
    min_price DECIMAL(10,2),
    max_price DECIMAL(10,2),
    total_quantity BIGINT,
    date_range_start DATE,
    date_range_end DATE,
    most_recent_offer DATE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        vo.vendor,
        vo.location,
        COUNT(*) as offer_count,
        COUNT(DISTINCT vo.upc) as unique_item_count,
        AVG(vo.price) as average_price,
        MIN(vo.price) as minimum_price,
        MAX(vo.price) as maximum_price,
        SUM(COALESCE(vo.qty, 0)) as total_qty,
        MIN(vo.date) as earliest_date,
        MAX(vo.date) as latest_date,
        MAX(vo.date) as most_recent
    FROM vendor_offers vo
    WHERE vo.date >= CURRENT_DATE - INTERVAL '21 days'
      AND vo.price IS NOT NULL
    GROUP BY vo.vendor, vo.location
    ORDER BY offer_count DESC, unique_item_count DESC;
END;
$$ LANGUAGE plpgsql;

-- Function 3: Get price trends for specific UPC over last 21 days
CREATE OR REPLACE FUNCTION get_upc_price_trend_21d(input_upc VARCHAR)
RETURNS TABLE (
    upc_code VARCHAR,
    item_name TEXT,
    vendor_name VARCHAR,
    location VARCHAR,
    price DECIMAL(10,2),
    quantity INTEGER,
    offer_date DATE,
    days_ago INTEGER,
    price_rank_by_vendor INTEGER,
    is_lowest_price BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    WITH upc_offers AS (
        SELECT 
            vo.upc,
            vo.item_name,
            vo.vendor,
            vo.location,
            vo.price,
            vo.qty,
            vo.date,
            CURRENT_DATE - vo.date as days_back
        FROM vendor_offers vo
        WHERE vo.upc = input_upc
          AND vo.date >= CURRENT_DATE - INTERVAL '21 days'
          AND vo.price IS NOT NULL
    ),
    price_rankings AS (
        SELECT 
            uo.*,
            ROW_NUMBER() OVER (PARTITION BY uo.vendor ORDER BY uo.price ASC) as vendor_price_rank,
            MIN(uo.price) OVER () as global_min_price
        FROM upc_offers uo
    )
    SELECT 
        pr.upc,
        pr.item_name,
        pr.vendor,
        pr.location,
        pr.price,
        pr.qty,
        pr.date,
        pr.days_back,
        pr.vendor_price_rank::INTEGER,
        (pr.price = pr.global_min_price) as is_lowest
    FROM price_rankings pr
    ORDER BY pr.date DESC, pr.price ASC;
END;
$$ LANGUAGE plpgsql;

-- Function 4: Get new items (first seen in last 21 days)
CREATE OR REPLACE FUNCTION get_new_items_21d()
RETURNS TABLE (
    upc_code VARCHAR,
    item_name TEXT,
    brand VARCHAR,
    first_seen_date DATE,
    days_since_first_seen INTEGER,
    vendor_count BIGINT,
    domestic_vendor_count BIGINT,
    lowest_price DECIMAL(10,2),
    highest_price DECIMAL(10,2),
    first_vendor VARCHAR,
    all_vendors TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    WITH item_first_appearance AS (
        SELECT 
            vo.upc,
            vo.item_name,
            vo.brand,
            MIN(vo.date) as first_seen,
            CURRENT_DATE - MIN(vo.date) as days_since_first,
            MIN(vo.vendor) as first_vendor_name
        FROM vendor_offers vo
        GROUP BY vo.upc, vo.item_name, vo.brand
        HAVING MIN(vo.date) >= CURRENT_DATE - INTERVAL '21 days'
    ),
    recent_stats AS (
        SELECT 
            vo.upc,
            COUNT(DISTINCT vo.vendor) as total_vendors,
            COUNT(DISTINCT CASE WHEN vo.location = 'Domestic' THEN vo.vendor END) as domestic_vendors,
            MIN(vo.price) as min_price,
            MAX(vo.price) as max_price,
            ARRAY_AGG(DISTINCT vo.vendor) as vendor_array
        FROM vendor_offers vo
        WHERE vo.date >= CURRENT_DATE - INTERVAL '21 days'
          AND vo.price IS NOT NULL
        GROUP BY vo.upc
    )
    SELECT 
        ifa.upc,
        ifa.item_name,
        ifa.brand,
        ifa.first_seen,
        ifa.days_since_first,
        rs.total_vendors,
        rs.domestic_vendors,
        rs.min_price,
        rs.max_price,
        ifa.first_vendor_name,
        rs.vendor_array
    FROM item_first_appearance ifa
    JOIN recent_stats rs ON rs.upc = ifa.upc
    ORDER BY ifa.first_seen DESC, rs.domestic_vendors DESC;
END;
$$ LANGUAGE plpgsql;

-- Function 5: Get competitive analysis (items with price variations > 20%)
CREATE OR REPLACE FUNCTION get_competitive_items_21d(min_price_variance_pct DECIMAL DEFAULT 20.0)
RETURNS TABLE (
    upc_code VARCHAR,
    item_name TEXT,
    brand VARCHAR,
    vendor_count BIGINT,
    min_price DECIMAL(10,2),
    max_price DECIMAL(10,2),
    avg_price DECIMAL(10,2),
    price_variance_pct DECIMAL(10,2),
    lowest_vendor VARCHAR,
    highest_vendor VARCHAR,
    potential_savings DECIMAL(10,2)
) AS $$
BEGIN
    RETURN QUERY
    WITH price_analysis AS (
        SELECT 
            vo.upc,
            vo.item_name,
            vo.brand,
            COUNT(DISTINCT vo.vendor) as vendors,
            MIN(vo.price) as min_cost,
            MAX(vo.price) as max_cost,
            AVG(vo.price) as avg_cost,
            CASE 
                WHEN MIN(vo.price) > 0 THEN 
                    ((MAX(vo.price) - MIN(vo.price)) / MIN(vo.price)) * 100
                ELSE 0 
            END as variance_percentage
        FROM vendor_offers vo
        WHERE vo.date >= CURRENT_DATE - INTERVAL '21 days'
          AND vo.price IS NOT NULL
          AND vo.location = 'Domestic'
        GROUP BY vo.upc, vo.item_name, vo.brand
        HAVING COUNT(DISTINCT vo.vendor) >= 2
    ),
    vendor_extremes AS (
        SELECT 
            pa.upc,
            pa.min_cost,
            pa.max_cost,
            MIN(CASE WHEN vo.price = pa.min_cost THEN vo.vendor END) as cheapest_vendor,
            MIN(CASE WHEN vo.price = pa.max_cost THEN vo.vendor END) as most_expensive_vendor
        FROM price_analysis pa
        JOIN vendor_offers vo ON vo.upc = pa.upc 
            AND vo.date >= CURRENT_DATE - INTERVAL '21 days'
            AND vo.location = 'Domestic'
            AND (vo.price = pa.min_cost OR vo.price = pa.max_cost)
        GROUP BY pa.upc, pa.min_cost, pa.max_cost
    )
    SELECT 
        pa.upc,
        pa.item_name,
        pa.brand,
        pa.vendors,
        pa.min_cost,
        pa.max_cost,
        pa.avg_cost,
        pa.variance_percentage,
        ve.cheapest_vendor,
        ve.most_expensive_vendor,
        (pa.max_cost - pa.min_cost) as savings
    FROM price_analysis pa
    JOIN vendor_extremes ve ON ve.upc = pa.upc
    WHERE pa.variance_percentage >= min_price_variance_pct
    ORDER BY pa.variance_percentage DESC, pa.vendors DESC;
END;
$$ LANGUAGE plpgsql;

-- Sample Usage Examples:
/*

-- Get all items with 3+ domestic vendors in last 21 days
SELECT * FROM get_items_with_3plus_domestic_vendors_21d();

-- Get vendor performance summary
SELECT * FROM get_vendor_performance_21d();

-- Get price trend for specific UPC
SELECT * FROM get_upc_price_trend_21d('855560005787');

-- Get new items discovered in last 21 days
SELECT * FROM get_new_items_21d();

-- Get competitive items (>20% price variance)
SELECT * FROM get_competitive_items_21d(20.0);

-- Get highly competitive items (>50% price variance)  
SELECT * FROM get_competitive_items_21d(50.0);

*/

-- ==============================================================
-- GRANT PERMISSIONS
-- ==============================================================
GRANT EXECUTE ON FUNCTION get_items_with_3plus_domestic_vendors_21d() TO authenticated;
GRANT EXECUTE ON FUNCTION get_vendor_performance_21d() TO authenticated;  
GRANT EXECUTE ON FUNCTION get_upc_price_trend_21d(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION get_new_items_21d() TO authenticated;
GRANT EXECUTE ON FUNCTION get_competitive_items_21d(DECIMAL) TO authenticated;

GRANT EXECUTE ON FUNCTION get_items_with_3plus_domestic_vendors_21d() TO service_role;
GRANT EXECUTE ON FUNCTION get_vendor_performance_21d() TO service_role;
GRANT EXECUTE ON FUNCTION get_upc_price_trend_21d(VARCHAR) TO service_role;
GRANT EXECUTE ON FUNCTION get_new_items_21d() TO service_role;
GRANT EXECUTE ON FUNCTION get_competitive_items_21d(DECIMAL) TO service_role;