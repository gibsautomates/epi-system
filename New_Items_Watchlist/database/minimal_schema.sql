-- Minimal schema to get the app running
-- Run this in Supabase SQL Editor if you don't have existing tables

-- Create normalize_upc function
CREATE OR REPLACE FUNCTION public.normalize_upc(upc_input text)
RETURNS text AS $$
BEGIN
    -- Simple normalization: remove spaces and dashes
    RETURN REPLACE(REPLACE(TRIM(upc_input), '-', ''), ' ', '');
END;
$$ LANGUAGE plpgsql;

-- Create vendors_expected table
CREATE TABLE IF NOT EXISTS public.vendors_expected (
    vendor text PRIMARY KEY,
    location text CHECK (location IN ('Domestic', 'International'))
);

-- Create vendor_offers table
CREATE TABLE IF NOT EXISTS public.vendor_offers (
    id SERIAL PRIMARY KEY,
    offer_date date NOT NULL,
    vendor text NOT NULL,
    upc text NOT NULL,
    item_name text,
    brand text,
    quantity integer,
    price numeric(10,2)
);

-- Create the view (simplified version with sample data)
CREATE OR REPLACE VIEW public.master_update_candidates_domestic AS
SELECT 
    '012345678901' AS upc_text,
    'Sample Item' AS item_name,
    'Sample Brand' AS brand,
    1 AS active_domestic_vendor_count_21d,
    100 AS latest_domestic_total_qty_21d,
    9.99 AS latest_domestic_min_price_21d,
    ARRAY['Vendor1']::text[] AS latest_domestic_min_price_vendors_21d,
    1 AS lifetime_vendor_count,
    CURRENT_DATE AS first_seen_global_date,
    ARRAY['Vendor1']::text[] AS first_seen_global_vendors,
    CURRENT_DATE AS last_seen_global_date,
    ARRAY['Vendor1']::text[] AS last_seen_global_vendors
WHERE FALSE; -- Empty view for now

-- Grant permissions
GRANT SELECT ON public.master_update_candidates_domestic TO authenticated;
GRANT SELECT ON public.master_update_candidates_domestic TO service_role;
GRANT SELECT ON public.vendor_offers TO authenticated;
GRANT SELECT ON public.vendor_offers TO service_role;
GRANT SELECT ON public.vendors_expected TO authenticated;
GRANT SELECT ON public.vendors_expected TO service_role;