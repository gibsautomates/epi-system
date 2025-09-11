const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkUPC() {
  const testUPC = '3423470300161';
  
  console.log('Checking UPC:', testUPC);
  console.log('-----------------------------------');
  
  // Check in current_inventory
  const { data: invData1, error: err1 } = await supabase
    .from('current_inventory')
    .select('*')
    .eq('upc', testUPC);
    
  console.log('current_inventory with upc =', testUPC);
  console.log('Found:', invData1?.length || 0, 'records');
  if (invData1?.length > 0) {
    console.log('Sample:', invData1[0]);
  }
  
  // Check with UPC field
  const { data: invData2, error: err2 } = await supabase
    .from('current_inventory')
    .select('*')
    .eq('UPC', testUPC);
    
  console.log('\ncurrent_inventory with UPC =', testUPC);
  console.log('Found:', invData2?.length || 0, 'records');
  if (invData2?.length > 0) {
    console.log('Sample:', invData2[0]);
  }
  
  // Check with upc_text field
  const { data: invData3, error: err3 } = await supabase
    .from('current_inventory')
    .select('*')
    .eq('upc_text', testUPC);
    
  console.log('\ncurrent_inventory with upc_text =', testUPC);
  console.log('Found:', invData3?.length || 0, 'records');
  if (invData3?.length > 0) {
    console.log('Sample:', invData3[0]);
  }
  
  // Get column names
  const { data: sample } = await supabase
    .from('current_inventory')
    .select('*')
    .limit(1);
    
  if (sample && sample.length > 0) {
    console.log('\nAvailable columns in current_inventory:');
    console.log(Object.keys(sample[0]));
  }
  
  process.exit();
}

checkUPC();