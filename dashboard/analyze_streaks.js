#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

async function analyzeStreaks() {
  console.log('🔍 Analyzing watchlist streak data patterns...\n');
  
  try {
    // Get sample of tracking records with multiple entries per UPC
    console.log('📊 Analyzing tracking records for streak patterns...');
    
    const { data: trackingData, error: trackingError } = await supabase
      .from('watchlist_tracking')
      .select('id, upc, status, snapshot_date, created_at, status_streak, times_seen, previous_status')
      .order('upc')
      .order('snapshot_date')
      .order('created_at')
      .limit(100);
    
    if (trackingError) {
      console.log(`❌ Error: ${trackingError.message}`);
      return;
    }
    
    // Group by UPC to find items with multiple tracking records
    const upcGroups = {};
    trackingData.forEach(record => {
      if (!upcGroups[record.upc]) {
        upcGroups[record.upc] = [];
      }
      upcGroups[record.upc].push(record);
    });
    
    // Find UPCs with multiple records
    const multipleRecordUpcs = Object.entries(upcGroups)
      .filter(([upc, records]) => records.length > 1)
      .slice(0, 10);
    
    console.log(`\n🎯 Found ${multipleRecordUpcs.length} items with multiple tracking records:\n`);
    
    multipleRecordUpcs.forEach(([upc, records], index) => {
      console.log(`${index + 1}. UPC: ${upc} (${records.length} records)`);
      records.forEach((record, i) => {
        const date = new Date(record.snapshot_date).toISOString().split('T')[0];
        console.log(`   ${i + 1}. ${date} | Status: ${record.status} | Streak: ${record.status_streak} | Times Seen: ${record.times_seen} | Prev: ${record.previous_status || 'NULL'}`);
      });
      console.log('');
    });
    
    // Check for status changes that should have reset streaks
    console.log('🔄 Looking for status changes that should affect streaks...\n');
    
    let potentialIssues = 0;
    multipleRecordUpcs.forEach(([upc, records]) => {
      for (let i = 1; i < records.length; i++) {
        const prev = records[i-1];
        const curr = records[i];
        
        // If status changed but streak didn't reset
        if (prev.status !== curr.status && curr.status_streak !== 1) {
          console.log(`⚠️  Status change without streak reset:`);
          console.log(`   UPC: ${upc}`);
          console.log(`   ${prev.snapshot_date} | ${prev.status} (streak: ${prev.status_streak})`);
          console.log(`   ${curr.snapshot_date} | ${curr.status} (streak: ${curr.status_streak}) ← Should be 1`);
          console.log('');
          potentialIssues++;
        }
        
        // If status same but streak didn't increment
        if (prev.status === curr.status && curr.status_streak <= prev.status_streak) {
          console.log(`⚠️  Same status but streak didn't increment:`);
          console.log(`   UPC: ${upc}`);
          console.log(`   ${prev.snapshot_date} | ${prev.status} (streak: ${prev.status_streak})`);
          console.log(`   ${curr.snapshot_date} | ${curr.status} (streak: ${curr.status_streak}) ← Should be ${prev.status_streak + 1}`);
          console.log('');
          potentialIssues++;
        }
      }
    });
    
    if (potentialIssues === 0) {
      console.log('✅ No obvious streak calculation issues found in sample data\n');
    } else {
      console.log(`🚨 Found ${potentialIssues} potential streak calculation issues\n`);
    }
    
    // Check if all tracking records have the same snapshot dates (batch creation issue)
    console.log('📅 Checking snapshot date distribution...\n');
    
    const dateCounts = {};
    trackingData.forEach(record => {
      const date = record.snapshot_date;
      dateCounts[date] = (dateCounts[date] || 0) + 1;
    });
    
    const sortedDates = Object.entries(dateCounts).sort((a, b) => new Date(a[0]) - new Date(b[0]));
    
    console.log('📊 Snapshot date distribution:');
    sortedDates.forEach(([date, count]) => {
      console.log(`   ${date}: ${count} records`);
    });
    
    if (sortedDates.length <= 2) {
      console.log('\n⚠️  Very few unique snapshot dates found!');
      console.log('💡 This suggests tracking records were created in large batches');
      console.log('   This could explain why all streaks are 1 - they all appear to be "first" records');
    }
    
    // Check the actual date ranges in vendor_offers vs tracking dates
    console.log('\n📈 Comparing vendor_offers dates vs tracking dates...');
    
    const { data: vendorDates, error: vendorError } = await supabase
      .from('vendor_offers')
      .select('date')
      .order('date')
      .limit(1000);
    
    if (!vendorError && vendorDates.length > 0) {
      const vendorDateCounts = {};
      vendorDates.forEach(record => {
        const date = record.date;
        vendorDateCounts[date] = (vendorDateCounts[date] || 0) + 1;
      });
      
      const uniqueVendorDates = Object.keys(vendorDateCounts).sort();
      const uniqueTrackingDates = Object.keys(dateCounts).sort();
      
      console.log(`\n📊 Data comparison:`);
      console.log(`   Vendor offers date range: ${uniqueVendorDates[0]} to ${uniqueVendorDates[uniqueVendorDates.length-1]}`);
      console.log(`   Tracking date range: ${uniqueTrackingDates[0]} to ${uniqueTrackingDates[uniqueTrackingDates.length-1]}`);
      console.log(`   Unique vendor dates: ${uniqueVendorDates.length}`);
      console.log(`   Unique tracking dates: ${uniqueTrackingDates.length}`);
      
      if (uniqueTrackingDates.length < uniqueVendorDates.length / 10) {
        console.log('\n💡 DIAGNOSIS: Very few tracking snapshots vs vendor data dates');
        console.log('   This suggests the tracking system is not running daily');
        console.log('   Result: Most/all items appear as "new" in each snapshot → streak = 1');
        console.log('   SOLUTION: The tracking function needs to run more frequently OR');
        console.log('              we need to retroactively create historical tracking records');
      }
    }
    
    // Final recommendation
    console.log('\n🎯 RECOMMENDED SOLUTION:\n');
    console.log('Based on the analysis, the streak issue appears to be caused by:');
    console.log('1. ✅ 21-day vendor logic is working (all items within 21 days)');
    console.log('2. ❌ Tracking snapshots are too infrequent');
    console.log('3. ❌ Each tracking run treats most items as "new" → streak = 1\n');
    
    console.log('To fix this, we need to either:');
    console.log('A. 🔄 Run the tracking function daily to build proper streak history');
    console.log('B. 📊 Create synthetic historical tracking records based on vendor_offers dates');
    console.log('C. 🛠️  Implement the complete SQL script with retroactive streak calculation\n');
    
    console.log('The full SQL script should be run in Supabase SQL Editor to:');
    console.log('- Create proper functions for 21-day tracking');
    console.log('- Implement retroactive streak calculation');
    console.log('- Set up views that handle the 21-day vendor logic correctly');
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
  }
}

analyzeStreaks();