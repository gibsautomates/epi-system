# 🚀 EPI System Deployment Guide

This guide covers multiple deployment options to publish your EPI system exactly as it works on localhost.

## 📋 Prerequisites

- Node.js 18+ installed
- Docker & Docker Compose (for containerized deployment)
- Git repository access
- Supabase database configured

## 🔧 Environment Setup

### 1. Create Environment Files

Create `.env.local` in each application directory:

**Dashboard** (`/dashboard/.env.local`):
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:3000
```

**New Items Watchlist** (`/New_Items_Watchlist/.env.local`):
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url  
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 2. Install Dependencies

```bash
cd C:\Gibs\EPI
npm install
npm run install:all
```

## 🌟 Deployment Options

### Option 1: Vercel (Recommended - Easiest)

**Advantages**: 
- Zero configuration 
- Automatic HTTPS
- Global CDN
- Serverless functions
- Perfect for Next.js

**Steps**:
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy Dashboard
cd dashboard
vercel --prod

# Deploy Watchlist  
cd ../New_Items_Watchlist
vercel --prod
```

**URLs After Deployment**:
- Dashboard: `https://your-dashboard.vercel.app`
- Watchlist: `https://your-watchlist.vercel.app`

### Option 2: Docker Deployment (Production-Ready)

**Advantages**:
- Complete environment isolation
- Scalable with load balancing
- Easy backup and recovery
- Works on any server

**Steps**:
```bash
# Clone and setup
git clone your-repo-url
cd epi-system

# Create production environment file
cp .env.example .env.production

# Build and run
docker-compose up --build -d
```

**URLs After Deployment**:
- Main System: `http://your-server-ip`
- Dashboard: `http://your-server-ip/` 
- Watchlist: `http://your-server-ip/watchlist`

### Option 3: Traditional VPS/Cloud Server

**Advantages**:
- Full control over server
- Custom domain configuration
- Cost-effective for high traffic

**Requirements**:
- Ubuntu 20.04+ or similar Linux server
- Node.js 18+ installed
- Nginx or Apache for reverse proxy
- PM2 for process management

**Steps**:

1. **Server Setup**:
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install Nginx
sudo apt install nginx -y
```

2. **Deploy Applications**:
```bash
# Clone repository
git clone your-repo-url /var/www/epi-system
cd /var/www/epi-system

# Install dependencies
npm run install:all

# Build applications
npm run build:all

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

3. **Configure Nginx**:
```bash
# Copy nginx configuration
sudo cp nginx/nginx.conf /etc/nginx/sites-available/epi-system
sudo ln -s /etc/nginx/sites-available/epi-system /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 🌐 Domain Configuration

### Custom Domain Setup

1. **DNS Configuration**:
```
A Record: your-domain.com -> your-server-ip
CNAME: www.your-domain.com -> your-domain.com
```

2. **SSL Certificate** (Let's Encrypt):
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

3. **Update Environment Variables**:
```env
NEXTAUTH_URL=https://your-domain.com
NEXT_PUBLIC_BASE_URL=https://your-domain.com
```

## 📊 Production Configuration

### Next.js Configuration Updates

Add to both `next.config.js` files:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // For Docker deployment
  experimental: {
    serverActions: true,
  },
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  async rewrites() {
    return [
      // Add any URL rewrites needed
    ];
  },
}

module.exports = nextConfig;
```

### PM2 Ecosystem Configuration

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'epi-dashboard',
      cwd: './dashboard',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
    {
      name: 'epi-watchlist', 
      cwd: './New_Items_Watchlist',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
    },
  ],
};
```

## 🔒 Security Considerations

### Environment Security
- Never commit `.env` files
- Use strong secrets for production
- Enable CORS only for required origins
- Use HTTPS in production

### Database Security
- Enable Row Level Security (RLS) in Supabase
- Use service role key only on server side
- Implement API rate limiting
- Monitor database usage

### Server Security (VPS Option)
```bash
# Firewall setup
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp  
sudo ufw allow 443/tcp
sudo ufw enable

# Fail2ban for SSH protection
sudo apt install fail2ban
```

## 📈 Monitoring & Maintenance

### Health Checks
- `/health` endpoint available on all deployments
- Monitor application logs with PM2: `pm2 logs`
- Set up uptime monitoring (UptimeRobot, etc.)

### Database Monitoring
- Monitor Supabase dashboard for usage
- Set up alerts for API limits
- Regular database backups

### Performance Optimization
- Enable Next.js Image Optimization
- Use Redis for caching (included in Docker setup)
- Monitor Core Web Vitals
- Set up CDN for static assets

## 🚨 Troubleshooting

### Common Issues

1. **Environment Variables Not Loading**:
   - Check `.env.local` file exists in correct directory
   - Verify variable names match exactly
   - Restart application after changes

2. **Database Connection Issues**:
   - Verify Supabase URL and keys
   - Check Supabase service status
   - Ensure RLS policies allow access

3. **Port Conflicts**:
   - Check if ports 3000/3001 are available
   - Use `netstat -an | findstr :3000` to check
   - Modify ports in docker-compose.yml if needed

4. **Build Failures**:
   - Clear `.next` directories
   - Delete `node_modules` and reinstall
   - Check Node.js version compatibility

### Rollback Strategy
```bash
# Quick rollback with PM2
pm2 reload all

# Docker rollback
docker-compose down
docker-compose up --build -d

# Git rollback
git revert HEAD
npm run deploy:all
```

## 📞 Support

- Check application logs first: `pm2 logs` or `docker-compose logs`
- Review Supabase dashboard for API errors
- Monitor server resources (CPU, memory, disk)
- Database query performance in Supabase

---

**🎯 Result**: Your EPI system will be accessible exactly like localhost, but available to the world!

**URLs Structure**:
- Main Dashboard: `https://your-domain.com/`
- New Items Watchlist: `https://your-domain.com/watchlist`  
- API Endpoints: `https://your-domain.com/api/*`
- Health Check: `https://your-domain.com/health`