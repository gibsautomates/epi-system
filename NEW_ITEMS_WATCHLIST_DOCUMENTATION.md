# New Items Watchlist - System Documentation

## 📋 **System Overview**

The New Items Watchlist is an intelligent inventory opportunity tracking system that monitors vendor offers for items not currently in your inventory. It identifies profitable resale opportunities by tracking price trends, vendor availability, and competitive intelligence from multiple suppliers.

## 🎯 **Business Purpose**

**Primary Goal**: Track new product opportunities from vendors to fulfill customer orders without maintaining physical inventory.

**Business Model**: 
- Monitor vendor offers for items not in current inventory
- Identify items with competitive pricing from 3+ domestic vendors
- Enable just-in-time purchasing when customer orders are received
- Maximize profit margins through vendor price comparison

## 🔧 **How It Works**

### **Data Collection**
- Continuously ingests vendor offers from multiple suppliers
- Tracks items with **3+ domestic vendors** (ensures supply reliability)
- Monitors price changes, vendor availability, and stock levels
- Maintains 21-day rolling window of vendor data

### **21-Day Logic** (Core Business Rule)
```
✅ Include: All items offered by vendors in the last 21 days
✅ Latest Data Wins: If vendor updates on Day 10, ignore their Day 5 offers
✅ Missing Vendors Included: If vendor offered on Day 5 but hasn't updated since, still include their Day 5 offers (within 21-day window)
✅ Continuous Updates: Add new vendor data as it arrives, don't wait for all vendors to update
```

### **Item Lifecycle Tracking**

**Status Flow:**
1. **NEW_CANDIDATE** → Item first appears in vendor feeds
2. **WATCHING** → Item meets criteria (3+ domestic vendors), actively monitored
3. **REMOVED** → Item dropped below vendor threshold or aged out
4. **BACK_IN_FEED** → Previously removed item returns with sufficient vendors
5. **ACQUIRED** → Item added to inventory, no longer needs tracking

**Streak Tracking:**
- **Status Streak**: Consecutive days in current status (e.g., "WATCHING for 5 days")
- **Times Seen**: Total number of times item appeared in feeds
- **Days on Watchlist**: Total days since first detection

## 📊 **Key Features**

### **Dashboard Capabilities**
- **Real-time monitoring** of 39,000+ items from vendor feeds
- **Advanced filtering** by vendor count, price range, status, date ranges
- **Export functionality** for Excel reports and external analysis
- **Price trend analysis** with percentage changes and historical data
- **Vendor comparison** showing lowest/highest prices and vendor count changes

### **Competitive Intelligence**
- **Price variance analysis** - Items with high price differences between vendors
- **Vendor performance metrics** - Track reliability and pricing patterns
- **Market trend identification** - Spot emerging products and price movements
- **Supply chain monitoring** - Alert when vendors drop items or change pricing

## 💡 **Business Logic & Rules**

### **Vendor Threshold Rule**
**Minimum 3 domestic vendors required**
- Ensures supply chain reliability
- Reduces risk of vendor stockouts
- Enables competitive price negotiations

### **Pricing Strategy**
- **Lowest Price Identification**: Track cheapest vendor for each item
- **Margin Calculation**: Compare vendor cost vs. retail/MSRP pricing
- **Price Trend Monitoring**: Alert on significant price movements (±5%)

### **Inventory Integration**
- **Exclusion Logic**: Items already in inventory are filtered out
- **Acquisition Tracking**: When items are purchased, status changes to "ACQUIRED"
- **Demand Matching**: Cross-reference with customer inquiries/orders

## 🚀 **Business Applications**

### **For Order Fulfillment**
1. Customer places order for item not in inventory
2. Check watchlist for vendor availability and pricing
3. Select best vendor based on price, reliability, and delivery time
4. Purchase from vendor and fulfill customer order
5. Track profit margin and vendor performance

### **For Business Development**
- **Market Expansion**: Identify new product categories with high vendor interest
- **Vendor Relationships**: Negotiate better terms with frequently used suppliers
- **Pricing Strategy**: Set competitive retail prices based on vendor costs
- **Risk Management**: Monitor supply chain stability and vendor reliability

## ❓ **Clarification Questions for Presentation**

### **Technical Questions**
1. **Data Refresh Frequency**: How often should vendor data be updated? (Currently shows every few days - should it be daily?)

2. **Streak Calculation**: Should streaks continue counting over weekends/holidays when no data updates occur?

3. **Vendor Reliability Scoring**: Should we track vendor performance metrics (delivery time, stockout frequency, price stability)?

4. **Inventory Integration**: How should the system handle partial inventory (e.g., low stock vs. out of stock)?

### **Business Logic Questions**
5. **Minimum Order Quantities**: Should we track vendor MOQs and factor into recommendations?

6. **Geographic Preferences**: Do "domestic vendors" have priority over international for faster shipping?

7. **Seasonal Adjustments**: Should the 21-day window adjust for seasonal products (longer for seasonal items)?

8. **Price Threshold Alerts**: What percentage price change should trigger alerts or re-evaluation?

### **Operational Questions**
9. **Manual Overrides**: Should users be able to manually mark items as "priority" or "ignore"?

10. **Customer Demand Integration**: Should we prioritize items that customers have specifically inquired about?

11. **Bulk Operations**: How should the system handle large bulk orders that might require multiple vendors?

12. **Vendor Communication**: Should the system integrate with vendor ordering systems or remain analysis-only?

## 🌟 **Enhancement Suggestions**

### **Immediate Improvements (Next 30 Days)**
1. **Automated Daily Tracking** - Fix streak calculation by running updates daily
2. **Advanced Filtering** - Add filters for price range, profit margin, vendor geography
3. **Export Templates** - Create formatted Excel exports for vendor negotiations
4. **Mobile Responsiveness** - Optimize dashboard for mobile/tablet viewing

### **Short-term Enhancements (Next 90 Days)**
5. **Vendor Performance Dashboard** - Track delivery times, reliability scores, price stability
6. **Profit Margin Calculator** - Integrate with retail pricing to show potential profits
7. **Customer Demand Integration** - Cross-reference with customer inquiries and orders
8. **Automated Alerts** - Email/SMS notifications for significant price changes or new opportunities

### **Long-term Strategic Features (Next 6-12 Months)**
9. **AI-Powered Recommendations** - Machine learning for demand prediction and vendor selection
10. **Vendor Ordering Integration** - Direct API connections with vendor systems for automated purchasing
11. **Multi-Location Support** - Track regional vendor pricing and availability
12. **Advanced Analytics** - Predictive analytics for market trends and seasonal patterns

### **Enterprise Features** (For Other Businesses)
13. **Multi-Tenant Architecture** - Support multiple businesses with isolated data
14. **White-Label Solution** - Customizable branding and terminology
15. **API Access** - REST APIs for integration with other business systems
16. **Advanced Reporting** - Custom report builder with scheduled delivery
17. **Role-Based Access** - Different permission levels for various user types

## 📈 **Success Metrics**

### **Operational KPIs**
- **Item Coverage**: Number of items actively monitored
- **Vendor Diversity**: Average vendors per item
- **Data Freshness**: Percentage of items with recent vendor data
- **Price Accuracy**: Variance between tracked and actual vendor prices

### **Business Impact KPIs**
- **Order Fulfillment Rate**: Percentage of customer orders fulfilled via watchlist vendors
- **Profit Margin Improvement**: Increased margins from better vendor selection
- **Vendor Performance**: Average delivery times and reliability scores
- **Market Opportunity Identification**: New product categories discovered

## 🎯 **Conclusion**

The New Items Watchlist transforms vendor data into actionable business intelligence, enabling efficient inventory-free order fulfillment while maximizing profit margins through competitive vendor selection and real-time market monitoring.

---
*Last Updated: September 2025*
*System Status: Production Ready with Enhancement Pipeline*