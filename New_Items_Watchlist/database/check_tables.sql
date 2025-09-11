-- Query to list all tables in your Supabase database
-- Run this in Supabase SQL Editor

-- List all tables with their columns
SELECT 
    t.table_name,
    STRING_AGG(
        c.column_name || ' (' || c.data_type || ')', 
        ', ' 
        ORDER BY c.ordinal_position
    ) as columns
FROM information_schema.tables t
JOIN information_schema.columns c 
    ON t.table_name = c.table_name 
    AND t.table_schema = c.table_schema
WHERE t.table_schema = 'public' 
    AND t.table_type = 'BASE TABLE'
GROUP BY t.table_name
ORDER BY t.table_name;

-- Also list all views
SELECT 
    table_name as view_name
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;