# New Items Watchlist System - Setup Guide

## Quick Start

### Step 1: Verify Connection
```bash
node check-actual-tables.js
```

### Step 2: Run Initial Analysis
```bash
node new-items-analyzer-optimized.js
```
This generates:
- `New_Items_Report_YYYY-MM-DD.xlsx` - Full Excel report
- `Priority_Items_YYYY-MM-DD.csv` - Items with 3+ domestic vendors

### Step 3: Create Tracking Tables (Optional)
Run this SQL in Supabase SQL Editor for advanced tracking:

```sql
CREATE TABLE IF NOT EXISTS new_items_master (
  upc TEXT PRIMARY KEY,
  item_name TEXT,
  brand TEXT,
  first_seen_date DATE DEFAULT CURRENT_DATE,
  last_seen_date DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'active',
  acquired_date DATE,
  domestic_vendor_count INTEGER DEFAULT 0,
  international_vendor_count INTEGER DEFAULT 0,
  min_price_domestic DECIMAL(10,2),
  avg_price_domestic DECIMAL(10,2),
  max_price_domestic DECIMAL(10,2),
  price_trend TEXT,
  vendor_list JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Current System Status

### ✅ Working Features:
1. **New Items Detection** - Finds all items not in current_inventory
2. **3+ Vendor Filtering** - Identifies high-opportunity items
3. **Excel Report Generation** - Professional formatted reports
4. **Price Analysis** - Min/Avg/Max pricing per item
5. **Vendor Tracking** - Lists all vendors per item

### 📊 Last Analysis Results:
- **39,503** new items identified
- **5,029** items with 3+ domestic vendors
- **27** vendors max per single item
- Reports generated in ~40 seconds

## Usage Scenarios

### Weekly Vendor File Update:
1. Update `vendor_offers` table with new vendor data
2. Run: `node new-items-analyzer-optimized.js`
3. Send `New_Items_Report_*.xlsx` to client
4. Review top opportunities in Excel

### Check Specific Item Availability:
- Open generated Excel file
- Filter by UPC or item name
- View all vendors offering that item
- Compare prices across vendors

## Report Structure

### Excel File Contents:
1. **Summary Sheet** - Overview metrics
2. **3+ Domestic Vendors** - Priority items for client
3. **All New Items** - Complete list

### Key Columns:
- UPC
- Item Name
- Brand
- Vendor Count
- Vendor List
- Min/Avg/Max Price
- First/Last Seen Dates

## n8n Integration Points

Ready for automation with these endpoints:
- `/refresh-watchlist` - Update watchlist
- `/generate-report` - Create reports
- `/inventory-updated` - Trigger on changes

## Troubleshooting

### If script times out:
- Check internet connection
- Verify Supabase credentials
- Run during off-peak hours

### If no items found:
- Verify `current_inventory` has data
- Check `vendor_offers` is updated
- Confirm UPC format matching

## Next Steps
1. Set up automated weekly runs
2. Configure n8n workflows
3. Build web dashboard
4. Add email distribution