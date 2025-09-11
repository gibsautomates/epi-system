const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getAllVendorsPaginated() {
  try {
    // Get date 21 days ago
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 21);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
    
    console.log('Fetching ALL vendors from:', cutoffDateStr);
    console.log('-----------------------------------');
    
    // First, get total count
    const { count } = await supabase
      .from('vendor_offers')
      .select('*', { count: 'exact', head: true })
      .gte('date', cutoffDateStr);
      
    console.log('Total records to fetch:', count);
    
    // Fetch in batches
    const batchSize = 10000;
    let offset = 0;
    const vendorCounts = {};
    const vendorLocations = {};
    let totalFetched = 0;
    
    while (offset < count) {
      console.log(`Fetching batch: ${offset} to ${offset + batchSize}...`);
      
      const { data: batch, error } = await supabase
        .from('vendor_offers')
        .select('vendor, location')
        .gte('date', cutoffDateStr)
        .range(offset, offset + batchSize - 1);
        
      if (error) {
        console.error('Error fetching batch:', error);
        break;
      }
      
      batch?.forEach(offer => {
        const vendor = offer.vendor;
        vendorCounts[vendor] = (vendorCounts[vendor] || 0) + 1;
        
        if (!vendorLocations[vendor] && offer.location) {
          vendorLocations[vendor] = offer.location;
        }
      });
      
      totalFetched += batch?.length || 0;
      offset += batchSize;
    }
    
    console.log('\nTotal records fetched:', totalFetched);
    
    const uniqueVendors = Object.keys(vendorCounts);
    console.log('Total unique vendors found:', uniqueVendors.length);
    
    console.log('\nAll vendors with record counts:');
    uniqueVendors.sort().forEach(vendor => {
      console.log(`  - ${vendor}: ${vendorCounts[vendor]} records (${vendorLocations[vendor] || 'No location'})`);
    });
    
    // Check domestic vs international
    const domesticVendors = uniqueVendors.filter(v => vendorLocations[v] === 'Domestic');
    const internationalVendors = uniqueVendors.filter(v => vendorLocations[v] === 'International');
    const noLocationVendors = uniqueVendors.filter(v => !vendorLocations[v]);
    
    console.log('\nVendor location breakdown:');
    console.log('- Domestic vendors:', domesticVendors.length);
    if (domesticVendors.length > 0) {
      console.log('  ', domesticVendors.slice(0, 10).join(', '), domesticVendors.length > 10 ? '...' : '');
    }
    console.log('- International vendors:', internationalVendors.length);
    if (internationalVendors.length > 0) {
      console.log('  ', internationalVendors.slice(0, 10).join(', '), internationalVendors.length > 10 ? '...' : '');
    }
    console.log('- No location data:', noLocationVendors.length);
    if (noLocationVendors.length > 0) {
      console.log('  ', noLocationVendors.slice(0, 10).join(', '), noLocationVendors.length > 10 ? '...' : '');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit();
}

getAllVendorsPaginated();