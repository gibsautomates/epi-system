const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkVendorDates() {
  try {
    // Get date 21 days ago
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 21);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
    
    console.log('Checking vendor file dates from:', cutoffDateStr);
    console.log('-----------------------------------\n');
    
    // Get distinct vendor-date combinations
    const { data: vendorDates, error } = await supabase
      .from('vendor_offers')
      .select('vendor, date')
      .gte('date', cutoffDateStr)
      .order('vendor', { ascending: true })
      .order('date', { ascending: false });
      
    if (error) {
      console.error('Error:', error);
      return;
    }
    
    // Group by vendor and find latest date
    const vendorLatestDates = {};
    const vendorAllDates = {};
    
    vendorDates?.forEach(row => {
      if (!vendorLatestDates[row.vendor] || row.date > vendorLatestDates[row.vendor]) {
        vendorLatestDates[row.vendor] = row.date;
      }
      
      if (!vendorAllDates[row.vendor]) {
        vendorAllDates[row.vendor] = new Set();
      }
      vendorAllDates[row.vendor].add(row.date);
    });
    
    console.log('VENDOR LATEST FILE DATES:');
    console.log('=========================');
    Object.entries(vendorLatestDates)
      .sort(([,a], [,b]) => b.localeCompare(a))
      .forEach(([vendor, date]) => {
        const allDates = Array.from(vendorAllDates[vendor]).sort().reverse();
        console.log(`\n${vendor}:`);
        console.log(`  Latest: ${date}`);
        console.log(`  All dates (${allDates.length}):`, allDates.slice(0, 5).join(', '), 
                    allDates.length > 5 ? '...' : '');
      });
    
    // Example: Check a specific vendor's data
    const testVendor = Object.keys(vendorLatestDates)[0];
    const latestDate = vendorLatestDates[testVendor];
    
    console.log(`\n\nEXAMPLE: ${testVendor} latest date is ${latestDate}`);
    
    // Count items on latest date
    const { count: latestCount } = await supabase
      .from('vendor_offers')
      .select('*', { count: 'exact', head: true })
      .eq('vendor', testVendor)
      .eq('date', latestDate);
      
    // Count items on previous dates
    const { count: olderCount } = await supabase
      .from('vendor_offers')
      .select('*', { count: 'exact', head: true })
      .eq('vendor', testVendor)
      .gte('date', cutoffDateStr)
      .neq('date', latestDate);
      
    console.log(`  Items in latest file (${latestDate}): ${latestCount}`);
    console.log(`  Items in older files: ${olderCount}`);
    console.log(`  >>> Currently showing ${latestCount + olderCount} items, but should only show ${latestCount}`);
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit();
}

checkVendorDates();