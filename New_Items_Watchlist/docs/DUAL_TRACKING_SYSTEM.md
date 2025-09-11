# Dual Tracking System: Global & Vendor Level

## Overview
The system now tracks item status at two levels:
1. **Global Level** - Overall item status across all vendors
2. **Vendor Level** - Individual vendor's relationship with each item

## Why Two Levels?

### Global Tracking Answers:
- "Is this item new to our watchlist?"
- "Has this item been removed from consideration?"
- "Did we acquire this item?"

### Vendor Tracking Answers:
- "Which vendor just started offering this item?"
- "Which vendor stopped carrying this item?"
- "How stable is each vendor's catalog?"
- "Which vendors compete on the same items?"

## Database Structure

```
watchlist_tracking (Global)          vendor_item_tracking (Per Vendor)
├── upc                              ├── upc
├── status (NEW_CANDIDATE, etc.)    ├── vendor
├── vendor_count                    ├── vendor_status (NEW, OFFERING, etc.)
├── lowest_price                    ├── price
└── snapshot_date                   └── snapshot_date
```

## Status Definitions

### Global Status (Item Level)
- **NEW_CANDIDATE** - First time on watchlist
- **WATCHING** - Continuously monitored
- **REMOVED** - No longer meets criteria
- **BACK_IN_FEED** - Returned after removal
- **ACQUIRED** - Purchased and in inventory

### Vendor Status (Vendor-Item Level)
- **NEW** - Vendor just started offering this item
- **OFFERING** - Vendor continues to offer item
- **REMOVED** - Vendor stopped offering item
- **BACK** - Vendor resumed offering after removal

## Dashboard View Fields

The enhanced view now includes both tracking levels:

```sql
-- Global tracking fields
global_status           -- Overall item status
lowest_price           -- Best price across all vendors (renamed from min_price)
lowest_vendor          -- Vendor with best price

-- Vendor tracking summary
vendors_new_count      -- How many vendors added this item today
vendors_offering_count -- How many vendors continue offering
vendors_removed_count  -- How many vendors removed this item
vendors_back_count     -- How many vendors brought it back
new_vendors           -- Names of vendors that added it
removed_vendors       -- Names of vendors that removed it
vendor_change_status  -- Quick indicator (HAS_NEW_VENDORS, LOST_VENDORS, etc.)
```

## Use Cases

### 1. Monitor Vendor Reliability
```sql
-- Find unstable vendors
SELECT vendor, 
       COUNT(CASE WHEN vendor_status = 'REMOVED' THEN 1 END) as removals,
       COUNT(CASE WHEN vendor_status = 'BACK' THEN 1 END) as returns
FROM vendor_item_tracking
WHERE snapshot_date >= CURRENT_DATE - 7
GROUP BY vendor
ORDER BY removals DESC;
```

### 2. Identify Competition Patterns
```sql
-- See which vendors compete on same items
SELECT item_name, vendor_list, domestic_vendor_count
FROM new_items_dashboard_enhanced
WHERE vendors_new_count > 2  -- Multiple vendors added same item
ORDER BY domestic_vendor_count DESC;
```

### 3. Alert on Critical Changes
```sql
-- Items at risk (losing vendors)
SELECT upc, item_name, 
       domestic_vendor_count as current_vendors,
       vendors_removed_count as lost_today,
       removed_vendors
FROM new_items_dashboard_enhanced
WHERE vendors_removed_count > 0 
  AND domestic_vendor_count < 5
ORDER BY vendors_removed_count DESC;
```

### 4. Vendor-Specific Analysis
```sql
-- What did CBS do today?
SELECT vendor_status, COUNT(*), AVG(price)
FROM vendor_item_tracking
WHERE vendor = 'CBS' 
  AND snapshot_date = CURRENT_DATE
GROUP BY vendor_status;
```

## Daily Update Process

Run the combined update function:
```sql
SELECT * FROM run_complete_tracking_update();
```

This will:
1. Update global tracking (item-level status)
2. Update vendor tracking (vendor-item relationships)
3. Return summary of both

## Benefits of Dual Tracking

### Strategic Insights
- **Vendor Performance**: Track which vendors are expanding/contracting
- **Market Dynamics**: See how items flow between vendors
- **Risk Management**: Identify items losing vendor support
- **Opportunity Detection**: Spot items gaining vendor interest

### Operational Benefits
- **Supplier Negotiation**: Know vendor's portfolio changes
- **Inventory Planning**: Predict item availability trends
- **Competitive Analysis**: Understand vendor positioning

## Example Scenarios

### Scenario 1: New Hot Item
- Global Status: `NEW_CANDIDATE`
- Vendor Status: 5 vendors show `NEW`
- Action: High interest item, consider immediate acquisition

### Scenario 2: Declining Item
- Global Status: `WATCHING`
- Vendor Status: 3 vendors show `REMOVED`, only 2 `OFFERING`
- Action: Item losing support, may become unavailable

### Scenario 3: Vendor Dropping Product Line
- Vendor CBS: 50 items show `REMOVED`
- Action: CBS may be exiting this category, find alternative suppliers

### Scenario 4: Market Recovery
- Global Status: `BACK_IN_FEED`
- Vendor Status: Multiple vendors show `BACK`
- Action: Item regaining market interest, reconsider for inventory

## Visualization Ideas

### Dashboard Cards
1. **Global Overview**: NEW: 145 | WATCHING: 3,240 | REMOVED: 89
2. **Vendor Activity**: NEW OFFERINGS: 523 | REMOVALS: 267
3. **Top Active Vendors**: CBS (+45), Aairie (+38), Classic (-22)
4. **At Risk Items**: 15 items below 3 vendors

### Vendor Heatmap
Show vendor x item matrix with color coding:
- Green: NEW
- Blue: OFFERING
- Red: REMOVED
- Yellow: BACK

## API Endpoints

### Get Status Summary
```
GET /api/watchlist/tracking-status
```

### Trigger Daily Update
```
POST /api/watchlist/update-tracking
```

### Get Vendor Analysis
```
GET /api/watchlist/vendor-analysis?vendor=CBS
```

## Next Steps

1. **Automated Alerts**: Set up notifications for critical changes
2. **Trend Analysis**: Build weekly/monthly trend reports
3. **Predictive Models**: Use historical data to predict item lifecycle
4. **Vendor Scoring**: Create reliability scores based on history