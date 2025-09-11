// Script to check what tables exist in your Supabase database
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabase() {
  console.log('Connecting to Supabase...');
  console.log('URL:', supabaseUrl);
  console.log('');

  try {
    // Query to get all tables
    const { data: tables, error: tablesError } = await supabase
      .rpc('get_tables_info', {}, { count: 'exact' })
      .single();

    if (tablesError) {
      // If the function doesn't exist, try a different approach
      console.log('Trying alternative method to fetch tables...\n');
      
      // Try to query information_schema directly
      const { data, error } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_type', 'BASE TABLE');

      if (error) {
        console.log('Could not query information_schema directly.');
        console.log('Let me try to detect tables by attempting to query common table names...\n');
        
        // Try common table names
        const commonTables = [
          'vendor_offers',
          'vendors_expected', 
          'watchlist_items',
          'sc_products',
          'sc_inventory',
          'users',
          'profiles',
          'items',
          'products'
        ];

        console.log('Checking for common tables:');
        console.log('----------------------------');
        
        for (const tableName of commonTables) {
          try {
            const { count, error } = await supabase
              .from(tableName)
              .select('*', { count: 'exact', head: true });
            
            if (!error) {
              console.log(`✓ ${tableName} exists (${count || 0} rows)`);
              
              // Get column info
              const { data: sample, error: sampleError } = await supabase
                .from(tableName)
                .select('*')
                .limit(1);
              
              if (!sampleError && sample && sample.length > 0) {
                const columns = Object.keys(sample[0]);
                console.log(`  Columns: ${columns.join(', ')}`);
              }
            } else if (error.code === '42P01') {
              console.log(`✗ ${tableName} does not exist`);
            }
          } catch (e) {
            // Table doesn't exist, skip
          }
        }
      } else {
        console.log('Tables in your database:');
        console.log('------------------------');
        data.forEach(table => {
          console.log(`- ${table.table_name}`);
        });
      }
    }

    // Check for views
    console.log('\nChecking for views:');
    console.log('-------------------');
    
    const viewNames = [
      'master_update_candidates_domestic',
      'master_update_candidates_international'
    ];
    
    for (const viewName of viewNames) {
      try {
        const { count, error } = await supabase
          .from(viewName)
          .select('*', { count: 'exact', head: true });
        
        if (!error) {
          console.log(`✓ ${viewName} exists (${count || 0} rows)`);
        } else {
          console.log(`✗ ${viewName} does not exist`);
        }
      } catch (e) {
        console.log(`✗ ${viewName} does not exist`);
      }
    }

  } catch (error) {
    console.error('Error connecting to Supabase:', error);
  }
}

checkDatabase();