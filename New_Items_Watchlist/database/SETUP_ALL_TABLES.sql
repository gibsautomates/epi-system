-- =====================================================
-- COMPLETE DATABASE SETUP FOR NEW ITEMS WATCHLIST
-- Run this entire script in Supabase SQL Editor
-- =====================================================

-- Step 1: Create vendor_offers table (main data table)
CREATE TABLE IF NOT EXISTS public.vendor_offers (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    vendor VARCHAR(255) NOT NULL,
    upc VARCHAR(50) NOT NULL,
    item_name TEXT,
    brand VARCHAR(255),
    sku VARCHAR(100),
    qty INTEGER,
    price NUMERIC(10,2),
    msrp NUMERIC(10,2),
    location VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_vendor_offers_vendor ON vendor_offers(vendor);
CREATE INDEX IF NOT EXISTS idx_vendor_offers_upc ON vendor_offers(upc);
CREATE INDEX IF NOT EXISTS idx_vendor_offers_date ON vendor_offers(date);
CREATE INDEX IF NOT EXISTS idx_vendor_offers_vendor_date ON vendor_offers(vendor, date);

-- Step 2: Create current_inventory table
CREATE TABLE IF NOT EXISTS public.current_inventory (
    id SERIAL PRIMARY KEY,
    upc VARCHAR(50),
    upc_text VARCHAR(50),
    item_name TEXT,
    brand VARCHAR(255),
    sku VARCHAR(100),
    quantity INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_current_inventory_upc ON current_inventory(upc);
CREATE INDEX IF NOT EXISTS idx_current_inventory_upc_text ON current_inventory(upc_text);

-- Step 3: Create vendors_expected table
CREATE TABLE IF NOT EXISTS public.vendors_expected (
    vendor VARCHAR(255) PRIMARY KEY,
    location VARCHAR(50) CHECK (location IN ('Domestic', 'International'))
);

-- Insert some sample vendors (update with your actual vendors)
INSERT INTO vendors_expected (vendor, location) VALUES
    ('Aairie', 'Domestic'),
    ('Acme', 'Domestic'),
    ('Awesome', 'Domestic'),
    ('BCG-Poland', 'International'),
    ('BS', 'Domestic'),
    ('CBS', 'Domestic'),
    ('Classic', 'Domestic'),
    ('Cosmo', 'Domestic'),
    ('Elegance', 'Domestic'),
    ('Enmi', 'International'),
    ('Euro', 'International'),
    ('ET', 'Domestic'),
    ('Fragrance Depot', 'Domestic'),
    ('French', 'International'),
    ('General', 'Domestic'),
    ('Gift Express', 'Domestic'),
    ('Haz', 'Domestic'),
    ('Heritage', 'Domestic'),
    ('Jizan', 'International'),
    ('Lux America', 'Domestic'),
    ('Luxury', 'Domestic'),
    ('Mod', 'Domestic'),
    ('Montroyal', 'International'),
    ('MTZ', 'Domestic'),
    ('Multiskills', 'Domestic'),
    ('Nandansons', 'International'),
    ('Network', 'Domestic'),
    ('NYB', 'Domestic'),
    ('Paris', 'International'),
    ('Perfume Center', 'Domestic')
ON CONFLICT (vendor) DO UPDATE SET location = EXCLUDED.location;

-- Step 4: Create vendor_latest_dates view
CREATE OR REPLACE VIEW vendor_latest_dates AS
SELECT 
    vendor,
    MAX(date) as latest_date
FROM vendor_offers
WHERE date >= CURRENT_DATE - INTERVAL '21 days'
GROUP BY vendor;

-- Step 5: Create vendor_offers_latest view
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

-- Step 6: Create vendor_offers_latest_new view (excludes items in inventory)
CREATE OR REPLACE VIEW vendor_offers_latest_new AS
SELECT 
    vol.*
FROM vendor_offers_latest vol
WHERE NOT EXISTS (
    SELECT 1 
    FROM current_inventory ci 
    WHERE ci.upc_text = vol.upc
);

-- Step 7: Create new_items_dashboard view
CREATE OR REPLACE VIEW new_items_dashboard AS
WITH item_aggregates AS (
    SELECT 
        upc,
        MAX(item_name) as item_name,
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

-- Step 8: Create watchlist_tracking table
CREATE TABLE IF NOT EXISTS public.watchlist_tracking (
    id SERIAL PRIMARY KEY,
    upc TEXT NOT NULL,
    status VARCHAR(20) NOT NULL,
    vendor_count INTEGER,
    lowest_price NUMERIC(10,2),
    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    item_name TEXT,
    domestic_vendor_count INTEGER,
    vendor_list TEXT,
    UNIQUE(upc, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_watchlist_tracking_upc ON watchlist_tracking(upc);
CREATE INDEX IF NOT EXISTS idx_watchlist_tracking_date ON watchlist_tracking(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_watchlist_tracking_status ON watchlist_tracking(status);

-- Step 9: Create new_items_dashboard_enhanced view
CREATE OR REPLACE VIEW new_items_dashboard_enhanced AS
SELECT 
    nd.*,
    nd.min_price as lowest_price,
    COALESCE(wt.status, 'NEW_CANDIDATE') as status,
    CASE 
        WHEN nd.min_price IS NULL OR nd.max_price IS NULL THEN 'stable'
        WHEN nd.max_price > nd.min_price * 1.1 THEN 'up'
        WHEN nd.max_price < nd.min_price * 0.9 THEN 'down'
        ELSE 'stable'
    END as price_trend,
    0 as price_change_pct,
    nd.avg_price as monthly_avg_price,
    CURRENT_DATE - nd.first_seen::date as days_on_watchlist,
    nd.total_qty as qty_available,
    wt.snapshot_date as last_tracked_date,
    NULL::numeric as previous_price,
    NULL::integer as previous_vendor_count,
    0 as vendors_new_count,
    nd.domestic_vendor_count as vendors_offering_count,
    0 as vendors_removed_count,
    0 as vendors_back_count,
    NULL::text as new_vendors,
    NULL::text as removed_vendors,
    'STABLE_VENDORS' as vendor_change_status
FROM new_items_dashboard nd
LEFT JOIN (
    SELECT DISTINCT ON (upc) upc, status, snapshot_date
    FROM watchlist_tracking
    ORDER BY upc, snapshot_date DESC
) wt ON CAST(nd.upc AS TEXT) = wt.upc
ORDER BY nd.domestic_vendor_count DESC, nd.min_price ASC;

-- Step 10: Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Step 11: Create function for updating watchlist tracking
CREATE OR REPLACE FUNCTION update_watchlist_tracking_with_streaks()
RETURNS void AS $$
DECLARE
    yesterday_date DATE := CURRENT_DATE - INTERVAL '1 day';
BEGIN
    -- Insert today's snapshot
    INSERT INTO watchlist_tracking (
        upc, status, vendor_count, lowest_price, item_name,
        domestic_vendor_count, vendor_list, snapshot_date
    )
    SELECT 
        CAST(nd.upc AS TEXT),
        CASE 
            WHEN yt.upc IS NULL THEN 'NEW_CANDIDATE'
            WHEN yt.status = 'REMOVED' THEN 'BACK_IN_FEED'
            WHEN nd.domestic_vendor_count < 3 AND yt.domestic_vendor_count >= 3 THEN 'REMOVED'
            ELSE 'WATCHING'
        END as status,
        nd.total_vendor_count,
        nd.min_price,
        nd.item_name,
        nd.domestic_vendor_count,
        nd.vendor_list,
        CURRENT_DATE
    FROM new_items_dashboard nd
    LEFT JOIN watchlist_tracking yt ON CAST(nd.upc AS TEXT) = yt.upc 
        AND yt.snapshot_date = yesterday_date
    WHERE nd.upc IS NOT NULL
    ON CONFLICT (upc, snapshot_date) 
    DO UPDATE SET 
        status = EXCLUDED.status,
        vendor_count = EXCLUDED.vendor_count,
        lowest_price = EXCLUDED.lowest_price,
        item_name = EXCLUDED.item_name,
        domestic_vendor_count = EXCLUDED.domestic_vendor_count,
        vendor_list = EXCLUDED.vendor_list;
        
    -- Mark items as REMOVED if they're not in today's feed
    INSERT INTO watchlist_tracking (
        upc, status, vendor_count, lowest_price, item_name, 
        domestic_vendor_count, vendor_list, snapshot_date
    )
    SELECT 
        yt.upc, 'REMOVED', 0, yt.lowest_price, yt.item_name,
        0, yt.vendor_list, CURRENT_DATE
    FROM watchlist_tracking yt
    WHERE yt.snapshot_date = yesterday_date
        AND yt.status IN ('WATCHING', 'NEW_CANDIDATE', 'BACK_IN_FEED')
        AND NOT EXISTS (
            SELECT 1 FROM new_items_dashboard nd 
            WHERE CAST(nd.upc AS TEXT) = yt.upc
        )
    ON CONFLICT (upc, snapshot_date) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Test the setup
SELECT 'Setup complete!' as status,
       (SELECT COUNT(*) FROM vendor_offers) as vendor_offers_count,
       (SELECT COUNT(*) FROM current_inventory) as inventory_count,
       (SELECT COUNT(*) FROM vendors_expected) as vendors_count;