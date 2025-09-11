-- Debug SQL to check why new_items_dashboard is empty

-- 1. Check how many records in vendor_offers_latest
SELECT COUNT(*) as vendor_offers_latest_count FROM vendor_offers_latest;

-- 2. Check current_inventory columns and sample data
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'current_inventory';

-- 3a. Check sample UPCs from vendor_offers_latest
SELECT DISTINCT upc FROM vendor_offers_latest LIMIT 5;

-- 3b. Check sample UPCs from current_inventory (upc_text column)
SELECT DISTINCT upc_text FROM current_inventory WHERE upc_text IS NOT NULL LIMIT 5;

-- 3c. Check sample UPCs from current_inventory (UPC column)
SELECT DISTINCT "UPC" FROM current_inventory WHERE "UPC" IS NOT NULL LIMIT 5;

-- 4a. First, let's count total vendor offers
SELECT COUNT(*) as total_vendor_offers FROM vendor_offers_latest;

-- 4b. Count how many match on upc_text
SELECT COUNT(*) as matches_on_upc_text
FROM vendor_offers_latest vol
WHERE EXISTS (
    SELECT 1 
    FROM current_inventory ci 
    WHERE ci.upc_text = CAST(vol.upc AS TEXT)
);

-- 4c. Count how many match on UPC column
SELECT COUNT(*) as matches_on_UPC
FROM vendor_offers_latest vol
WHERE EXISTS (
    SELECT 1 
    FROM current_inventory ci 
    WHERE CAST(ci."UPC" AS TEXT) = CAST(vol.upc AS TEXT)
);

-- 4d. Quick count of vendor_offers_latest_new (should be ~29,545)
SELECT COUNT(*) as new_items_count FROM vendor_offers_latest_new LIMIT 1;

-- 4e. Test if new_items_dashboard has data (just count, no aggregation)
SELECT COUNT(*) as dashboard_count FROM new_items_dashboard LIMIT 1;

-- 4f. If dashboard is empty, test simpler aggregation
SELECT COUNT(DISTINCT upc) as unique_new_items FROM vendor_offers_latest_new LIMIT 1;

-- 5. Find examples of items in vendor_offers but not in inventory
SELECT vol.upc, vol.item_name, vol.vendor
FROM vendor_offers_latest vol
WHERE NOT EXISTS (
    SELECT 1 
    FROM current_inventory ci 
    WHERE TRIM(ci.upc_text) = TRIM(vol.upc)
)
LIMIT 10;

-- 6. Check if there's a mismatch in UPC format (leading zeros, etc)
SELECT 
    vol.upc as vendor_upc,
    ci.upc_text as inventory_upc,
    LENGTH(vol.upc) as vendor_len,
    LENGTH(ci.upc_text) as inv_len
FROM vendor_offers_latest vol
LEFT JOIN current_inventory ci ON ci.upc_text = vol.upc
WHERE ci.upc_text IS NULL
LIMIT 10;