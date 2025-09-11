const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkLocationIssue() {
  try {
    // Get date 21 days ago
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 21);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
    
    console.log('Checking location data from:', cutoffDateStr);
    console.log('-----------------------------------');
    
    // Get a sample of vendor offers to check location field
    const { data: sample, error } = await supabase
      .from('vendor_offers')
      .select('vendor, location')
      .gte('date', cutoffDateStr)
      .limit(10000);
      
    if (error) {
      console.error('Error:', error);
      return;
    }
    
    // Count locations
    const locationCounts = {
      'Domestic': 0,
      'International': 0,
      'null': 0,
      'undefined': 0,
      'empty': 0,
      'other': []
    };
    
    sample.forEach(item => {
      if (item.location === 'Domestic') {
        locationCounts['Domestic']++;
      } else if (item.location === 'International') {
        locationCounts['International']++;
      } else if (item.location === null) {
        locationCounts['null']++;
      } else if (item.location === undefined) {
        locationCounts['undefined']++;
      } else if (item.location === '') {
        locationCounts['empty']++;
      } else {
        if (!locationCounts['other'].includes(item.location)) {
          locationCounts['other'].push(item.location);
        }
      }
    });
    
    console.log('Location distribution in sample of', sample.length, 'records:');
    console.log('- Domestic:', locationCounts['Domestic']);
    console.log('- International:', locationCounts['International']);
    console.log('- Null:', locationCounts['null']);
    console.log('- Undefined:', locationCounts['undefined']);
    console.log('- Empty string:', locationCounts['empty']);
    if (locationCounts['other'].length > 0) {
      console.log('- Other values:', locationCounts['other']);
    }
    
    // Check unique vendors with their locations
    const vendorLocations = {};
    sample.forEach(item => {
      if (!vendorLocations[item.vendor]) {
        vendorLocations[item.vendor] = item.location;
      }
    });
    
    console.log('\nUnique vendors and their locations:');
    Object.entries(vendorLocations).forEach(([vendor, location]) => {
      console.log(`- ${vendor}: ${location || 'NO LOCATION'}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit();
}

checkLocationIssue();