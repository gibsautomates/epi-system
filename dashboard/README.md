# EPI Order Analytics Dashboard

A secure Next.js dashboard for tracking and analyzing order data across multiple sales channels.

# **Status**: Production ready ✅ - New Items Watchlist added

## Features

- 🔒 **Password Protection** - Secure access with authentication
- 📊 **Order Comparisons** - Today vs Yesterday vs Last Week analytics
- 🔍 **Channel Filtering** - Filter by specific sales channels
- 📱 **Responsive Design** - Works on all devices
- ⚡ **Real-time Data** - Connected to Supabase database

## Pages

- **Homepage** - Dashboard overview and navigation
- **Order Summary** - Channel performance with SKU details
- **Comparison Table** - Clean table view with percentage changes

## Tech Stack

- **Framework:** Next.js 14
- **Database:** Supabase (PostgreSQL)
- **Styling:** Tailwind CSS
- **Deployment:** Vercel
- **Authentication:** Custom password protection

## Environment Variables

Create `.env.local` with:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_key
NEXT_PUBLIC_DASHBOARD_PASSWORD=your_dashboard_password
```

## Getting Started

```bash
npm install
npm run dev
```

Navigate to `http://localhost:3000` and enter the dashboard password.

## Security

- Environment variables are never committed to Git
- Supabase credentials stored securely
- Password protection on all pages
- Session-based authentication

---

Built for EPI order analytics and reporting.