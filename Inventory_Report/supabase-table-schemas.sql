-- Create inventory data table for SellerCloud sync
CREATE TABLE IF NOT EXISTS inventory_data (
    id BIGSERIAL PRIMARY KEY,
    vendorSKU VARCHAR(255) NOT NULL,
    UPC VARCHAR(255) NOT NULL,
    AggregatedQty INTEGER DEFAULT 0,
    OnOrder INTEGER DEFAULT 0,
    SiteCost DECIMAL(10,2) DEFAULT 0.00,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Composite unique constraint for upsert operations
    UNIQUE(vendorSKU, UPC)
);

-- Create error log table for sync monitoring
CREATE TABLE IF NOT EXISTS sync_error_log (
    id BIGSERIAL PRIMARY KEY,
    errorType VARCHAR(100) NOT NULL,
    errorMessage TEXT,
    pageNumber INTEGER,
    timestamp BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create sync status table for tracking sync progress
CREATE TABLE IF NOT EXISTS sync_status (
    id BIGSERIAL PRIMARY KEY,
    sync_started_at TIMESTAMPTZ DEFAULT NOW(),
    sync_completed_at TIMESTAMPTZ,
    total_records_processed INTEGER DEFAULT 0,
    total_errors INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'IN_PROGRESS', -- IN_PROGRESS, COMPLETED, FAILED
    last_successful_page INTEGER DEFAULT 0
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_inventory_vendorsku ON inventory_data(vendorSKU);
CREATE INDEX IF NOT EXISTS idx_inventory_upc ON inventory_data(UPC);
CREATE INDEX IF NOT EXISTS idx_inventory_last_updated ON inventory_data(last_updated);
CREATE INDEX IF NOT EXISTS idx_sync_error_timestamp ON sync_error_log(created_at);
CREATE INDEX IF NOT EXISTS idx_sync_status_started ON sync_status(sync_started_at);

-- Row Level Security (RLS) policies (adjust as needed)
ALTER TABLE inventory_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_error_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_status ENABLE ROW LEVEL SECURITY;

-- Example policies (adjust based on your auth setup)
-- CREATE POLICY "Enable read access for authenticated users" ON inventory_data
--     FOR SELECT USING (auth.role() = 'authenticated');

-- CREATE POLICY "Enable insert/update for service role" ON inventory_data
--     FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Function to update last_updated timestamp
CREATE OR REPLACE FUNCTION update_inventory_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update timestamp on row changes
CREATE TRIGGER inventory_update_timestamp
    BEFORE UPDATE ON inventory_data
    FOR EACH ROW
    EXECUTE FUNCTION update_inventory_timestamp();