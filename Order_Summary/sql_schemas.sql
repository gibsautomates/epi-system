-- Channel Lookup Table
CREATE TABLE channel_lookup (
    id SERIAL PRIMARY KEY,
    channel_code VARCHAR(50) NOT NULL UNIQUE,
    channel_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX idx_channel_lookup_code ON channel_lookup(channel_code);

-- Insert channel lookup data
INSERT INTO channel_lookup (channel_code, channel_name) VALUES
('163Amazon', 'Amazon'),
('211Dropship_Central', 'Dropship Canada'),
('163eBayOrder', 'eBay'),
('163GoogleExpress', 'Google'),
('227Fingerhut', 'Fingerhut'),
('272Groupon', 'Groupon'),
('222Website', 'OpenSky'),
('248Walmart', 'Walmart Dropship'),
('163Walmart_Marketplace', 'Walmart Marketplace'),
('207Website', 'Zulily'),
('323Website', 'Kroger'),
('278Website', 'Mason'),
('163Local_Store', '99 Orders'),
('168Walmart_Marketplace', 'Walmart Canada'),
('332Website', 'SPO Outlets'),
('304Blair', 'Blair'),
('163Website', '99 Orders'),
('305Website', 'Appleseeds'),
('304Website', 'Blair'),
('169eBayOrder', 'eBay'),
('163Wish', 'Wish'),
('340Website', 'AAFES'),
('272Local_Store', 'Groupon'),
('353Website', 'JTV'),
('359Website', 'Tiktok'),
('356Local_Store', 'Jomashop');

-- Orders Daily Table
CREATE TABLE orders_daily (
    id SERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL,
    order_item_id BIGINT NOT NULL,
    kit_item_id BIGINT,
    user_id BIGINT,
    user_name VARCHAR(100),
    ebay_user_id VARCHAR(100),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    company_name VARCHAR(200),
    order_shipping_promise_date DATE,
    site_code VARCHAR(10),
    time_of_order TIMESTAMP WITH TIME ZONE,
    sub_total DECIMAL(10,2),
    shipping_total DECIMAL(10,2),
    order_discounts_total DECIMAL(10,2),
    grand_total DECIMAL(10,2),
    status_code VARCHAR(50),
    payment_status VARCHAR(50),
    payment_date DATE,
    payment_reference_number VARCHAR(100),
    payment_method VARCHAR(50),
    shipping_status VARCHAR(50),
    ship_date DATE,
    shipping_fee DECIMAL(10,2),
    ship_first_name VARCHAR(100),
    ship_last_name VARCHAR(100),
    ship_company_name VARCHAR(200),
    ship_address1 VARCHAR(200),
    ship_address2 VARCHAR(200),
    ship_city VARCHAR(100),
    ship_state VARCHAR(50),
    ship_zip_code VARCHAR(20),
    ship_country VARCHAR(10),
    ship_phone_number VARCHAR(50),
    order_source VARCHAR(50),
    order_source_order_id VARCHAR(100),
    ebay_sales_record_number BIGINT,
    shipping_method_selected VARCHAR(100),
    is_rush_order BOOLEAN DEFAULT FALSE,
    invoice_printed BOOLEAN DEFAULT FALSE,
    invoice_printed_date DATE,
    shipping_carrier VARCHAR(50),
    package_type VARCHAR(50),
    company_id VARCHAR(10),
    order_source_order_total DECIMAL(10,2),
    station_id INTEGER,
    customer_service_status VARCHAR(50),
    tax_rate DECIMAL(5,4),
    tax_total DECIMAL(10,2),
    google_order_number VARCHAR(100),
    is_in_dispute BOOLEAN DEFAULT FALSE,
    dispute_started_on DATE,
    paypal_fee_total DECIMAL(10,2),
    posting_fee_total DECIMAL(10,2),
    final_value_total DECIMAL(10,2),
    shipping_weight_total_oz DECIMAL(8,2),
    product_id VARCHAR(50),
    qty INTEGER,
    display_name TEXT,
    line_total DECIMAL(10,2),
    ebay_item_id BIGINT,
    back_order_qty INTEGER DEFAULT 0,
    original_unit_price DECIMAL(10,2),
    original_shipping_cost DECIMAL(10,2),
    tracking_number VARCHAR(100),
    serial_number VARCHAR(100),
    inventory_available_qty INTEGER,
    location_notes VARCHAR(200),
    upc VARCHAR(50),
    marketing_source VARCHAR(100),
    shipped_by VARCHAR(100),
    ship_from_warehouse VARCHAR(100),
    business_name VARCHAR(100),
    -- Channel code and order_date will be computed in application layer
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_orders_daily_order_date ON orders_daily(order_date);
CREATE INDEX idx_orders_daily_product_id ON orders_daily(product_id);
CREATE INDEX idx_orders_daily_company_id ON orders_daily(company_id);
CREATE INDEX idx_orders_daily_order_source ON orders_daily(order_source);
CREATE INDEX idx_orders_daily_status ON orders_daily(status_code);
CREATE INDEX idx_orders_daily_company_order_source ON orders_daily(company_id, order_source);

-- View for easy order summary reporting
CREATE VIEW order_summary_daily AS
SELECT 
    od.order_date,
    CONCAT(od.company_id, od.order_source) as channel_code,
    cl.channel_name,
    COUNT(DISTINCT od.order_id) as total_orders,
    SUM(od.qty) as total_units_sold,
    SUM(od.grand_total) as total_revenue,
    COUNT(DISTINCT od.product_id) as unique_products,
    AVG(od.grand_total) as avg_order_value
FROM orders_daily od
JOIN channel_lookup cl ON CONCAT(od.company_id, od.order_source) = cl.channel_code
GROUP BY od.order_date, CONCAT(od.company_id, od.order_source), cl.channel_name
ORDER BY od.order_date DESC, total_revenue DESC;

-- View for top SKUs by channel
CREATE VIEW top_skus_by_channel AS
SELECT 
    od.order_date,
    CONCAT(od.company_id, od.order_source) as channel_code,
    cl.channel_name,
    od.product_id,
    od.display_name,
    SUM(od.qty) as units_sold,
    SUM(od.line_total) as total_revenue,
    SUM(od.inventory_available_qty) as available_qty,
    AVG(od.original_unit_price) as price,
    ROW_NUMBER() OVER (PARTITION BY od.order_date, CONCAT(od.company_id, od.order_source) ORDER BY SUM(od.qty) DESC) as rank
FROM orders_daily od
JOIN channel_lookup cl ON CONCAT(od.company_id, od.order_source) = cl.channel_code
WHERE od.status_code = 'Completed'
GROUP BY od.order_date, CONCAT(od.company_id, od.order_source), cl.channel_name, od.product_id, od.display_name
ORDER BY od.order_date DESC, CONCAT(od.company_id, od.order_source), rank;