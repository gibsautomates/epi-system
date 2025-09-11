-- Order Comparison Queries: Today vs Yesterday vs Last Week

-- 1. Today vs Yesterday vs Same Day Last Week Summary
WITH daily_summary AS (
    SELECT 
        export_date,
        COUNT(DISTINCT "OrderID") as total_orders,
        SUM("Qty") as total_units,
        SUM("GrandTotal") as total_revenue,
        AVG("GrandTotal") as avg_order_value,
        COUNT(DISTINCT "ProductID") as unique_products,
        COUNT(DISTINCT CONCAT("CompanyID", "OrderSource")) as active_channels
    FROM orders_daily 
    WHERE export_date IN (
        CURRENT_DATE,                           -- Today
        CURRENT_DATE - INTERVAL '1 day',       -- Yesterday  
        CURRENT_DATE - INTERVAL '7 days'       -- Same day last week
    )
    GROUP BY export_date
)
SELECT 
    CASE 
        WHEN export_date = CURRENT_DATE THEN 'Today'
        WHEN export_date = CURRENT_DATE - INTERVAL '1 day' THEN 'Yesterday'
        WHEN export_date = CURRENT_DATE - INTERVAL '7 days' THEN 'Last Week'
    END as period,
    export_date,
    total_orders,
    total_units,
    ROUND(total_revenue, 2) as total_revenue,
    ROUND(avg_order_value, 2) as avg_order_value,
    unique_products,
    active_channels
FROM daily_summary
ORDER BY export_date DESC;

-- 2. Channel Comparison: Today vs Yesterday vs Last Week
WITH channel_comparison AS (
    SELECT 
        export_date,
        CONCAT("CompanyID", "OrderSource") as channel_code,
        COALESCE(cl.channel_name, 'Unknown') as channel_name,
        COUNT(DISTINCT "OrderID") as orders,
        SUM("Qty") as units,
        ROUND(SUM("GrandTotal"), 2) as revenue
    FROM orders_daily od
    LEFT JOIN channel_lookup cl ON CONCAT(od."CompanyID", od."OrderSource") = cl.channel_code
    WHERE export_date IN (
        CURRENT_DATE,
        CURRENT_DATE - INTERVAL '1 day',
        CURRENT_DATE - INTERVAL '7 days'
    )
    GROUP BY export_date, channel_code, channel_name
)
SELECT 
    channel_code,
    channel_name,
    
    -- Today's data
    COALESCE(MAX(CASE WHEN export_date = CURRENT_DATE THEN orders END), 0) as today_orders,
    COALESCE(MAX(CASE WHEN export_date = CURRENT_DATE THEN units END), 0) as today_units,
    COALESCE(MAX(CASE WHEN export_date = CURRENT_DATE THEN revenue END), 0) as today_revenue,
    
    -- Yesterday's data
    COALESCE(MAX(CASE WHEN export_date = CURRENT_DATE - INTERVAL '1 day' THEN orders END), 0) as yesterday_orders,
    COALESCE(MAX(CASE WHEN export_date = CURRENT_DATE - INTERVAL '1 day' THEN units END), 0) as yesterday_units,
    COALESCE(MAX(CASE WHEN export_date = CURRENT_DATE - INTERVAL '1 day' THEN revenue END), 0) as yesterday_revenue,
    
    -- Last week same day data
    COALESCE(MAX(CASE WHEN export_date = CURRENT_DATE - INTERVAL '7 days' THEN orders END), 0) as lastweek_orders,
    COALESCE(MAX(CASE WHEN export_date = CURRENT_DATE - INTERVAL '7 days' THEN units END), 0) as lastweek_units,
    COALESCE(MAX(CASE WHEN export_date = CURRENT_DATE - INTERVAL '7 days' THEN revenue END), 0) as lastweek_revenue,
    
    -- Calculate percentage changes
    ROUND(
        CASE 
            WHEN MAX(CASE WHEN export_date = CURRENT_DATE - INTERVAL '1 day' THEN revenue END) > 0 
            THEN ((MAX(CASE WHEN export_date = CURRENT_DATE THEN revenue END) - MAX(CASE WHEN export_date = CURRENT_DATE - INTERVAL '1 day' THEN revenue END)) / MAX(CASE WHEN export_date = CURRENT_DATE - INTERVAL '1 day' THEN revenue END) * 100)
            ELSE 0 
        END, 1
    ) as revenue_change_vs_yesterday,
    
    ROUND(
        CASE 
            WHEN MAX(CASE WHEN export_date = CURRENT_DATE - INTERVAL '7 days' THEN revenue END) > 0 
            THEN ((MAX(CASE WHEN export_date = CURRENT_DATE THEN revenue END) - MAX(CASE WHEN export_date = CURRENT_DATE - INTERVAL '7 days' THEN revenue END)) / MAX(CASE WHEN export_date = CURRENT_DATE - INTERVAL '7 days' THEN revenue END) * 100)
            ELSE 0 
        END, 1
    ) as revenue_change_vs_lastweek
    
FROM channel_comparison
GROUP BY channel_code, channel_name
HAVING (today_orders + yesterday_orders + lastweek_orders) > 0
ORDER BY today_revenue DESC;

-- 3. Top Products Comparison
WITH product_comparison AS (
    SELECT 
        export_date,
        "ProductID",
        "DisplayName",
        SUM("Qty") as units_sold,
        ROUND(SUM("LineTotal"), 2) as revenue
    FROM orders_daily
    WHERE export_date IN (
        CURRENT_DATE,
        CURRENT_DATE - INTERVAL '1 day',
        CURRENT_DATE - INTERVAL '7 days'
    )
    GROUP BY export_date, "ProductID", "DisplayName"
)
SELECT 
    "ProductID",
    "DisplayName",
    
    -- Today's performance
    COALESCE(MAX(CASE WHEN export_date = CURRENT_DATE THEN units_sold END), 0) as today_units,
    COALESCE(MAX(CASE WHEN export_date = CURRENT_DATE THEN revenue END), 0) as today_revenue,
    
    -- Yesterday's performance  
    COALESCE(MAX(CASE WHEN export_date = CURRENT_DATE - INTERVAL '1 day' THEN units_sold END), 0) as yesterday_units,
    COALESCE(MAX(CASE WHEN export_date = CURRENT_DATE - INTERVAL '1 day' THEN revenue END), 0) as yesterday_revenue,
    
    -- Last week performance
    COALESCE(MAX(CASE WHEN export_date = CURRENT_DATE - INTERVAL '7 days' THEN units_sold END), 0) as lastweek_units,
    COALESCE(MAX(CASE WHEN export_date = CURRENT_DATE - INTERVAL '7 days' THEN revenue END), 0) as lastweek_revenue
    
FROM product_comparison
GROUP BY "ProductID", "DisplayName"
HAVING (today_units + yesterday_units + lastweek_units) > 0
ORDER BY today_revenue DESC
LIMIT 20;