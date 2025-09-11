const { createClient } = require('@supabase/supabase-js');

// Database credentials from .env.local
const supabaseUrl = 'https://oozneazuydjsjvlswpqu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vem5lYXp1eWRqc2p2bHN3cHF1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTUyNzYyNiwiZXhwIjoyMDYxMTAzNjI2fQ.gGoQitV8MTagu5bCX9czsdlE-2HhgEB4xYwZbpRuaVw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testFunctions() {
    console.log('=== TESTING 21-DAY SQL FUNCTIONS ===\n');
    
    try {
        // Test 1: Items with 3+ domestic vendors
        console.log('1. Testing get_items_with_3plus_domestic_vendors_21d()');
        const { data: items3plus, error: error1 } = await supabase
            .rpc('get_items_with_3plus_domestic_vendors_21d');
            
        if (error1) {
            console.error('Error:', error1);
        } else {
            console.log(`Found ${items3plus?.length || 0} items with 3+ domestic vendors`);
            if (items3plus && items3plus.length > 0) {
                console.table(items3plus.slice(0, 5)); // Show first 5
            }
        }

        // Test 2: Vendor performance
        console.log('\n2. Testing get_vendor_performance_21d()');
        const { data: vendorPerf, error: error2 } = await supabase
            .rpc('get_vendor_performance_21d');
            
        if (error2) {
            console.error('Error:', error2);
        } else {
            console.log(`Found ${vendorPerf?.length || 0} vendors with performance data`);
            if (vendorPerf && vendorPerf.length > 0) {
                console.table(vendorPerf);
            }
        }

        // Test 3: Price trend for specific UPC
        console.log('\n3. Testing get_upc_price_trend_21d() for UPC: 855560005787');
        const { data: priceTrend, error: error3 } = await supabase
            .rpc('get_upc_price_trend_21d', { input_upc: '855560005787' });
            
        if (error3) {
            console.error('Error:', error3);
        } else {
            console.log(`Found ${priceTrend?.length || 0} price points for this UPC`);
            if (priceTrend && priceTrend.length > 0) {
                console.table(priceTrend);
            }
        }

        // Test 4: New items
        console.log('\n4. Testing get_new_items_21d()');
        const { data: newItems, error: error4 } = await supabase
            .rpc('get_new_items_21d');
            
        if (error4) {
            console.error('Error:', error4);
        } else {
            console.log(`Found ${newItems?.length || 0} new items in last 21 days`);
            if (newItems && newItems.length > 0) {
                console.table(newItems.slice(0, 10)); // Show first 10
            }
        }

        // Test 5: Competitive items
        console.log('\n5. Testing get_competitive_items_21d() with 20% variance');
        const { data: competitive, error: error5 } = await supabase
            .rpc('get_competitive_items_21d', { min_price_variance_pct: 20.0 });
            
        if (error5) {
            console.error('Error:', error5);
        } else {
            console.log(`Found ${competitive?.length || 0} competitive items (>20% price variance)`);
            if (competitive && competitive.length > 0) {
                console.table(competitive.slice(0, 10)); // Show first 10
            }
        }

        // Summary report
        console.log('\n=== SUMMARY REPORT ===');
        const summary = {
            items_with_3plus_vendors: items3plus?.length || 0,
            active_vendors: vendorPerf?.length || 0,
            new_items_21d: newItems?.length || 0,
            competitive_items_20pct: competitive?.length || 0,
            total_vendor_offers_analyzed: vendorPerf?.reduce((sum, v) => sum + parseInt(v.total_offers || 0), 0) || 0,
            date_analyzed: new Date().toISOString().split('T')[0]
        };
        
        console.table([summary]);

    } catch (error) {
        console.error('General error:', error);
    }
}

testFunctions();