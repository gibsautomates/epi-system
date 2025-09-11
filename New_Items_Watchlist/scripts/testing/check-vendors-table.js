// Check the structure of vendors_expected table
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkVendorsTable() {
  console.log('Checking vendors_expected table structure...\n');
  
  // Try to get one row to see the columns
  const { data, error } = await supabase
    .from('vendors_expected')
    .select('*')
    .limit(1);
  
  if (error) {
    console.log('Error:', error.message);
    return;
  }
  
  if (data && data.length > 0) {
    console.log('Table columns:', Object.keys(data[0]));
    console.log('Sample row:', data[0]);
  } else {
    console.log('Table is empty, trying to insert a test row to see structure...');
    
    // Try inserting with just vendor
    const { data: insertData, error: insertError } = await supabase
      .from('vendors_expected')
      .insert({ vendor: 'TEST_VENDOR' })
      .select();
    
    if (insertError) {
      console.log('Insert error (this helps us understand the schema):', insertError);
    } else {
      console.log('Successfully inserted. Columns:', insertData ? Object.keys(insertData[0]) : 'unknown');
      
      // Clean up
      await supabase
        .from('vendors_expected')
        .delete()
        .eq('vendor', 'TEST_VENDOR');
    }
  }
}

checkVendorsTable();