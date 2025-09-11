# 21-Day Vendor Logic SQL Functions - Manual Deployment Guide

## Overview
This guide walks you through deploying the 21-day vendor logic SQL functions to your Supabase database manually, since automated deployment requires direct database access.

## Step 1: Access Supabase SQL Editor

1. **Navigate to Supabase Dashboard:**
   - Go to: https://supabase.com/dashboard
   - Select your project: `oozneazuydjsjvlswpqu`
   - Or use direct link: https://supabase.com/dashboard/project/oozneazuydjsjvlswpqu/sql

2. **Open SQL Editor:**
   - Click on "SQL Editor" in the left sidebar
   - Create a new query

## Step 2: Execute the SQL Script

1. **Copy the SQL Script:**
   - Open the file: `C:\Gibs\EPI\Order_Summary\21_day_vendor_logic.sql`
   - Select all content (Ctrl+A) and copy (Ctrl+C)

2. **Paste and Execute:**
   - Paste the entire SQL script into the Supabase SQL Editor
   - Click the "Run" button (or press Ctrl+Enter)
   - Wait for execution to complete

## Step 3: Verify Deployment

Execute each of these test queries in the SQL Editor:

### Test 1: Main Function
```sql
SELECT * FROM get_items_with_3plus_domestic_vendors_21d() LIMIT 5;
```
**Expected Result:** Items with 3+ domestic vendors, showing vendor counts and pricing data.

### Test 2: Vendor Performance
```sql
SELECT * FROM get_vendor_performance_21d() LIMIT 5;
```
**Expected Result:** Vendor performance metrics for last 21 days.

### Test 3: New Items
```sql
SELECT * FROM get_new_items_21d() LIMIT 5;
```
**Expected Result:** Items first seen in last 21 days.

### Test 4: Price Trends (with sample UPC)
```sql
SELECT * FROM get_upc_price_trend_21d('855560005787') LIMIT 5;
```
**Expected Result:** Price trends for the specified UPC.

### Test 5: Competitive Items
```sql
SELECT * FROM get_competitive_items_21d(20.0) LIMIT 5;
```
**Expected Result:** Items with >20% price variance between vendors.

## Step 4: Function Permissions

The script includes GRANT statements for both `authenticated` and `service_role` users. These should execute automatically with the main script.

## Expected Function Structure

### get_items_with_3plus_domestic_vendors_21d()

**Returns:**
- `upc_code` (VARCHAR): Item UPC
- `item_name` (TEXT): Product name
- `brand` (VARCHAR): Brand name
- `domestic_vendor_count` (BIGINT): Number of domestic vendors
- `total_vendor_count` (BIGINT): Total vendor count (domestic + international)
- `min_domestic_price` (DECIMAL): Lowest price from domestic vendors
- `avg_domestic_price` (DECIMAL): Average price from domestic vendors  
- `max_domestic_price` (DECIMAL): Highest price from domestic vendors
- `total_domestic_qty` (BIGINT): Total available quantity from domestic vendors
- `latest_offer_date` (DATE): Most recent offer date
- `domestic_vendors` (TEXT[]): Array of domestic vendor names
- `lowest_price_vendors` (TEXT[]): Vendors offering the lowest price

## Troubleshooting

### If Functions Don't Appear
1. Refresh the Supabase dashboard
2. Check the "Functions" section under "Database" in the sidebar
3. Re-run the SQL script if functions are missing

### If Test Queries Return Empty Results
This is normal if:
- No items have 3+ domestic vendors in the last 21 days
- Vendor offers data is limited
- The date filter excludes recent data

### If Permission Errors Occur
Ensure you're running the script with the service_role key or as a database admin.

## Integration with Dashboard

Once deployed, your dashboard APIs can call these functions using:

```javascript
const { data, error } = await supabase
  .rpc('get_items_with_3plus_domestic_vendors_21d');
```

This ensures consistent 21-day vendor logic across your entire dashboard.