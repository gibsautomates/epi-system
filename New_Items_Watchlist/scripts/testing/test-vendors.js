const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkVendors() {
  try {
    // Get date 21 days ago
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 21);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
    
    console.log('Checking vendors from:', cutoffDateStr);
    
    // 1. Check vendor_offers table
    const { data: offers, error: offersError } = await supabase
      .from('vendor_offers')
      .select('vendor, location')
      .gte('date', cutoffDateStr)
      .limit(100);
      
    if (offersError) {
      console.error('Error fetching vendor_offers:', offersError);
    } else {
      const uniqueVendors = new Set(offers?.map(o => o.vendor));
      console.log('\nVendor Offers Table:');
      console.log('- Total records (sample):', offers?.length);
      console.log('- Unique vendors in sample:', uniqueVendors.size);
      console.log('- Sample vendors:', Array.from(uniqueVendors).slice(0, 10));
      
      // Check location data
      const withLocation = offers?.filter(o => o.location).length;
      console.log('- Records with location:', withLocation);
      console.log('- Sample locations:', offers?.slice(0, 5).map(o => ({ vendor: o.vendor, location: o.location })));
    }
    
    // 2. Check vendors_expected table
    const { data: vendorsExpected, error: vendorsError } = await supabase
      .from('vendors_expected')
      .select('vendor, location')
      .limit(50);
      
    if (vendorsError) {
      console.error('Error fetching vendors_expected:', vendorsError);
    } else {
      console.log('\nVendors Expected Table:');
      console.log('- Total vendors (sample):', vendorsExpected?.length);
      console.log('- Sample vendors:', vendorsExpected?.slice(0, 5).map(v => ({ vendor: v.vendor, location: v.location })));
      
      // Check location distribution
      const domestic = vendorsExpected?.filter(v => v.location === 'Domestic').length;
      const international = vendorsExpected?.filter(v => v.location === 'International').length;
      console.log('- Domestic vendors:', domestic);
      console.log('- International vendors:', international);
    }
    
    // 3. Check distinct vendors in vendor_offers
    const { data: distinctVendors, error: distinctError } = await supabase
      .from('vendor_offers')
      .select('vendor')
      .gte('date', cutoffDateStr);
      
    if (!distinctError && distinctVendors) {
      const uniqueVendorSet = new Set(distinctVendors.map(v => v.vendor));
      console.log('\nTotal unique vendors in last 21 days:', uniqueVendorSet.size);
      console.log('All vendors:', Array.from(uniqueVendorSet).sort());
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit();
}

checkVendors();