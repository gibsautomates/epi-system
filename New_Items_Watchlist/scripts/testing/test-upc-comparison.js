const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testComparison() {
  const testUPC = '3423470300161';
  
  console.log('Testing UPC comparison logic');
  console.log('-----------------------------------');
  
  // Get from current_inventory
  const { data: inventory } = await supabase
    .from('current_inventory')
    .select('UPC, upc_text')
    .eq('UPC', testUPC);
    
  console.log('Inventory record:', inventory?.[0]);
  
  // Get from vendor_offers
  const { data: offers } = await supabase
    .from('vendor_offers')
    .select('upc, upc_text')
    .eq('upc', testUPC)
    .limit(1);
    
  console.log('Vendor offer record:', offers?.[0]);
  
  if (inventory?.[0] && offers?.[0]) {
    const invUPC = String(inventory[0].UPC || inventory[0].upc_text).trim();
    const offerUPC = String(offers[0].upc || offers[0].upc_text).trim();
    
    console.log('\nComparison:');
    console.log('Inventory UPC (processed):', invUPC, 'Type:', typeof invUPC);
    console.log('Offer UPC (processed):', offerUPC, 'Type:', typeof offerUPC);
    console.log('Are they equal?', invUPC === offerUPC);
    
    // Test Set membership
    const inventorySet = new Set([invUPC]);
    console.log('\nSet test:');
    console.log('inventorySet.has(offerUPC):', inventorySet.has(offerUPC));
  }
  
  // Now test with actual API logic - get ALL inventory
  console.log('\nTesting with full inventory set...');
  const { data: fullInventory } = await supabase
    .from('current_inventory')
    .select('UPC, upc_text');
    
  const inventorySet = new Set(
    fullInventory?.map(item => String(item.UPC || item.upc_text).trim()) || []
  );
  
  console.log('Total items in inventory:', inventorySet.size);
  console.log('inventorySet.has("3423470300161"):', inventorySet.has('3423470300161'));
  console.log('inventorySet.has(3423470300161):', inventorySet.has('3423470300161'));
  
  // Check a few samples
  const samples = Array.from(inventorySet).slice(0, 5);
  console.log('\nSample inventory UPCs:', samples);
  
  process.exit();
}

testComparison();