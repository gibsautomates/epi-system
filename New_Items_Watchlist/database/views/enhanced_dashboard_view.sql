-- Enhanced dashboard view with additional calculated fields
-- This builds on the existing views to add missing data

-- Drop existing enhanced view if it exists
DROP VIEW IF EXISTS new_items_dashboard_enhanced CASCADE;

-- Create enhanced view with all needed fields
CREATE OR REPLACE VIEW new_items_dashboard_enhanced AS
WITH item_details AS (
    -- Get all items with vendor details
    SELECT 
        vol.*,
        -- Add row number to find lowest price vendor
        ROW_NUMBER() OVER (PARTITION BY vol.upc ORDER BY vol.price ASC NULLS LAST) as price_rank
    FROM vendor_offers_latest_new vol
),
item_aggregates AS (
    SELECT 
        upc,
        MAX(item_name) as item_name,
        MAX(brand) as brand,
        MAX(sku) as sku,
        MIN(CASE WHEN price > 0 THEN price END) as min_price,
        MAX(CASE WHEN price > 0 THEN price END) as max_price,
        AVG(CASE WHEN price > 0 THEN price END) as avg_price,
        MIN(CASE WHEN price > 0 THEN price END) as current_price, -- Use min_price as current
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
historical_data AS (
    -- Check if items appeared before (more than 30 days ago)
    SELECT DISTINCT upc
    FROM vendor_offers
    WHERE date < CURRENT_DATE - INTERVAL '30 days'
),
price_history AS (
    -- Get price trends over last 30 days
    SELECT 
        upc,
        date,
        AVG(CASE WHEN price > 0 THEN price END) as daily_avg_price,
        -- Calculate weekly averages for trend
        DATE_TRUNC('week', date) as week_start
    FROM vendor_offers
    WHERE date >= CURRENT_DATE - INTERVAL '30 days'
        AND price > 0
    GROUP BY upc, date
),
price_trends AS (
    -- Calculate price trend (comparing recent week to previous weeks)
    SELECT 
        upc,
        -- Recent week average
        AVG(CASE 
            WHEN date >= CURRENT_DATE - INTERVAL '7 days' 
            THEN daily_avg_price 
        END) as recent_avg,
        -- Previous 3 weeks average
        AVG(CASE 
            WHEN date < CURRENT_DATE - INTERVAL '7 days' 
            AND date >= CURRENT_DATE - INTERVAL '28 days'
            THEN daily_avg_price 
        END) as previous_avg,
        -- Monthly average
        AVG(daily_avg_price) as monthly_avg
    FROM price_history
    GROUP BY upc
)
SELECT 
    ia.*,
    -- Status: new if first seen within 7 days and never seen before, returned if seen before
    CASE 
        WHEN hd.upc IS NOT NULL THEN 'returned'
        WHEN ia.first_seen >= CURRENT_DATE - INTERVAL '7 days' THEN 'new'
        ELSE 'active'
    END as status,
    -- Price trend
    CASE 
        WHEN pt.recent_avg IS NULL OR pt.previous_avg IS NULL THEN 'stable'
        WHEN pt.recent_avg > pt.previous_avg * 1.05 THEN 'up'
        WHEN pt.recent_avg < pt.previous_avg * 0.95 THEN 'down'
        ELSE 'stable'
    END as price_trend,
    -- Price change percentage
    CASE 
        WHEN pt.previous_avg > 0 
        THEN ROUND(((pt.recent_avg - pt.previous_avg) / pt.previous_avg * 100)::numeric, 2)
        ELSE 0
    END as price_change_pct,
    -- Monthly average price for reference
    COALESCE(ROUND(pt.monthly_avg::numeric, 2), ia.avg_price) as monthly_avg_price,
    -- Vendor category
    CASE 
        WHEN ia.domestic_vendor_count >= 3 THEN '3+ Vendors'
        WHEN ia.domestic_vendor_count = 2 THEN '2 Vendors'
        WHEN ia.domestic_vendor_count = 1 THEN '1 Vendor'
        ELSE 'No Domestic'
    END as vendor_category,
    -- Additional useful fields
    CURRENT_DATE - ia.first_seen::date as days_on_watchlist,
    ia.total_qty as qty_available
FROM item_aggregates ia
LEFT JOIN historical_data hd ON ia.upc = hd.upc
LEFT JOIN price_trends pt ON ia.upc = pt.upc
ORDER BY ia.domestic_vendor_count DESC, ia.min_price ASC;

-- Grant permissions
GRANT SELECT ON new_items_dashboard_enhanced TO authenticated;
GRANT SELECT ON new_items_dashboard_enhanced TO anon;