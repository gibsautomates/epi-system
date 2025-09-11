# Dashboard Field Definitions

## Price Fields

- **Min Price**: The lowest price offered by any vendor for this item
- **Max Price**: The highest price offered by any vendor for this item  
- **Avg Price**: The average price across all vendors
- **Current Price**: Currently set to the minimum price (best available price)
- **Monthly Avg Price**: Average price over the last 30 days

## Vendor Fields

- **Lowest Vendor**: The vendor offering the lowest price for this item
- **Domestic Vendor Count**: Number of domestic vendors offering this item
- **Total Vendor Count**: Total vendors (domestic + international) offering this item
- **Vendor List**: Comma-separated list of all vendors offering this item

## Status & Trend Fields

- **Status**: 
  - `new` - Item first appeared within the last 7 days
  - `returned` - Item was seen before (>30 days ago) and is back on watchlist
  - `active` - Item has been on watchlist for 7-30 days

- **Price Trend**:
  - `up` - Price increased by >5% comparing last week to previous 3 weeks
  - `down` - Price decreased by >5% comparing last week to previous 3 weeks  
  - `stable` - Price change is within ±5%

- **Price Change %**: Percentage change between recent week average and previous 3 weeks average

## Date Fields

- **First Seen**: First date this item appeared in vendor offers (within last 21 days)
- **Last Seen**: Most recent date this item was offered
- **Days on Watchlist**: Number of days since first seen

## Other Fields

- **UPC**: Universal Product Code
- **Item Name**: Product description
- **Brand**: Product brand
- **SKU**: Stock Keeping Unit (if available)
- **Qty Available**: Total quantity available across all vendors
- **Vendor Category**: Classification based on domestic vendor count (3+ Vendors, 2 Vendors, 1 Vendor, No Domestic)