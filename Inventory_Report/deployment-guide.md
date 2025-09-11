# SellerCloud to Supabase Automation Setup Guide

## Prerequisites

1. **n8n Instance** - Self-hosted or cloud instance
2. **SellerCloud API Access** - API credentials and subdomain
3. **Supabase Project** - Database with proper credentials
4. **Email Service** (optional) - For error notifications

## Setup Steps

### 1. Supabase Database Setup

```sql
-- Run the SQL in supabase-table-schemas.sql in your Supabase SQL Editor
-- This creates the necessary tables and indexes
```

### 2. n8n Credentials Configuration

#### SellerCloud API Authentication
1. Go to n8n Settings > Credentials
2. Create "HTTP Header Auth" credential:
   - Name: `SellerCloud API`
   - Header Name: `Authorization`
   - Header Value: `Bearer YOUR_API_TOKEN`

#### Supabase Authentication  
1. Create "Supabase" credential:
   - Host: `YOUR_PROJECT.supabase.co`
   - Service Role Key: `YOUR_SERVICE_ROLE_KEY`

#### Email Authentication (Optional)
1. Create "SMTP" credential for error notifications
2. Configure your email service details

### 3. Import n8n Workflows

1. Import `n8n-sellercloud-supabase-workflow.json` as your main workflow
2. Import `n8n-error-handling-workflow.json` for enhanced error handling

### 4. Configure Environment Variables

Update these values in the workflow:
- `baseUrl`: Replace `YOUR_SUBDOMAIN` with your SellerCloud subdomain
- `tableId`: Ensure table names match your Supabase schema
- Email addresses for notifications

### 5. Set Up Scheduling

#### Option 1: n8n Cron Trigger
Add a Cron Trigger node to run the workflow:
- **Hourly**: `0 * * * *`
- **Every 4 hours**: `0 */4 * * *` 
- **Daily at 6 AM**: `0 6 * * *`

#### Option 2: External Trigger
Use webhooks or external systems to trigger the sync

### 6. Testing

1. Test with a small `pageSize` first (e.g., 5 records)
2. Monitor the `sync_error_log` table for issues
3. Verify data is being upserted correctly in `inventory_data`

## Performance Optimization

### For 25k Records:
- **Batch Size**: 50 records per API call (max allowed)
- **Total API Calls**: ~500 calls
- **Estimated Time**: 15-20 minutes (with rate limiting)
- **Rate Limiting**: 2-second delay between API calls

### Recommended Settings:
```json
{
  "pageSize": 50,
  "rateLimitDelay": 2,
  "retryAttempts": 3,
  "timeoutMs": 30000
}
```

## Monitoring & Maintenance

### Key Metrics to Monitor:
1. **Sync Status**: Check `sync_status` table
2. **Error Logs**: Monitor `sync_error_log` for issues
3. **Data Freshness**: Track `last_updated` in `inventory_data`

### Common Issues:
- **Rate Limiting**: Increase delay between requests
- **Authentication**: Refresh API tokens regularly  
- **Timeouts**: Reduce batch size or increase timeout
- **Data Quality**: Validate required fields before upsert

## Supabase Table Structure

### inventory_data
- Primary fields: `vendorSKU`, `UPC`, `AggregatedQty`, `OnOrder`, `SiteCost`
- Automatic timestamps: `created_at`, `last_updated`
- Upsert key: `(vendorSKU, UPC)`

### sync_error_log
- Tracks all sync errors with context
- Enables troubleshooting and monitoring

### sync_status  
- Tracks overall sync progress
- Useful for resuming failed syncs

## Security Considerations

1. **API Keys**: Store securely in n8n credentials
2. **RLS Policies**: Configure appropriate access controls
3. **Network**: Use HTTPS for all communications
4. **Monitoring**: Set up alerts for failed syncs

## Scaling Considerations

- **Large Datasets**: Consider breaking into smaller time-based chunks
- **Performance**: Use connection pooling and optimize queries
- **Reliability**: Implement circuit breakers for external dependencies