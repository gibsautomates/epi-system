const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseKey);

async function testSQLFunctions() {
  console.log('🧪 Testing 21-Day Vendor Logic SQL Functions');
  console.log('📍 Supabase URL:', supabaseUrl);
  console.log('=' .repeat(60));

  const functionsToTest = [
    {
      name: 'get_items_with_3plus_domestic_vendors_21d',
      description: 'Items with 3+ domestic vendors',
      params: {}
    },
    {
      name: 'get_vendor_performance_21d',
      description: 'Vendor performance metrics',
      params: {}
    },
    {
      name: 'get_new_items_21d',
      description: 'New items in last 21 days',
      params: {}
    },
    {
      name: 'get_competitive_items_21d',
      description: 'Competitive items (>20% price variance)',
      params: { min_price_variance_pct: 20.0 }
    },
    {
      name: 'get_upc_price_trend_21d',
      description: 'Price trend for sample UPC',
      params: { input_upc: '855560005787' }
    }
  ];

  let successCount = 0;
  let totalTests = functionsToTest.length;

  for (const func of functionsToTest) {
    console.log(`\n🔍 Testing: ${func.name}`);
    console.log(`📝 Description: ${func.description}`);
    
    try {
      const { data, error } = await supabase.rpc(func.name, func.params);
      
      if (error) {
        console.log(`❌ Function failed:`, error.message);
        if (error.code === 'PGRST202') {
          console.log('💡 This usually means the function hasn\'t been deployed yet');
          console.log('💡 Please run the SQL script manually in Supabase Dashboard');
        }
      } else {
        console.log(`✅ Function executed successfully`);
        console.log(`📊 Returned ${data.length} rows`);
        
        if (data.length > 0) {
          console.log(`📋 Sample data structure:`, Object.keys(data[0]));
          
          // Show sample data for the main function
          if (func.name === 'get_items_with_3plus_domestic_vendors_21d') {
            console.log(`📋 Sample items with 3+ vendors:`);
            data.slice(0, 3).forEach((item, i) => {
              console.log(`  ${i + 1}. ${item.item_name || 'Unknown Item'}`);
              console.log(`     - UPC: ${item.upc_code}`);
              console.log(`     - Domestic Vendors: ${item.domestic_vendor_count}`);
              console.log(`     - Total Vendors: ${item.total_vendor_count}`);
              console.log(`     - Price Range: $${item.min_domestic_price} - $${item.max_domestic_price}`);
              console.log(`     - Latest Offer: ${item.latest_offer_date}`);
            });
          }
          
          if (func.name === 'get_vendor_performance_21d') {
            console.log(`📋 Top performing vendors:`);
            data.slice(0, 3).forEach((vendor, i) => {
              console.log(`  ${i + 1}. ${vendor.vendor_name} (${vendor.location})`);
              console.log(`     - Total Offers: ${vendor.total_offers}`);
              console.log(`     - Unique Items: ${vendor.unique_items}`);
              console.log(`     - Avg Price: $${parseFloat(vendor.avg_price).toFixed(2)}`);
            });
          }
        } else {
          console.log(`📋 No data returned (this may be expected depending on your dataset)`);
        }
        
        successCount++;
      }
    } catch (testError) {
      console.log(`❌ Function test error:`, testError.message);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`🎯 Test Summary: ${successCount}/${totalTests} functions working`);
  
  if (successCount === totalTests) {
    console.log('🎉 All functions deployed and working correctly!');
    console.log('✅ Your dashboard can now use consistent 21-day vendor logic');
    console.log('\n🔧 Next Steps:');
    console.log('1. Update your dashboard API endpoints to use these functions');
    console.log('2. Replace any custom vendor counting logic with these standardized functions');
    console.log('3. Ensure all vendor breakdown pages use the same data source');
  } else {
    console.log('⚠️  Some functions are not available yet');
    console.log('💡 Please follow the manual deployment guide:');
    console.log('   1. Open: https://supabase.com/dashboard/project/oozneazuydjsjvlswpqu/sql');
    console.log('   2. Paste the contents of 21_day_vendor_logic.sql');
    console.log('   3. Execute the script');
    console.log('   4. Run this test again');
  }
}

// Run tests
testSQLFunctions().then(() => {
  console.log('\n✨ Function testing completed');
}).catch((error) => {
  console.error('💥 Testing failed:', error);
});