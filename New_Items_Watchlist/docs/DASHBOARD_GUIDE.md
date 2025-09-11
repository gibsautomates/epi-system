# New Items Watchlist Dashboard

## 🚀 Quick Start

### Start the Dashboard:
```bash
npm run dev
```

Then open: **http://localhost:3000/dashboard**

## 📊 Dashboard Features

### **Top Metrics Cards**
- **New Items**: Total items not in current inventory
- **3+ Vendors**: Items with 3+ domestic vendors (client-ready)
- **Active Vendors**: Unique vendors in last 21 days
- **Avg Price**: Average price across all new items

### **Interactive Filters**
1. **Search Bar** - Search by:
   - UPC
   - Item Name
   - Brand
   - SKU

2. **Vendor Multi-Select**
   - Select specific vendors to filter
   - Ctrl+Click for multiple selection

3. **Location Filter**
   - All (default)
   - Domestic Only
   - International Only

4. **Vendor Count Slider**
   - Slide to set minimum vendor threshold (1-10+)
   - Default shows all items

### **Column Management**
- Click "⚙️ Columns" button to customize visible columns
- Available column groups:
  - **Basic**: UPC, Item Name, Brand, SKU
  - **Pricing**: Current/Min/Avg/Max Price
  - **Vendors**: Vendor counts and names
  - **Dates**: First Seen, Last Seen
  - **Status**: New/Active/Missing/Reappeared
  - **Trends**: Price trends and % changes

### **Save & Load Views**
- Click "Save View" to save current filter + column configuration
- Views saved to browser's local storage
- Load saved views from dropdown menu

### **Export to Excel**
- Click "📥 Export Excel" button
- Exports filtered data with selected columns
- Includes 3 sheets:
  1. Summary statistics
  2. Item data
  3. Vendor analysis

## 🎨 Status Indicators

- 🟢 **New**: Items seen in last 7 days
- 🔵 **Active**: Currently available items
- 🟡 **Reappeared**: Items that came back after absence
- 🔴 **Missing**: Items no longer available

## 📈 Price Trends

- **↗️ Up**: Price increased >5%
- **↘️ Down**: Price decreased >5%
- **➖ Stable**: Price change ±5%

## 🔧 Advanced Features

### **Pagination**
- 50 items per page
- Navigate with Previous/Next buttons

### **Saved Views**
Views are saved with:
- Selected columns
- Active filters
- Vendor selections
- Location preferences
- Minimum vendor count

### **Real-time Search**
- Instant filtering as you type
- Searches across multiple fields
- Case-insensitive

## 📝 Data Updates

The dashboard pulls data from:
- **vendor_offers**: Last 21 days of vendor data
- **current_inventory**: Current SellerCloud inventory

Data is filtered to show only NEW items (not in inventory).

## 🛠️ Troubleshooting

### Dashboard not loading?
1. Check `.env` file has Supabase credentials
2. Verify `npm run dev` is running
3. Check browser console for errors

### No data showing?
1. Verify Supabase tables have data
2. Check date filters (21-day window)
3. Reset filters and try again

### Export not working?
1. Check if data is loaded
2. Try with fewer columns selected
3. Check browser downloads folder

## 🎯 Use Cases

### **For Clients**
1. Set minimum vendors to 3
2. Filter to Domestic only
3. Export report for review

### **For Analysis**
1. Use price trend column
2. Sort by vendor count
3. Check status indicators

### **For Purchasing**
1. Filter by specific vendors
2. Sort by lowest price
3. Check quantity available

## 💡 Tips

- **Performance**: Filter data before exporting large datasets
- **Views**: Create views for different team members
- **Columns**: Start with basic columns, add more as needed
- **Search**: Use partial UPC/name for broader results

## 🔄 Data Refresh

Currently manual - refresh page to get latest data.
Future: Auto-refresh every 5 minutes option.

---

**Note**: Dashboard shows items from last 21 days only to ensure price relevance.