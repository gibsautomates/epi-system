const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkInventory() {
  try {
    console.log('Checking current_inventory table...\n');
    
    // Try to fetch from current_inventory
    const { data: inventory, error: inventoryError, count } = await supabase
      .from('current_inventory')
      .select('*', { count: 'exact', head: true });
      
    if (inventoryError) {
      console.error('Error accessing current_inventory:', inventoryError.message);
      console.log('\nTrying sc_inventory table instead...');
      
      // Try sc_inventory
      const { data: scInventory, error: scError, count: scCount } = await supabase
        .from('sc_inventory')
        .select('*', { count: 'exact', head: true });
        
      if (scError) {
        console.error('Error accessing sc_inventory:', scError.message);
      } else {
        console.log('sc_inventory table has', scCount, 'records');
      }
    } else {
      console.log('current_inventory table has', count, 'records');
      
      if (count === 0) {
        console.log('WARNING: current_inventory is empty!');
        console.log('This means ALL items will be considered "new"');
      }
    }
    
    // Count vendor_offers
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 21);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
    
    const { count: offerCount } = await supabase
      .from('vendor_offers')
      .select('*', { count: 'exact', head: true })
      .gte('date', cutoffDateStr);
      
    console.log('\nvendor_offers in last 21 days:', offerCount, 'records');
    
    // Get unique UPCs from vendor_offers
    const { data: sampleOffers } = await supabase
      .from('vendor_offers')
      .select('upc')
      .gte('date', cutoffDateStr)
      .limit(1000);
      
    const uniqueUpcs = new Set(sampleOffers?.map(o => o.upc));
    console.log('Sample unique UPCs in vendor_offers:', uniqueUpcs.size);
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit();
}

checkInventory();