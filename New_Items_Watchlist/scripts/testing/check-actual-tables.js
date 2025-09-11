const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkActualTables() {
  console.log('Checking for actual Supabase tables from screenshot...\n');
  
  const actualTables = [
    'active_vendors_21d',
    'all_items_list',
    'current_inventory',
    'items_overall_rollup',
    'local_calendar',
    'orders_raw',
    'sc_products',
    'vendor_feeds_daily',
    'vendor_files_log',
    'vendor_offers',
    'vendor_offers_duplicate',
    'vendor_offers_upload_test',
    'vendors_expected',
    'vendors_missing_today',
    'watchlist_history',
    'watchlist_items'
  ];

  const foundTables = [];
  console.log('Testing each table:');
  
  for (const table of actualTables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (!error) {
        foundTables.push({ table, count: count || 0 });
        console.log(`  ✅ ${table}: Found (${count || 0} rows)`);
      } else {
        console.log(`  ❌ ${table}: ${error.message}`);
      }
    } catch (err) {
      console.log(`  ❌ ${table}: ${err.message}`);
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Found ${foundTables.length} of ${actualTables.length} tables`);
  if (foundTables.length > 0) {
    console.log('\nAccessible tables:');
    foundTables.forEach(t => {
      console.log(`  - ${t.table}: ${t.count} rows`);
    });
  }

  // Try to get a sample from a table with data
  const tablesWithData = foundTables.filter(t => t.count > 0);
  if (tablesWithData.length > 0) {
    console.log(`\nSample data from ${tablesWithData[0].table}:`);
    const { data, error } = await supabase
      .from(tablesWithData[0].table)
      .select('*')
      .limit(3);
    
    if (!error && data) {
      console.log(JSON.stringify(data, null, 2));
    }
  }

  return foundTables;
}

checkActualTables();