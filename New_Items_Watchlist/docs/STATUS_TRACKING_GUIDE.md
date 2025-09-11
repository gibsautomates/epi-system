# Watchlist Status Tracking System

## Overview
The tracking system monitors item movement on the watchlist and assigns status codes based on their history and changes.

## Status Definitions

### 🆕 NEW_CANDIDATE
- **Description**: Items appearing on the watchlist for the first time
- **Criteria**: No previous tracking history
- **Action**: Review for potential acquisition

### 👁️ WATCHING  
- **Description**: Items continuously on the watchlist from the previous update
- **Criteria**: Was on watchlist yesterday and still meets criteria (3+ vendors)
- **Action**: Monitor price changes and vendor availability

### ❌ REMOVED
- **Description**: Items no longer meeting watchlist criteria
- **Criteria**: Either:
  - Vendor count dropped below 3
  - No longer offered by any vendors
- **Action**: Archive and monitor for potential return

### 🔄 BACK_IN_FEED
- **Description**: Previously removed items that returned to the watchlist
- **Criteria**: Was marked as REMOVED but now meets criteria again (3+ vendors)
- **Action**: Review why it returned (new vendors, price changes, etc.)

### ✅ ACQUIRED
- **Description**: Items purchased and added to inventory
- **Criteria**: UPC appears in current_inventory table
- **Action**: Remove from active watchlist monitoring

## Database Structure

### `watchlist_tracking` Table
```sql
- id: Primary key
- upc: Product UPC code
- status: Current status (NEW_CANDIDATE, WATCHING, etc.)
- vendor_count: Total vendor count
- lowest_price: Lowest available price
- snapshot_date: Date of this status snapshot
- item_name: Product name
- domestic_vendor_count: Count of domestic vendors
- vendor_list: Comma-separated vendor names
```

## Key Changes

### Fields Updated:
1. **Removed `current_price`** - Was duplicate of min_price
2. **Renamed `min_price` to `lowest_price`** - More descriptive name
3. **Added tracking-based status** - Replaces simple date-based status

## Daily Update Process

### Automatic Updates
Run the daily update function to refresh all statuses:
```sql
SELECT * FROM run_daily_watchlist_update();
```

### What Happens During Update:
1. **New items** are marked as NEW_CANDIDATE
2. **Existing items** are marked as WATCHING
3. **Missing items** are marked as REMOVED  
4. **Returning items** are marked as BACK_IN_FEED
5. **Inventory matches** are marked as ACQUIRED

## Useful Queries

### View Today's Status Summary
```sql
SELECT status, COUNT(*) as count
FROM watchlist_tracking
WHERE snapshot_date = CURRENT_DATE
GROUP BY status;
```

### Track Item History
```sql
SELECT snapshot_date, status, lowest_price, domestic_vendor_count
FROM watchlist_tracking
WHERE upc = [YOUR_UPC]
ORDER BY snapshot_date DESC;
```

### Find Price Drops in NEW_CANDIDATE Items
```sql
SELECT 
    upc,
    item_name,
    lowest_price,
    lowest_vendor,
    domestic_vendor_count
FROM new_items_dashboard_enhanced
WHERE status = 'NEW_CANDIDATE'
    AND lowest_price < 50
ORDER BY lowest_price ASC;
```

## Implementation Steps

1. **Run SQL Scripts** in this order:
   - `CREATE_TRACKING_TABLE.sql` - Creates tables and views
   - `DAILY_UPDATE_TRACKING.sql` - Creates update functions

2. **Initialize Tracking**:
   - First run will mark all items as NEW_CANDIDATE
   - Subsequent runs will properly track status changes

3. **Schedule Daily Updates**:
   - Option 1: Use pg_cron in Supabase
   - Option 2: Call from your application
   - Option 3: Manual daily execution

## API Integration

The enhanced view (`new_items_dashboard_enhanced`) automatically includes:
- Proper status based on tracking history
- `lowest_price` instead of `min_price` and `current_price`
- Historical comparison fields
- All tracking metadata

## Benefits

1. **Historical Tracking**: See how items move in and out of the watchlist
2. **Trend Analysis**: Identify patterns in vendor availability
3. **Acquisition Success**: Track which items were successfully acquired
4. **Return Patterns**: See which items frequently disappear and return
5. **Price History**: Monitor price changes over time