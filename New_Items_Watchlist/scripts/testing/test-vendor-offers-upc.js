const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkVendorOffersUPC() {
  const testUPC = '3423470300161';
  
  console.log('Checking vendor_offers for UPC:', testUPC);
  console.log('-----------------------------------');
  
  // Get date 21 days ago
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 21);
  const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
  
  // Get a sample from vendor_offers
  const { data: sample } = await supabase
    .from('vendor_offers')
    .select('*')
    .gte('date', cutoffDateStr)
    .limit(1);
    
  if (sample && sample.length > 0) {
    console.log('Available columns in vendor_offers:');
    console.log(Object.keys(sample[0]));
    console.log('\nSample record:');
    console.log(sample[0]);
  }
  
  // Check for our specific UPC
  const { data: withUPC } = await supabase
    .from('vendor_offers')
    .select('*')
    .gte('date', cutoffDateStr)
    .eq('upc', testUPC)
    .limit(5);
    
  console.log('\nvendor_offers with upc =', testUPC);
  console.log('Found:', withUPC?.length || 0, 'records');
  
  // Try with upc_text
  const { data: withUPCText } = await supabase
    .from('vendor_offers')
    .select('*')
    .gte('date', cutoffDateStr)
    .eq('upc_text', testUPC)
    .limit(5);
    
  console.log('\nvendor_offers with upc_text =', testUPC);
  console.log('Found:', withUPCText?.length || 0, 'records');
  
  // Check if UPCs are stored as numbers
  const { data: numericCheck } = await supabase
    .from('vendor_offers')
    .select('*')
    .gte('date', cutoffDateStr)
    .eq('upc', parseInt(testUPC))
    .limit(5);
    
  console.log('\nvendor_offers with upc = (numeric)', parseInt(testUPC));
  console.log('Found:', numericCheck?.length || 0, 'records');
  
  process.exit();
}

checkVendorOffersUPC();