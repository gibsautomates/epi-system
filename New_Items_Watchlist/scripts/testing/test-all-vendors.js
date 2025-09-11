const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAllVendors() {
  try {
    // Get date 21 days ago
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 21);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
    
    console.log('Checking ALL vendors from:', cutoffDateStr);
    console.log('-----------------------------------');
    
    // Get ALL vendor offers without limit
    const { data: allOffers, error: offersError, count } = await supabase
      .from('vendor_offers')
      .select('vendor, location, date', { count: 'exact' })
      .gte('date', cutoffDateStr);
      
    if (offersError) {
      console.error('Error fetching vendor_offers:', offersError);
      return;
    }
    
    console.log('Total records in last 21 days:', count);
    
    // Count unique vendors
    const vendorCounts = {};
    const vendorLocations = {};
    
    allOffers?.forEach(offer => {
      const vendor = offer.vendor;
      vendorCounts[vendor] = (vendorCounts[vendor] || 0) + 1;
      
      if (!vendorLocations[vendor] && offer.location) {
        vendorLocations[vendor] = offer.location;
      }
    });
    
    const uniqueVendors = Object.keys(vendorCounts);
    console.log('\nTotal unique vendors:', uniqueVendors.length);
    console.log('\nAll vendors with counts:');
    uniqueVendors.sort().forEach(vendor => {
      console.log(`  - ${vendor}: ${vendorCounts[vendor]} records (${vendorLocations[vendor] || 'No location'})`);
    });
    
    // Check domestic vs international
    const domesticVendors = uniqueVendors.filter(v => vendorLocations[v] === 'Domestic');
    const internationalVendors = uniqueVendors.filter(v => vendorLocations[v] === 'International');
    
    console.log('\nVendor breakdown:');
    console.log('- Domestic vendors:', domesticVendors.length, domesticVendors);
    console.log('- International vendors:', internationalVendors.length, internationalVendors);
    console.log('- No location data:', uniqueVendors.filter(v => !vendorLocations[v]).length);
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit();
}

checkAllVendors();