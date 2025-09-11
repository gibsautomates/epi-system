# Dashboard Data Fetching Logic Documentation

## Core Business Logic

### What We Fetch
1. **Vendor Offers**: ONLY the LATEST file from each vendor within the 21-day window
2. **Inventory**: ALL current inventory records for comparison

### Why This Approach
- Each vendor sends updated files periodically (e.g., daily, weekly)
- We only want the MOST RECENT snapshot from each vendor
- If Vendor A sent files on 08/27 and 09/02, we ONLY use 09/02 data
- This prevents duplicate/outdated data from skewing metrics

### Example Scenario
```
Today: 09/04/2025
21-day cutoff: 08/14/2025

Vendor A files:
- 08/27/2025: 1000 items ❌ IGNORE (not latest)
- 09/02/2025: 1200 items ✅ USE (latest within 21 days)

Vendor B files:
- 08/10/2025: 500 items ❌ IGNORE (outside 21-day window)
- 08/20/2025: 600 items ✅ USE (latest within 21 days)
```

## Implementation Steps

### Step 1: Find Latest Date Per Vendor
```sql
SELECT vendor, date 
FROM vendor_offers 
WHERE date >= '21_days_ago'
ORDER BY vendor ASC, date DESC
```
Then take the FIRST (latest) date for each vendor.

### Step 2: Fetch All Inventory
```sql
SELECT UPC, upc_text FROM current_inventory
```
No limit needed - we need all inventory to determine "new" items.

### Step 3: Fetch Offers (ONLY Latest Per Vendor)
For each vendor and their latest date:
```sql
SELECT * FROM vendor_offers 
WHERE vendor = 'VendorName' 
AND date = 'latest_date_for_this_vendor'
```

## Critical Points
- ✅ DO: Fetch ONLY the latest file per vendor
- ✅ DO: Include all vendors with data in last 21 days
- ✅ DO: Fetch ALL inventory for comparison
- ❌ DON'T: Fetch all historical data from last 21 days
- ❌ DON'T: Include older files from the same vendor

## Performance Optimizations
1. Process vendors in batches (5-10 at a time) to avoid overwhelming database
2. Use pagination for large vendor files (5000 items per page)
3. Fetch inventory in parallel while processing vendor dates

## Dashboard Metrics Should Show
- **Vendor Offers Fetched**: Total items from latest files only
- **Inventory Records**: Total current inventory
- **Vendors with Latest Files**: Number of vendors included

## File Location
The implementation is in: `/app/api/watchlist/dashboard-fast/route.ts`

## Testing Checklist
- [ ] Verify only latest file per vendor is fetched
- [ ] Check that vendor count matches unique vendors in 21-day window
- [ ] Confirm inventory count is complete (not limited)
- [ ] Validate that older vendor files are excluded