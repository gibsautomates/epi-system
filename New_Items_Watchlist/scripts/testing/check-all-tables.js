const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function listAllTables() {
  console.log('Attempting to list all Supabase tables...\n');
  
  // Method 1: Direct schema query
  console.log('Method 1: Querying pg_tables directly...');
  try {
    const { data, error } = await supabase.rpc('get_all_tables');
    if (!error && data) {
      console.log('Tables found via RPC:', data);
    } else if (error) {
      console.log('RPC method failed:', error.message);
    }
  } catch (err) {
    console.log('RPC not available');
  }

  // Method 2: Query system catalog
  console.log('\nMethod 2: Querying system catalog...');
  try {
    const query = `
      SELECT schemaname, tablename 
      FROM pg_tables 
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY schemaname, tablename;
    `;
    
    const { data, error } = await supabase.rpc('exec_sql', { query });
    if (!error && data) {
      console.log('Tables found:', data);
    } else if (error) {
      console.log('System catalog query failed:', error.message);
    }
  } catch (err) {
    console.log('Direct SQL not available');
  }

  // Method 3: Try common table names
  console.log('\nMethod 3: Testing common table names...');
  const commonTables = [
    'master_update_candidates_domestic',
    'items',
    'products',
    'users',
    'profiles',
    'watchlist',
    'new_items',
    'inventory',
    'orders',
    'categories',
    'brands',
    'suppliers',
    'master_items',
    'master_products',
    'update_candidates',
    'domestic_items',
    'international_items'
  ];

  const foundTables = [];
  for (const table of commonTables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (!error) {
        foundTables.push({ table, count: count || 0 });
        console.log(`  ✅ ${table}: Found (${count || 0} rows)`);
      }
    } catch (err) {
      // Table doesn't exist
    }
  }

  // Method 4: Check storage buckets
  console.log('\nMethod 4: Checking storage buckets...');
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (!error && buckets) {
      console.log('Storage buckets:', buckets.map(b => b.name));
    }
  } catch (err) {
    console.log('Could not list storage buckets');
  }

  console.log('\n=== SUMMARY ===');
  console.log('Tables accessible with current credentials:');
  foundTables.forEach(t => {
    console.log(`  - ${t.table}: ${t.count} rows`);
  });

  return foundTables;
}

listAllTables();