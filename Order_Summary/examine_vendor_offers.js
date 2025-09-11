const { createClient } = require('@supabase/supabase-js');

// Database credentials from .env.local
const supabaseUrl = 'https://oozneazuydjsjvlswpqu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vem5lYXp1eWRqc2p2bHN3cHF1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTUyNzYyNiwiZXhwIjoyMDYxMTAzNjI2fQ.gGoQitV8MTagu5bCX9czsdlE-2HhgEB4xYwZbpRuaVw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function examineVendorOffers() {
    console.log('=== EXAMINING VENDOR_OFFERS TABLE ===\n');
    
    try {
        // 1. Get table schema information by querying information_schema
        console.log('1. TABLE SCHEMA:');
        const { data: columns, error: schemaError } = await supabase
            .from('information_schema.columns')
            .select('column_name, data_type, is_nullable, column_default')
            .eq('table_name', 'vendor_offers')
            .eq('table_schema', 'public');
            
        if (schemaError) {
            console.error('Error getting schema:', schemaError);
        } else if (columns) {
            console.table(columns);
        }

        // 2. Get row count
        console.log('\n2. ROW COUNT:');
        const { count, error: countError } = await supabase
            .from('vendor_offers')
            .select('*', { count: 'exact', head: true });
            
        if (countError) {
            console.error('Error getting count:', countError);
        } else {
            console.log(`Total rows: ${count?.toLocaleString()}`);
        }

        // 3. Get sample records
        console.log('\n3. SAMPLE RECORDS:');
        const { data: samples, error: sampleError } = await supabase
            .from('vendor_offers')
            .select('*')
            .limit(10);
            
        if (sampleError) {
            console.error('Error getting samples:', sampleError);
        } else if (samples) {
            console.table(samples);
        }

        // 4. Get date range (using 'date' column instead of 'offer_date')
        console.log('\n4. DATE RANGE:');
        const { data: dateRange, error: dateError } = await supabase
            .from('vendor_offers')
            .select('date')
            .order('date', { ascending: true })
            .limit(1);
            
        const { data: maxDate, error: maxDateError } = await supabase
            .from('vendor_offers')
            .select('date')
            .order('date', { ascending: false })
            .limit(1);
            
        if (dateError || maxDateError) {
            console.error('Error getting date range:', dateError || maxDateError);
        } else {
            console.log(`Earliest date: ${dateRange?.[0]?.date}`);
            console.log(`Latest date: ${maxDate?.[0]?.date}`);
        }

        // 5. Get unique vendors
        console.log('\n5. UNIQUE VENDORS:');
        const { data: vendors, error: vendorError } = await supabase
            .from('vendor_offers')
            .select('vendor')
            .limit(1000);
            
        if (vendorError) {
            console.error('Error getting vendors:', vendorError);
        } else if (vendors) {
            const uniqueVendors = [...new Set(vendors.map(v => v.vendor))].sort();
            console.log(`Total unique vendors: ${uniqueVendors.length}`);
            console.log('Vendors:', uniqueVendors.slice(0, 20).join(', ') + (uniqueVendors.length > 20 ? '...' : ''));
        }

        // 6. Check indexes
        console.log('\n6. INDEXES:');
        const { data: indexes, error: indexError } = await supabase
            .rpc('exec_sql', { 
                sql: `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'vendor_offers' AND schemaname = 'public';` 
            });
            
        if (indexError) {
            console.error('Error getting indexes:', indexError);
        } else if (indexes) {
            console.table(indexes);
        }

        // 7. Sample of recent data (last 30 days)
        console.log('\n7. RECENT DATA SAMPLE (Last 30 days):');
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const { data: recentData, error: recentError } = await supabase
            .from('vendor_offers')
            .select('*')
            .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
            .limit(10);
            
        if (recentError) {
            console.error('Error getting recent data:', recentError);
        } else if (recentData) {
            console.log(`Recent records found: ${recentData.length}`);
            if (recentData.length > 0) {
                console.table(recentData);
            }
        }

        // 8. Check for 21-day data availability
        console.log('\n8. 21-DAY DATA AVAILABILITY:');
        const twentyOneDaysAgo = new Date();
        twentyOneDaysAgo.setDate(twentyOneDaysAgo.getDate() - 21);
        
        const { count: count21d, error: count21Error } = await supabase
            .from('vendor_offers')
            .select('*', { count: 'exact', head: true })
            .gte('date', twentyOneDaysAgo.toISOString().split('T')[0]);
            
        if (count21Error) {
            console.error('Error getting 21-day count:', count21Error);
        } else {
            console.log(`Records in last 21 days: ${count21d?.toLocaleString()}`);
        }

        // 9. Check actual columns in the table
        console.log('\n9. EXAMINING ACTUAL COLUMNS:');
        const { data: firstRow } = await supabase
            .from('vendor_offers')
            .select('*')
            .limit(1);
            
        if (firstRow && firstRow[0]) {
            console.log('Available columns:');
            console.log(Object.keys(firstRow[0]).join(', '));
        }

    } catch (error) {
        console.error('General error:', error);
    }
}

examineVendorOffers();