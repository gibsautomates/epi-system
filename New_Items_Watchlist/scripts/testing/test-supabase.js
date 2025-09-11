const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testConnection() {
  try {
    console.log('Testing Supabase connection...');
    console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
    
    const { data: tables, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');
    
    if (error) {
      const { data: fallbackTables, error: fallbackError } = await supabase
        .rpc('get_tables', {});
        
      if (fallbackError) {
        const { data: anyTable, error: anyError } = await supabase
          .from('items')
          .select('*')
          .limit(1);
          
        if (anyError) {
          console.log('Could not query tables directly. Error:', anyError.message);
          console.log('\nAttempting to list known tables from API routes...');
          
          const fs = require('fs');
          const path = require('path');
          const apiPath = path.join(__dirname, 'app', 'api', 'items', 'route.ts');
          
          if (fs.existsSync(apiPath)) {
            const content = fs.readFileSync(apiPath, 'utf-8');
            const tableMatches = content.match(/from\(['"](\w+)['"]\)/g);
            if (tableMatches) {
              console.log('\nTables referenced in code:');
              const uniqueTables = [...new Set(tableMatches.map(m => m.match(/from\(['"](\w+)['"]\)/)[1]))];
              uniqueTables.forEach(table => console.log(`  - ${table}`));
              
              console.log('\nTesting access to each table:');
              for (const table of uniqueTables) {
                const { data, error, count } = await supabase
                  .from(table)
                  .select('*', { count: 'exact', head: true });
                  
                if (error) {
                  console.log(`  ❌ ${table}: ${error.message}`);
                } else {
                  console.log(`  ✅ ${table}: Accessible (${count || 0} rows)`);
                }
              }
            }
          }
        } else {
          console.log('✅ Successfully connected to Supabase!');
          console.log('Found "items" table with data:', anyTable);
        }
      } else {
        console.log('✅ Successfully connected to Supabase!');
        console.log('Tables found via RPC:', fallbackTables);
      }
    } else {
      console.log('✅ Successfully connected to Supabase!');
      console.log('Available public tables:');
      tables.forEach(t => console.log(`  - ${t.table_name}`));
    }
    
  } catch (err) {
    console.error('Connection error:', err.message);
  }
}

testConnection();