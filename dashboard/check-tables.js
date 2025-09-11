const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://oozneazuydjsjvlswpqu.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vem5lYXp1eWRqc2p2bHN3cHF1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTUyNzYyNiwiZXhwIjoyMDYxMTAzNjI2fQ.gGoQitV8MTagu5bCX9czsdlE-2HhgEB4xYwZbpRuaVw'
);

async function checkTables() {
  console.log('Checking available tables and views...');
  
  // Try to access vendor_offers table
  console.log('Checking vendor_offers table...');
  const { data: vendorOffers, error: vendorError } = await supabase
    .from('vendor_offers')
    .select('*')
    .limit(1);
    
  if (vendorError) {
    console.log('vendor_offers error:', vendorError);
  } else {
    console.log('vendor_offers works:', vendorOffers?.length, 'rows found');
  }
  
  // Try other possible table names
  const tables = ['new_items', 'enhanced_new_items', 'watchlist', 'items'];
  
  for (const tableName of tables) {
    console.log(`\nChecking ${tableName}...`);
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);
      
    if (error) {
      console.log(`${tableName} error:`, error.message);
    } else {
      console.log(`${tableName} works:`, data?.length, 'rows found');
    }
  }

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Available tables/views:');
    data.forEach(table => console.log('-', table.table_name));
  }
}

checkTables();