-- This SQL creates an efficient view for the dashboard
-- Run this in your Supabase SQL Editor

-- Create a materialized view that refreshes daily
CREATE MATERIALIZED VIEW IF NOT EXISTS dashboard_summary AS
WITH recent_offers AS (
  -- Get offers from last 21 days
  SELECT 
    vo.*,
    COALESCE(ci.upc_text IS NOT NULL, false) as in_inventory
  FROM vendor_offers vo
  LEFT JOIN current_inventory ci ON vo.upc::text = ci.upc_text
  WHERE vo.date >= CURRENT_DATE - INTERVAL '21 days'
),
item_summary AS (
  SELECT 
    upc,
    upc_text,
    MAX(item_name) as item_name,
    MAX(brand) as brand,
    MAX(sku) as sku,
    bool_and(NOT in_inventory) as is_new,
    COUNT(DISTINCT CASE WHEN location = 'Domestic' THEN vendor END) as domestic_vendor_count,
    COUNT(DISTINCT vendor) as total_vendor_count,
    array_agg(DISTINCT vendor) as vendor_list,
    MIN(CASE WHEN price > 0 THEN price END) as min_price,
    MAX(price) as max_price,
    AVG(CASE WHEN price > 0 THEN price END) as avg_price,
    MIN(date) as first_seen,
    MAX(date) as last_seen,
    SUM(COALESCE(qty, 0)) as total_qty
  FROM recent_offers
  GROUP BY upc, upc_text
)
SELECT 
  *,
  CASE 
    WHEN domestic_vendor_count >= 3 THEN true 
    ELSE false 
  END as has_3plus_vendors
FROM item_summary
WHERE is_new = true;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_dashboard_summary_upc ON dashboard_summary(upc_text);
CREATE INDEX IF NOT EXISTS idx_dashboard_summary_vendors ON dashboard_summary(domestic_vendor_count);

-- Create a function to refresh the view (call this daily or on-demand)
CREATE OR REPLACE FUNCTION refresh_dashboard_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW dashboard_summary;
END;
$$ LANGUAGE plpgsql;

-- Optional: Set up a cron job to refresh daily at 2 AM
-- SELECT cron.schedule('refresh-dashboard-summary', '0 2 * * *', 'SELECT refresh_dashboard_summary();');