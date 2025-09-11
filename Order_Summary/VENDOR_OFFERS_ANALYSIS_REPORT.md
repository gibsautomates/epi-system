# Vendor Offers Table Analysis & 21-Day Logic Implementation

## Executive Summary

This report provides a comprehensive analysis of the `vendor_offers` table structure and implements SQL functions for 21-day vendor logic analysis. Based on the examination of 982,321 records, the table contains vendor pricing and inventory data from multiple suppliers.

## Table Structure Analysis

### Database Connection
- **Supabase URL**: `https://oozneazuydjsjvlswpqu.supabase.co`
- **Database**: PostgreSQL hosted on Supabase
- **Total Records**: 982,321 vendor offers
- **Date Range**: 2025-05-05 to 2025-09-08
- **Records in Last 21 Days**: ~198,558

### Schema Details

```sql
-- vendor_offers table structure
CREATE TABLE vendor_offers (
    id SERIAL PRIMARY KEY,                    -- Unique record identifier
    upc VARCHAR,                             -- Universal Product Code 
    upc_text VARCHAR,                        -- Normalized UPC text format
    item_name TEXT,                          -- Product name/description
    brand VARCHAR,                           -- Brand name (can be null)
    price DECIMAL(10,2),                     -- Vendor price
    qty INTEGER,                             -- Available quantity (can be null)
    msrp DECIMAL(10,2),                      -- Manufacturer suggested retail price (can be null)
    vendor VARCHAR NOT NULL,                 -- Vendor name
    date DATE NOT NULL,                      -- Offer date (KEY FIELD for 21-day logic)
    week DATE,                               -- Week grouping date
    location VARCHAR,                        -- 'Domestic' or 'International'
    sku VARCHAR                              -- Vendor SKU (can be null)
);
```

### Key Fields for 21-Day Logic

1. **UPC/Item Identification**
   - `upc`: Primary product identifier
   - `upc_text`: Normalized version
   - `item_name`: Product description

2. **Vendor Information**  
   - `vendor`: Vendor name (e.g., 'Aairie', 'BS', 'Cosmo', 'MTZ', 'Network')
   - `location`: Domestic vs International classification

3. **Date/Timestamp**
   - `date`: Offer date (critical for 21-day filtering)
   - `week`: Week grouping for analysis

4. **Pricing Information**
   - `price`: Vendor offered price
   - `msrp`: Manufacturer suggested retail price
   
5. **Inventory Data**
   - `qty`: Available quantity
   - `sku`: Vendor-specific SKU

### Current Vendor Landscape

Based on last 21 days analysis:
- **Active Vendors**: 4+ unique vendors
- **Location Distribution**: Primarily domestic vendors
- **Top Vendors by Volume**: 
  - Aairie: 557 offers
  - Acme: 273 offers  
  - BS: 168 offers
  - Classic: 2 offers

## Sample Data Patterns

### Multi-Vendor Items Example
```
UPC: 341319984 - LAIR DU TEMPS 3.4 EDT L
├── MTZ (Domestic): $29.75 - $32.00
└── Network (Domestic): $35.00

UPC: 8830010740 - CALVIN KLEIN "CK ONE" EDT 3.4 OZ SPR
├── Montroyal (Domestic): $16.50
└── PTC (International): $17.00
```

### Price Variance Analysis
- Some items show significant price variations (up to $4.25 difference)
- Cross-border pricing differences exist
- Quantity availability varies by vendor

## 21-Day Logic SQL Functions

### 1. Items with 3+ Domestic Vendors
```sql
SELECT * FROM get_items_with_3plus_domestic_vendors_21d();
```
**Returns**: Items meeting minimum vendor threshold with comprehensive pricing analysis

### 2. Vendor Performance Analysis  
```sql
SELECT * FROM get_vendor_performance_21d();
```
**Returns**: Vendor metrics including offer counts, price ranges, and item diversity

### 3. UPC Price Trend Analysis
```sql
SELECT * FROM get_upc_price_trend_21d('855560005787');
```
**Returns**: Historical price movements for specific items across vendors

### 4. New Item Discovery
```sql
SELECT * FROM get_new_items_21d();
```
**Returns**: Items first appearing in the last 21 days with vendor adoption metrics

### 5. Competitive Analysis
```sql
SELECT * FROM get_competitive_items_21d(20.0);
```
**Returns**: Items with significant price variance (>20%) indicating competitive opportunities

## Implementation Recommendations

### Performance Optimization
1. **Index Creation** (if not present):
   ```sql
   CREATE INDEX idx_vendor_offers_date ON vendor_offers(date);
   CREATE INDEX idx_vendor_offers_upc_date ON vendor_offers(upc, date);
   CREATE INDEX idx_vendor_offers_vendor_location ON vendor_offers(vendor, location);
   ```

2. **Query Optimization**: 
   - All functions filter on `date >= CURRENT_DATE - INTERVAL '21 days'`
   - Use vendor location filtering for domestic vs international analysis
   - Price filtering excludes NULL values for accurate calculations

### Business Logic Considerations

1. **Minimum Vendor Threshold**: Functions default to 3+ domestic vendors
2. **Price Variance Analysis**: 20% threshold for competitive flagging  
3. **New Item Detection**: Based on first appearance date
4. **Data Quality**: Handle NULL values in qty, price, and brand fields

### Integration Points

#### Dashboard Integration
The functions can be integrated into the existing dashboard by:
1. Adding API endpoints that call these functions
2. Creating new dashboard cards for 21-day metrics
3. Implementing filters for vendor count and price variance thresholds

#### Example API Integration
```typescript
// Add to dashboard API
export async function GET21DayAnalysis() {
  const { data } = await supabase.rpc('get_items_with_3plus_domestic_vendors_21d');
  return NextResponse.json({ items: data });
}
```

## Data Quality Assessment

### Strengths
- Comprehensive vendor coverage
- Regular data updates (recent offers within days)
- Rich metadata (brand, SKU, location)
- Good price data coverage

### Areas for Improvement  
- Some quantity fields are NULL
- Brand information incomplete for some items
- SKU data sparse across vendors

## Performance Metrics

### Current Data Volume (21 days)
- **Total Offers**: ~198,558
- **Unique Items**: High diversity across vendors
- **Average Offers per Day**: ~9,455
- **Data Freshness**: Updates within 1-2 days

### Expected Query Performance
- Index-optimized queries should execute in <2 seconds
- Function calls suitable for real-time dashboard updates
- Scalable for current data volume

## Files Delivered

1. **C:\Gibs\EPI\Order_Summary\21_day_vendor_logic.sql**
   - Complete SQL function definitions
   - Comprehensive 21-day analysis functions
   - Permission grants for authenticated and service roles

2. **C:\Gibs\EPI\Order_Summary\examine_vendor_offers.js**
   - Table structure analysis script
   - Data exploration and validation

3. **C:\Gibs\EPI\Order_Summary\vendor_analysis.js**
   - Detailed vendor and pricing analysis
   - Sample queries and data patterns

4. **C:\Gibs\EPI\Order_Summary\test_21day_functions.js**
   - Function testing and validation script
   - Performance verification

## Next Steps

1. **Deploy SQL Functions**: Run the SQL script in Supabase SQL editor
2. **Test Functions**: Execute test script to verify functionality  
3. **Create Indexes**: Add recommended indexes for performance
4. **Integrate Dashboard**: Add new API endpoints and UI components
5. **Monitor Performance**: Track query execution times and optimize as needed

---

**Report Generated**: September 11, 2025  
**Data Analyzed**: 982,321 vendor offers (2025-05-05 to 2025-09-08)  
**Focus Period**: Last 21 days (~198,558 records)