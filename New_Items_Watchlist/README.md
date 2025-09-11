# New Items Watchlist Dashboard

A Next.js application for tracking and analyzing new product offerings from vendors.

## Features

- **Real-time Dashboard**: View new items not in current inventory
- **Smart Filtering**: Filter by vendor count, price range, and location
- **Database Views**: Optimized Supabase views for fast data access
- **Export Capabilities**: Download filtered data as CSV

## Project Structure

```
├── app/                      # Next.js app directory
│   ├── api/                  # API routes
│   │   └── watchlist/
│   │       └── dashboard-view/  # Current dashboard endpoint
│   └── dashboard/            # Dashboard page component
├── components/               # Reusable React components
├── database/                 # Database files
│   ├── migrations/          # Database migrations
│   ├── views/               # SQL view definitions
│   └── SQL_VIEW_SETUP.sql   # Main view setup script
├── docs/                     # Documentation
│   ├── DASHBOARD_LOGIC.md   # Dashboard business logic
│   └── SETUP_GUIDE.md       # Setup instructions
├── reports/                  # Generated reports
├── scripts/                  # Utility scripts
│   ├── testing/             # Test scripts
│   └── archive/             # Archived/old scripts
└── lib/                      # Shared utilities

```

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Add your Supabase credentials
```

3. Create database views:
- Run `database/SQL_VIEW_SETUP.sql` in Supabase SQL Editor

4. Start development server:
```bash
npm run dev
```

5. Open dashboard:
```
http://localhost:3000/dashboard
```

## Key Database Views

- `vendor_offers_latest`: Latest vendor files within 21 days
- `vendor_offers_latest_new`: Items not in current inventory  
- `new_items_dashboard`: Aggregated view with metrics per UPC

## Dashboard Metrics

- **New Items**: Unique UPCs not in current inventory
- **3+ Vendors**: Items offered by 3+ domestic vendors
- **Active Vendors**: Total vendors with recent offers

## Performance Notes

- Views automatically update with new data
- Dashboard limited to 100 items by default (use `?limit=500` for more)
- All metrics show full database counts