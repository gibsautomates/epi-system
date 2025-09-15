# New Items Watchlist Dashboard

A comprehensive inventory management and vendor monitoring system built with Next.js, providing real-time tracking of new items, vendor pricing, and inventory trends for efficient procurement decisions.

## Overview

The New Items Watchlist Dashboard is an enterprise-grade solution for tracking items not currently in inventory but offered by vendors. It aggregates data from multiple vendor sources, analyzes pricing trends, and provides actionable insights for inventory expansion decisions.

## Key Features

### 1. **Multi-Module Dashboard System**
- **New Items Watchlist**: Track and analyze items offered by vendors but not in current inventory
- **Order Summary**: Monitor daily orders and fulfillment status
- **Orders Comparison Table**: Compare channel performance across time periods
- **Consolidate Needlist** (Coming Soon): Send needlists to vendors and track responses
- **Master File Generator** (Coming Soon): Generate comprehensive inventory reports

### 2. **Advanced Data Tracking**
Each item is monitored with comprehensive data points:
- **Product Information**: UPC, SKU, item name, brand
- **Pricing Analytics**: Lowest, average, and maximum prices across vendors
- **Vendor Intelligence**: Vendor counts (domestic/international), vendor lists, location tracking
- **Status Monitoring**: New, active, missing, reappeared status with streak tracking
- **Trend Analysis**: Price trends (up/down/stable) with percentage changes
- **Timeline Tracking**: First seen and last seen dates, times seen counter
- **Inventory Data**: Quantity available per vendor

### 3. **Interactive Features**
- **Vendor Breakdown View**: Click any item to see detailed vendor-by-vendor pricing and availability
- **Smart Filtering System**:
  - Search by UPC, item name, brand, or SKU
  - Multi-select vendor filtering
  - Location-based filtering (domestic/international/mixed)
  - Minimum vendor count threshold slider
- **Column Customization**: Show/hide 16+ available columns
- **Saved Views**: Save and load custom filter/column configurations
- **Excel Export**: Export filtered data with selected columns to Excel
- **Real-time Refresh**: Manual refresh for latest data updates
- **Expand/Collapse All**: View all vendor details at once

### 4. **Performance Optimization**
- Progressive loading with real-time status updates
- Handles 40,000+ items efficiently
- Chunked data processing for large datasets
- Client-side caching for improved performance
- Pagination for smooth UI experience

## Technical Architecture

### Frontend Stack
- **Framework**: Next.js 14.1.0
- **UI Library**: React 18 with TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **State Management**: React Hooks (useState, useEffect, useMemo)

### Backend Stack
- **API Routes**: Next.js API routes
- **Database**: Supabase (PostgreSQL)
- **Views**: Optimized SQL views for performance
- **Authentication**: Basic middleware for client access

### Database Views
- `vendor_offers_latest`: Latest vendor files within 21 days
- `vendor_offers_latest_new`: Items not in current inventory
- `new_items_dashboard`: Aggregated view with metrics per UPC

## Installation & Setup

### Prerequisites
- Node.js 16+ and npm
- Supabase account with project created
- Git for version control

### Local Development Setup

1. **Clone the repository**
```bash
git clone [repository-url]
cd New_Items_watchlist
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
Create a `.env.local` file:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. **Set up database views**
Run the SQL scripts in Supabase SQL Editor:
- Execute `database/SQL_VIEW_SETUP.sql`
- Verify views are created successfully

5. **Start development server**
```bash
npm run dev
```
Access the application at `http://localhost:3000`

### Production Deployment (Vercel)

1. Push code to GitHub repository
2. Import project to Vercel
3. Configure environment variables in Vercel dashboard
4. Deploy (automatic builds on push)

## Usage Guide

### Accessing the System

1. **Main Dashboard**: Navigate to `http://localhost:3000`
2. **Watchlist**: Click "New Items Watchlist" card
3. **Direct Access**: Go to `http://localhost:3000/dashboard`

### Working with Data

#### Filtering Data
1. **Search**: Real-time search across UPC, name, brand, SKU
2. **Vendor Selection**: Ctrl+click for multiple vendors
3. **Location Filter**: Choose domestic-only or all locations
4. **Vendor Count**: Slide to set minimum vendor threshold

#### Viewing Details
1. Click arrow icon next to UPC for vendor breakdown
2. View includes:
   - Individual vendor prices
   - Quantity per vendor
   - Domestic/International status
   - Date of last offer
   - Highlighted lowest price vendor

#### Customizing Display
1. Click "Columns" to open customization panel
2. Check/uncheck columns to show/hide
3. Available column groups:
   - Basic (UPC, Name, Brand)
   - Pricing (Lowest, Average, Max)
   - Vendors (Count, List, Lowest)
   - Tracking (Status, Streak, Times Seen)
   - Dates (First Seen, Last Seen)

#### Exporting Data
1. Apply desired filters
2. Click "Export Excel" button
3. Limited to 10,000 rows for performance
4. File downloads with current date timestamp

#### Saving Views
1. Configure filters and columns
2. Click "Save View"
3. Enter memorable name
4. Load saved views from dropdown

### Performance Considerations

- **Initial Load**: 2-3 minutes for full dataset (40,000+ items)
- **Filtering**: Instant client-side filtering after initial load
- **Export Limit**: 10,000 items maximum per export
- **Pagination**: 50 items per page for smooth scrolling

## API Reference

### Endpoints

#### `GET /api/watchlist/dashboard-view`
Returns aggregated dashboard data with metrics
- Query params: `limit` (default 100)
- Response: Items array and metrics object

#### `GET /api/watchlist/item-vendors`
Returns detailed vendor breakdown for specific UPC
- Query params: `upc` (required)
- Response: Vendor array with pricing details

#### `POST /api/watchlist/export`
Exports filtered data to Excel format
- Body: `{ data: [], columns: [] }`
- Response: Excel file blob

## Troubleshooting

### Common Issues & Solutions

1. **Slow Initial Load**
   - Expected behavior for large datasets
   - Check network tab for API response times
   - Verify database indexes are created

2. **Export Not Downloading**
   - Check browser popup blocker
   - Verify filtered data < 10,000 items
   - Try different browser

3. **Missing Vendor Data**
   - Click refresh to update cache
   - Check date range filters
   - Verify vendor_offers table has recent data

4. **Authentication Errors**
   - Verify environment variables are set
   - Check Supabase API keys are valid
   - Ensure row-level security is configured

## Data Refresh & Maintenance

- **Automatic Updates**: Database views update with new data inserts
- **Manual Refresh**: Click refresh button for immediate updates
- **Data Retention**: 21-day rolling window for vendor offers
- **Maintenance Window**: Scheduled for 2 AM EST daily

## Future Roadmap

### Q4 2025
- [ ] Consolidate Needlist Module
- [ ] Master File Generator
- [ ] Automated email alerts for price changes
- [ ] Historical trend charts

### Q1 2026
- [ ] Machine learning price predictions
- [ ] Vendor performance scoring
- [ ] Bulk update operations
- [ ] Mobile responsive design

## Support & Contact

For technical issues or questions:
- Check troubleshooting guide above
- Review browser console for errors
- Contact system administrator
- Submit issue on GitHub repository

## License

Proprietary - EPI Dashboard System. All rights reserved.

---

**Version**: 1.0.0
**Last Updated**: September 2025
**Maintained By**: EPI Development Team