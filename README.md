# EPI (Enterprise Product Intelligence) System

A comprehensive business intelligence platform for product analysis, vendor management, and inventory tracking.

## 🏗️ Architecture

This is a multi-application system consisting of:

### 📊 **Dashboard** (`/dashboard`)
- **URL**: `http://localhost:3000`
- **Purpose**: Main analytics dashboard for business metrics
- **Tech**: Next.js 14, TypeScript, Tailwind CSS
- **Database**: Supabase PostgreSQL

### 🔍 **New Items Watchlist** (`/New_Items_Watchlist`)  
- **URL**: `http://localhost:3001`
- **Purpose**: Track and analyze new product opportunities with 39k+ items
- **Features**: Vendor analysis, competitive pricing, market trends
- **Tech**: Next.js 14, TypeScript, Tailwind CSS
- **Database**: Supabase PostgreSQL with optimized views

### 📈 **Order Summary** (`/Order_Summary`)
- **Purpose**: Order processing and vendor analysis tools
- **Features**: CSV processing, data transformation scripts
- **Tech**: Node.js scripts, Python utilities

### 📋 **Inventory Report** (`/Inventory_Report`)
- **Purpose**: Inventory management and reporting tools

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Supabase account with configured database

### Environment Setup
1. Copy `.env.local.example` to `.env.local` in each app directory
2. Configure Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

### Development
```bash
# Install dependencies for all apps
npm run install:all

# Start all applications
npm run dev:all

# Or start individual apps
cd dashboard && npm run dev          # http://localhost:3000
cd New_Items_Watchlist && npm run dev  # http://localhost:3001
```

## 🗄️ Database Architecture

### Core Tables
- `vendor_offers` - Raw vendor pricing data (101k+ records)
- `current_inventory` - Current stock levels
- `vendors_expected` - Vendor location mapping (Domestic/International)

### Optimized Views
- `new_items_dashboard_enhanced` - 39,540+ new product opportunities
- `vendor_offers_latest` - Latest offers within 21-day windows
- `dashboard_metrics_summary` - Pre-calculated KPIs

### Key Features
- **21-day vendor logic** for fresh data analysis
- **Domestic vs International** vendor tracking
- **Competitive analysis** with 3+ vendor filtering
- **Real-time metrics** with vendor count consistency
- **Pagination support** for large datasets (39k+ items)

## 📊 Key Metrics

### New Items Watchlist
- **39,540 total items** in enhanced view
- **52+ active vendors** across markets
- **Items with 3+ vendors** for competitive analysis
- **Consistent vendor counts** between main table and details
- **Automated pagination** for full dataset access

### Data Quality
- **Runtime error handling** for missing fields
- **Vendor list parsing** (comma-separated strings)
- **Price change tracking** with historical data
- **Status management** (NEW, WATCHING, ACQUIRED)

## 🔧 Development Features

### APIs Implemented
- `/api/watchlist/dashboard-view` - Main dashboard data with pagination
- `/api/watchlist/item-vendors` - Detailed vendor breakdown per UPC
- `/api/orders/summary` - Order processing endpoints
- `/api/orders/top-skus` - Top performing SKUs analysis

### Recent Improvements
- ✅ **Fixed runtime errors** with `toFixed()` method calls
- ✅ **Implemented pagination** for 39k+ dataset access  
- ✅ **Vendor count consistency** across all APIs
- ✅ **Enhanced error handling** and data validation
- ✅ **Database view optimization** for performance

## 🚀 Deployment Options

### 1. Vercel (Recommended for Next.js)
```bash
# Deploy all apps to Vercel
npm run deploy:vercel
```

### 2. Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up --build
```

### 3. Traditional VPS/Cloud
- See individual app deployment guides in each directory
- Requires Node.js runtime and reverse proxy (nginx)

## 🔐 Security

- Environment variables for sensitive data
- Supabase Row Level Security (RLS) enabled
- API rate limiting implemented
- CORS configuration for cross-origin requests

## 📚 Documentation

- [New Items Watchlist Documentation](./NEW_ITEMS_WATCHLIST_DOCUMENTATION.md)
- [Manual Deployment Guide](./dashboard/manual-deployment-guide.md)
- [Database Setup Guide](./database/README.md)
- [API Documentation](./docs/api.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes  
4. Test locally with `npm run dev:all`
5. Submit a pull request

## 📝 License

Private - Enterprise Use Only

---

**Last Updated**: $(date)
**Version**: 1.0.0
**System Status**: ✅ Fully Operational