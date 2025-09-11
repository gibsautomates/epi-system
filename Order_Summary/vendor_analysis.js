const { createClient } = require('@supabase/supabase-js');

// Database credentials from .env.local
const supabaseUrl = 'https://oozneazuydjsjvlswpqu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vem5lYXp1eWRqc2p2bHN3cHF1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTUyNzYyNiwiZXhwIjoyMDYxMTAzNjI2fQ.gGoQitV8MTagu5bCX9czsdlE-2HhgEB4xYwZbpRuaVw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeVendorData() {
    console.log('=== VENDOR OFFERS 21-DAY ANALYSIS ===\n');
    
    try {
        // Calculate 21 days ago
        const twentyOneDaysAgo = new Date();
        twentyOneDaysAgo.setDate(twentyOneDaysAgo.getDate() - 21);
        const dateFilter = twentyOneDaysAgo.toISOString().split('T')[0];
        
        console.log(`Analyzing data from ${dateFilter} onwards...\n`);

        // 1. Get all vendors and their locations
        console.log('1. VENDOR ANALYSIS:');
        const { data: allVendors, error: vendorError } = await supabase
            .from('vendor_offers')
            .select('vendor, location')
            .gte('date', dateFilter);
            
        if (!vendorError && allVendors) {
            const vendorStats = {};
            allVendors.forEach(record => {
                if (!vendorStats[record.vendor]) {
                    vendorStats[record.vendor] = {
                        name: record.vendor,
                        location: record.location,
                        offerCount: 0,
                        uniqueItems: new Set()
                    };
                }
                vendorStats[record.vendor].offerCount++;
                if (record.upc) vendorStats[record.vendor].uniqueItems.add(record.upc);
            });
            
            // Convert to array and show stats
            const vendorArray = Object.values(vendorStats).map(v => ({
                vendor: v.name,
                location: v.location,
                totalOffers: v.offerCount,
                uniqueItems: v.uniqueItems.size
            })).sort((a, b) => b.totalOffers - a.totalOffers);
            
            console.table(vendorArray);
        }

        // 2. Sample UPC analysis for 21-day logic
        console.log('\n2. SAMPLE UPC ANALYSIS (First 5 UPCs with multiple vendors in last 21 days):');
        
        const { data: sampleData, error: sampleError } = await supabase
            .from('vendor_offers')
            .select('upc, vendor, price, qty, date, item_name, location')
            .gte('date', dateFilter)
            .order('upc')
            .limit(1000); // Get first 1000 to analyze
            
        if (!sampleError && sampleData) {
            // Group by UPC
            const upcGroups = {};
            sampleData.forEach(record => {
                if (!upcGroups[record.upc]) {
                    upcGroups[record.upc] = {
                        upc: record.upc,
                        item_name: record.item_name,
                        offers: []
                    };
                }
                upcGroups[record.upc].offers.push({
                    vendor: record.vendor,
                    price: record.price,
                    qty: record.qty,
                    date: record.date,
                    location: record.location
                });
            });
            
            // Find UPCs with multiple vendors
            const multiVendorUPCs = Object.values(upcGroups)
                .filter(group => {
                    const uniqueVendors = [...new Set(group.offers.map(o => o.vendor))];
                    return uniqueVendors.length > 1;
                })
                .slice(0, 5); // Take first 5
                
            multiVendorUPCs.forEach((group, index) => {
                console.log(`\n--- UPC ${index + 1}: ${group.upc} ---`);
                console.log(`Item: ${group.item_name}`);
                
                const uniqueVendors = [...new Set(group.offers.map(o => o.vendor))];
                console.log(`Vendors (${uniqueVendors.length}): ${uniqueVendors.join(', ')}`);
                
                // Show pricing analysis
                const prices = group.offers.filter(o => o.price).map(o => parseFloat(o.price));
                if (prices.length > 0) {
                    const minPrice = Math.min(...prices);
                    const maxPrice = Math.max(...prices);
                    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
                    
                    console.log(`Price Range: $${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)} (Avg: $${avgPrice.toFixed(2)})`);
                    
                    // Find lowest price vendor(s)
                    const lowestPriceOffers = group.offers.filter(o => parseFloat(o.price) === minPrice);
                    const lowestVendors = [...new Set(lowestPriceOffers.map(o => o.vendor))];
                    console.log(`Lowest Price Vendors: ${lowestVendors.join(', ')}`);
                }
                
                // Show sample offers
                console.log('Sample offers:');
                console.table(group.offers.slice(0, 5).map(o => ({
                    vendor: o.vendor,
                    price: o.price ? `$${parseFloat(o.price).toFixed(2)}` : 'N/A',
                    qty: o.qty,
                    date: o.date,
                    location: o.location
                })));
            });
        }

        // 3. Date distribution analysis
        console.log('\n3. DATE DISTRIBUTION (Last 21 days):');
        const { data: dateData, error: dateError } = await supabase
            .from('vendor_offers')
            .select('date')
            .gte('date', dateFilter);
            
        if (!dateError && dateData) {
            const dateCounts = {};
            dateData.forEach(record => {
                dateCounts[record.date] = (dateCounts[record.date] || 0) + 1;
            });
            
            const dateArray = Object.entries(dateCounts)
                .map(([date, count]) => ({ date, offers: count }))
                .sort((a, b) => a.date.localeCompare(b.date));
                
            console.table(dateArray.slice(-10)); // Show last 10 days
        }

        // 4. Create a sample 21-day query
        console.log('\n4. SAMPLE 21-DAY QUERY STRUCTURE:');
        console.log(`
-- Example query for 21-day vendor logic:
WITH recent_offers AS (
  SELECT 
    upc,
    vendor,
    price,
    qty,
    date,
    location,
    item_name
  FROM vendor_offers 
  WHERE date >= '${dateFilter}'
),
upc_vendor_summary AS (
  SELECT 
    upc,
    item_name,
    COUNT(DISTINCT vendor) as vendor_count,
    COUNT(DISTINCT CASE WHEN location = 'Domestic' THEN vendor END) as domestic_vendor_count,
    MIN(CASE WHEN location = 'Domestic' THEN price END) as min_domestic_price,
    MAX(date) as latest_date,
    SUM(CASE WHEN location = 'Domestic' THEN qty END) as total_domestic_qty
  FROM recent_offers 
  WHERE price IS NOT NULL
  GROUP BY upc, item_name
)
SELECT * FROM upc_vendor_summary 
WHERE domestic_vendor_count >= 3 
LIMIT 10;
        `);

    } catch (error) {
        console.error('Analysis error:', error);
    }
}

analyzeVendorData();