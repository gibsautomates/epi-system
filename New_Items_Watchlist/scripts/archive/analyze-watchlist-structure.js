const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function analyzeWatchlistStructure() {
  console.log('Analyzing watchlist_items table structure...\n');
  
  try {
    // Get sample data to understand structure
    const { data: sampleData, error: sampleError } = await supabase
      .from('watchlist_items')
      .select('*')
      .limit(5);
    
    if (sampleError) {
      console.log('Error fetching sample data:', sampleError);
      return;
    }
    
    console.log('Sample data from watchlist_items:');
    console.log(JSON.stringify(sampleData, null, 2));
    
    if (sampleData && sampleData.length > 0) {
      console.log('\nColumns found in watchlist_items:');
      Object.keys(sampleData[0]).forEach(key => {
        const sampleValue = sampleData[0][key];
        const type = sampleValue === null ? 'null' : typeof sampleValue;
        console.log(`  - ${key}: ${type} (example: ${JSON.stringify(sampleValue)?.substring(0, 50)})`);
      });
    }
    
    // Check vendor_offers structure too
    console.log('\n\nAnalyzing vendor_offers table structure...');
    const { data: vendorSample, error: vendorError } = await supabase
      .from('vendor_offers')
      .select('*')
      .limit(3);
    
    if (!vendorError && vendorSample && vendorSample.length > 0) {
      console.log('\nColumns found in vendor_offers:');
      Object.keys(vendorSample[0]).forEach(key => {
        const sampleValue = vendorSample[0][key];
        const type = sampleValue === null ? 'null' : typeof sampleValue;
        console.log(`  - ${key}: ${type} (example: ${JSON.stringify(sampleValue)?.substring(0, 50)})`);
      });
      
      console.log('\nSample vendor_offers data:');
      console.log(JSON.stringify(vendorSample.slice(0, 2), null, 2));
    }
    
    // Check current_inventory structure
    console.log('\n\nAnalyzing current_inventory table structure...');
    const { data: inventorySample, error: inventoryError } = await supabase
      .from('current_inventory')
      .select('*')
      .limit(3);
    
    if (!inventoryError && inventorySample && inventorySample.length > 0) {
      console.log('\nColumns found in current_inventory:');
      Object.keys(inventorySample[0]).forEach(key => {
        const sampleValue = inventorySample[0][key];
        const type = sampleValue === null ? 'null' : typeof sampleValue;
        console.log(`  - ${key}: ${type}`);
      });
    }
    
  } catch (err) {
    console.error('Error analyzing structure:', err);
  }
}

analyzeWatchlistStructure();