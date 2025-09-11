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

-- Orders Daily Table (Updated to match CSV headers exactly)
CREATE TABLE orders_daily (
    id SERIAL PRIMARY KEY,
    "OrderID" BIGINT NOT NULL,
    "OrderItemID" BIGINT NOT NULL,
    "KitItemId" BIGINT,
    "UserID" BIGINT,
    "UserName" VARCHAR(100),
    "eBayUserID" VARCHAR(100),
    "FirstName" VARCHAR(100),
    "LastName" VARCHAR(100),
    "CompanyName" VARCHAR(200),
    "OrderShippingPromiseDate" DATE,
    "SiteCode" VARCHAR(10),
    "TimeOfOrder" TIMESTAMP WITH TIME ZONE,
    "SubTotal" DECIMAL(10,2),
    "ShippingTotal" DECIMAL(10,2),
    "OrderDiscountsTotal" DECIMAL(10,2),
    "GrandTotal" DECIMAL(10,2),
    "StatusCode" VARCHAR(50),
    "PaymentStatus" VARCHAR(50),
    "PaymentDate" DATE,
    "PaymentReferenceNumber" VARCHAR(100),
    "PaymentMethod" VARCHAR(50),
    "ShippingStatus" VARCHAR(50),
    "ShipDate" TIMESTAMP WITH TIME ZONE,
    "ShippingFee" DECIMAL(10,2),
    "ShipFirstName" VARCHAR(100),
    "ShipLastName" VARCHAR(100),
    "ShipCompanyName" VARCHAR(200),
    "ShipAddress1" VARCHAR(200),
    "ShipAddress2" VARCHAR(200),
    "ShipCity" VARCHAR(100),
    "ShipState" VARCHAR(50),
    "ShipZipCode" VARCHAR(20),
    "ShipCountry" VARCHAR(10),
    "ShipPhoneNumber" VARCHAR(50),
    "OrderSource" VARCHAR(50),
    "OrderSourceOrderID" VARCHAR(100),
    "eBaySalesRecordNumber" BIGINT,
    "ShippingMethodSelected" VARCHAR(100),
    "IsRushOrder" BOOLEAN,
    "InvoicePrinted" BOOLEAN,
    "InvoicePrintedDate" DATE,
    "ShippingCarrier" VARCHAR(50),
    "PackageType" VARCHAR(50),
    "CompanyID" VARCHAR(10),
    "OrderSourceOrderTotal" DECIMAL(10,2),
    "StationID" INTEGER,
    "CustomerServiceStatus" VARCHAR(50),
    "TaxRate" DECIMAL(5,4),
    "TaxTotal" DECIMAL(10,2),
    "GoogleOrderNumber" VARCHAR(100),
    "IsInDispute" BOOLEAN,
    "DisputeStartedOn" DATE,
    "PaypalFeeTotal" DECIMAL(10,2),
    "PostingFeeTotal" DECIMAL(10,2),
    "FinalValueTotal" DECIMAL(10,2),
    "ShippingWeightTotalOz" DECIMAL(8,2),
    "ProductID" VARCHAR(50),
    "Qty" INTEGER,
    "DisplayName" TEXT,
    "LineTotal" DECIMAL(10,2),
    "eBayItemID" BIGINT,
    "BackOrderQty" INTEGER,
    "OriginalUnitPrice" DECIMAL(10,2),
    "OriginalShippingCost" DECIMAL(10,2),
    "TrackingNumber" VARCHAR(100),
    "SerialNumber" VARCHAR(100),
    "InventoryAvailableQty" INTEGER,
    "LocationNotes" VARCHAR(200),
    "UPC" VARCHAR(50),
    "MarketingSource" VARCHAR(100),
    "ShippedBy" VARCHAR(100),
    "ShipFromWarehouse" VARCHAR(100),
    "BusinessName" VARCHAR(100),
    order_date DATE GENERATED ALWAYS AS (DATE("TimeOfOrder")) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_orders_daily_order_date ON orders_daily(order_date);
CREATE INDEX idx_orders_daily_product_id ON orders_daily("ProductID");
CREATE INDEX idx_orders_daily_company_id ON orders_daily("CompanyID");
CREATE INDEX idx_orders_daily_order_source ON orders_daily("OrderSource");
CREATE INDEX idx_orders_daily_status ON orders_daily("StatusCode");
CREATE INDEX idx_orders_daily_company_order_source ON orders_daily("CompanyID", "OrderSource");

-- View for easy order summary reporting
CREATE VIEW order_summary_daily AS
SELECT 
    od.order_date,
    CONCAT(od."CompanyID", od."OrderSource") as channel_code,
    cl.channel_name,
    COUNT(DISTINCT od."OrderID") as total_orders,
    SUM(od."Qty") as total_units_sold,
    SUM(od."GrandTotal") as total_revenue,
    COUNT(DISTINCT od."ProductID") as unique_products,
    AVG(od."GrandTotal") as avg_order_value
FROM orders_daily od
JOIN channel_lookup cl ON CONCAT(od."CompanyID", od."OrderSource") = cl.channel_code
GROUP BY od.order_date, CONCAT(od."CompanyID", od."OrderSource"), cl.channel_name
ORDER BY od.order_date DESC, total_revenue DESC;

-- View for top SKUs by channel
CREATE VIEW top_skus_by_channel AS
SELECT 
    od.order_date,
    CONCAT(od."CompanyID", od."OrderSource") as channel_code,
    cl.channel_name,
    od."ProductID",
    od."DisplayName",
    SUM(od."Qty") as units_sold,
    SUM(od."LineTotal") as total_revenue,
    SUM(od."InventoryAvailableQty") as available_qty,
    AVG(od."OriginalUnitPrice") as price,
    ROW_NUMBER() OVER (PARTITION BY od.order_date, CONCAT(od."CompanyID", od."OrderSource") ORDER BY SUM(od."Qty") DESC) as rank
FROM orders_daily od
JOIN channel_lookup cl ON CONCAT(od."CompanyID", od."OrderSource") = cl.channel_code
WHERE od."StatusCode" = 'Completed'
GROUP BY od.order_date, CONCAT(od."CompanyID", od."OrderSource"), cl.channel_name, od."ProductID", od."DisplayName"
ORDER BY od.order_date DESC, CONCAT(od."CompanyID", od."OrderSource"), rank;