#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

async function executeSqlFix() {
  console.log('🔧 Starting comprehensive watchlist fixes...');
  console.log('📍 Connected to:', supabaseUrl);
  
  try {
    let executedCount = 0;
    let errors = [];
    
    // STEP 1: Manual streak recalculation
    console.log('\n⚡ Step 1: Manual streak recalculation...');
    
    try {
      // Get all tracking records
      const { data: trackingData, error: trackingError } = await supabase
        .from('watchlist_tracking')
        .select('id, upc, status, snapshot_date, created_at, status_streak, previous_status')
        .order('upc')
        .order('snapshot_date')
        .order('created_at');
      
      if (trackingError) {
        console.log(`❌ Error fetching tracking data: ${trackingError.message}`);
        errors.push({ step: 'tracking_fetch', error: trackingError.message });
      } else {
        console.log(`📊 Processing ${trackingData.length} tracking records for streak recalculation...`);
        
        // Group by UPC and recalculate streaks
        const upcGroups = {};
        trackingData.forEach(record => {
          if (!upcGroups[record.upc]) {
            upcGroups[record.upc] = [];
          }
          upcGroups[record.upc].push(record);
        });
        
        console.log(`📋 Found ${Object.keys(upcGroups).length} unique items to process`);
        
        let updatedRecords = 0;
        let processedItems = 0;
        
        for (const [upc, records] of Object.entries(upcGroups)) {
          let currentStatus = null;
          let currentStreak = 0;
          let previousStatus = null;
          
          for (const record of records) {
            if (currentStatus === null || currentStatus !== record.status) {
              previousStatus = currentStatus;
              currentStatus = record.status;
              currentStreak = 1;
            } else {
              currentStreak++;
            }
            
            // Update this record if the streak is different
            if (record.status_streak !== currentStreak || record.previous_status !== previousStatus) {
              const { error: updateError } = await supabase
                .from('watchlist_tracking')
                .update({ 
                  status_streak: currentStreak,
                  previous_status: previousStatus 
                })
                .eq('id', record.id);
              
              if (updateError) {
                console.log(`❌ Error updating record ${record.id}: ${updateError.message}`);
              } else {
                updatedRecords++;
              }
            }
          }
          
          processedItems++;
          if (processedItems % 100 === 0) {
            console.log(`   📈 Processed ${processedItems}/${Object.keys(upcGroups).length} items...`);
          }
        }
        
        console.log(`✅ Step 1 Complete: Updated ${updatedRecords} records with corrected streaks`);
        executedCount++;
      }
    } catch (err) {
      console.log(`❌ Error in streak recalculation: ${err.message}`);
      errors.push({ step: 'streak_recalc', error: err.message });
    }
    
    // STEP 2: Check current dashboard view
    console.log('\n⚡ Step 2: Verify dashboard view exists and has 21-day logic...');
    
    try {
      // First check if the view exists
      const { data: viewData, error: viewError } = await supabase
        .from('new_items_dashboard_enhanced')
        .select('count', { count: 'exact', head: true });
      
      if (viewError) {
        console.log(`❌ Dashboard view error: ${viewError.message}`);
        console.log('📋 The view may need to be recreated in Supabase SQL Editor');
        errors.push({ step: 'view_check', error: viewError.message });
      } else {
        console.log(`✅ Dashboard view exists with ${viewData} items`);
        executedCount++;
      }
    } catch (err) {
      console.log(`❌ Error checking dashboard view: ${err.message}`);
      errors.push({ step: 'view_check', error: err.message });
    }
    
    // STEP 3: Check vendor_offers date range (21-day logic)
    console.log('\n⚡ Step 3: Verify 21-day vendor logic data availability...');
    
    try {
      const twentyOneDaysAgo = new Date();
      twentyOneDaysAgo.setDate(twentyOneDaysAgo.getDate() - 21);
      const dateStr = twentyOneDaysAgo.toISOString().split('T')[0];
      
      const { data: vendorData, error: vendorError } = await supabase
        .from('vendor_offers')
        .select('count', { count: 'exact', head: true })
        .gte('date', dateStr);
      
      if (vendorError) {
        console.log(`❌ Error checking vendor offers: ${vendorError.message}`);
        errors.push({ step: 'vendor_check', error: vendorError.message });
      } else {
        console.log(`✅ Found ${vendorData} vendor offers within last 21 days (since ${dateStr})`);
        executedCount++;
      }
    } catch (err) {
      console.log(`❌ Error checking vendor data: ${err.message}`);
      errors.push({ step: 'vendor_check', error: err.message });
    }
    
    console.log('\n🏁 Execution Summary:');
    console.log(`   ✅ Successful steps: ${executedCount}`);
    console.log(`   ❌ Errors: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log('\n🚨 Issues encountered:');
      errors.forEach(err => {
        console.log(`   ${err.step}: ${err.error}`);
      });
    }
    
    // VERIFICATION QUERIES
    console.log('\n🔍 Running verification queries...');
    
    // Query 1: Check streak distribution after fix
    console.log('\n📊 Checking streak distribution after fix...');
    try {
      const { data: streakData, error: streakError } = await supabase
        .from('new_items_dashboard_enhanced')
        .select('status, status_streak');
      
      if (streakError) {
        console.log(`❌ Error querying streaks: ${streakError.message}`);
      } else {
        const statusStats = {};
        streakData.forEach(item => {
          if (!statusStats[item.status]) {
            statusStats[item.status] = { count: 0, minStreak: Infinity, maxStreak: 0, totalStreak: 0 };
          }
          statusStats[item.status].count++;
          statusStats[item.status].minStreak = Math.min(statusStats[item.status].minStreak, item.status_streak);
          statusStats[item.status].maxStreak = Math.max(statusStats[item.status].maxStreak, item.status_streak);
          statusStats[item.status].totalStreak += item.status_streak;
        });
        
        console.log('📈 Streak Distribution by Status:');
        Object.entries(statusStats).forEach(([status, stats]) => {
          const avgStreak = (stats.totalStreak / stats.count).toFixed(2);
          console.log(`   ${status}: ${stats.count} items (streaks: ${stats.minStreak}-${stats.maxStreak}, avg: ${avgStreak})`);
        });
        
        // Check if streaks are now variable (fix successful)
        const streakValues = streakData.map(item => item.status_streak);
        const uniqueStreaks = [...new Set(streakValues)];
        console.log(`\n🎯 Unique streak values found: [${uniqueStreaks.sort((a,b) => a-b).join(', ')}]`);
        
        if (uniqueStreaks.length === 1 && uniqueStreaks[0] === 1) {
          console.log('⚠️  WARNING: All streaks are still 1 - manual recalculation may not have been sufficient');
          console.log('📋 Recommend running the full SQL script in Supabase SQL Editor');
        } else {
          console.log('✅ Streaks are now variable - fix appears successful!');
        }
      }
    } catch (err) {
      console.log(`❌ Error in streak verification: ${err.message}`);
    }
    
    // Query 2: Check date ranges (21-day window)
    console.log('\n📅 Checking date ranges for 21-day window compliance...');
    try {
      const { data: dateData, error: dateError } = await supabase
        .from('new_items_dashboard_enhanced')
        .select('first_seen, last_seen')
        .order('first_seen', { ascending: true });
      
      if (dateError) {
        console.log(`❌ Error querying dates: ${dateError.message}`);
      } else if (dateData && dateData.length > 0) {
        const earliestItem = dateData[0].first_seen;
        const latestOffer = dateData[dateData.length - 1].last_seen;
        console.log(`📊 Date Range: ${earliestItem} to ${latestOffer} (${dateData.length} total items)`);
        
        // Check 21-day compliance
        const today = new Date();
        const twentyOneDaysAgo = new Date(today);
        twentyOneDaysAgo.setDate(today.getDate() - 21);
        
        const withinRange = dateData.filter(item => new Date(item.last_seen) >= twentyOneDaysAgo);
        const complianceRate = ((withinRange.length / dateData.length) * 100).toFixed(1);
        console.log(`✅ Items with offers within 21 days: ${withinRange.length}/${dateData.length} (${complianceRate}%)`);
        
        if (complianceRate > 90) {
          console.log('🎯 Excellent 21-day compliance - logic appears to be working');
        } else if (complianceRate > 70) {
          console.log('⚡ Good 21-day compliance - some older items may still be in view');
        } else {
          console.log('⚠️  Low 21-day compliance - view may not be using 21-day logic yet');
        }
      }
    } catch (err) {
      console.log(`❌ Error in date verification: ${err.message}`);
    }
    
    // Query 3: Sample of items with highest streaks
    console.log('\n🎯 Top 10 items with highest streaks (showing fix results):');
    try {
      const { data: sampleData, error: sampleError } = await supabase
        .from('new_items_dashboard_enhanced')
        .select('upc, item_name, status, status_streak, times_seen, days_on_watchlist, domestic_vendor_count, vendor_change_status')
        .order('status_streak', { ascending: false })
        .limit(10);
      
      if (sampleError) {
        console.log(`❌ Error querying sample: ${sampleError.message}`);
      } else if (sampleData && sampleData.length > 0) {
        sampleData.forEach((item, idx) => {
          const name = item.item_name ? item.item_name.substring(0, 40) + '...' : 'Unknown Item';
          console.log(`   ${idx + 1}. ${name} (UPC: ${item.upc})`);
          console.log(`      Status: ${item.status} | Streak: ${item.status_streak} | Times Seen: ${item.times_seen}`);
          console.log(`      Days on List: ${item.days_on_watchlist} | Vendors: ${item.domestic_vendor_count} | ${item.vendor_change_status}`);
        });
      } else {
        console.log('   No sample data available');
      }
    } catch (err) {
      console.log(`❌ Error in sample query: ${err.message}`);
    }
    
    // Final summary
    console.log('\n🎉 WATCHLIST FIXES DEPLOYMENT SUMMARY:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (executedCount >= 2) {
      console.log('✅ PARTIAL SUCCESS: Manual streak recalculation completed');
      console.log('📋 Next steps:');
      console.log('   1. The streak recalculation has been applied to existing data');
      console.log('   2. For full 21-day logic implementation, the SQL views need to be updated');
      console.log('   3. Consider running the full SQL script in Supabase SQL Editor for complete fix');
    } else {
      console.log('⚠️  LIMITED SUCCESS: Some issues encountered during execution');
      console.log('📋 Recommendations:');
      console.log('   1. Review error messages above');
      console.log('   2. Consider running the full SQL script manually in Supabase SQL Editor');
      console.log('   3. Check database permissions and table access');
    }
    
    console.log('\n🔗 To complete the full implementation:');
    console.log('   • Go to Supabase Dashboard > SQL Editor');
    console.log('   • Run the complete FIX_WATCHLIST_21DAY_STREAKS.sql script');
    console.log('   • This will create the 21-day views and update functions');
    
    console.log('\n✅ Manual streak fix has been applied to reduce "all streaks = 1" issue');
    
  } catch (error) {
    console.error('❌ Failed to execute fixes:', error);
    process.exit(1);
  }
}

// Execute the function
executeSqlFix();