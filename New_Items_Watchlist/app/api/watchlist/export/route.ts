import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

// Force dynamic rendering - disable static optimization
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const { data, columns } = await request.json();

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    
    // Add summary sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 20 }
    ];
    
    summarySheet.addRows([
      { metric: 'Export Date', value: new Date().toLocaleDateString() },
      { metric: 'Export Time', value: new Date().toLocaleTimeString() },
      { metric: 'Total Items', value: data.length },
      { metric: 'Items with 3+ Vendors', value: data.filter((d: any) => d.domestic_vendor_count >= 3).length }
    ]);

    // Add data sheet
    const dataSheet = workbook.addWorksheet('Items');
    
    // Define column mappings
    const columnMap: any = {
      upc: { header: 'UPC', key: 'upc', width: 15 },
      item_name: { header: 'Item Name', key: 'item_name', width: 50 },
      brand: { header: 'Brand', key: 'brand', width: 20 },
      sku: { header: 'SKU', key: 'sku', width: 15 },
      lowest_price: { header: 'Lowest Price', key: 'lowest_price', width: 12 },
      min_price: { header: 'Min Price', key: 'min_price', width: 12 },
      avg_price: { header: 'Avg Price', key: 'avg_price', width: 12 },
      max_price: { header: 'Max Price', key: 'max_price', width: 12 },
      lowest_vendor: { header: 'Lowest Vendor', key: 'lowest_vendor', width: 20 },
      domestic_vendor_count: { header: 'Domestic Vendors', key: 'domestic_vendor_count', width: 15 },
      total_vendor_count: { header: 'Total Vendors', key: 'total_vendor_count', width: 15 },
      vendor_list: { header: 'All Vendors', key: 'vendor_list', width: 60 },
      first_seen: { header: 'First Seen', key: 'first_seen', width: 12 },
      last_seen: { header: 'Last Seen', key: 'last_seen', width: 12 },
      days_on_watchlist: { header: 'Days on Watchlist', key: 'days_on_watchlist', width: 15 },
      status: { header: 'Status', key: 'status', width: 12 },
      status_streak: { header: 'Streak', key: 'status_streak', width: 10 },
      times_seen: { header: 'Times Seen', key: 'times_seen', width: 12 },
      price_trend: { header: 'Price Trend', key: 'price_trend', width: 12 },
      price_change_pct: { header: 'Price Change %', key: 'price_change_pct', width: 15 },
      vendor_change_status: { header: 'Vendor Status', key: 'vendor_change_status', width: 15 },
      vendor_count_change: { header: 'Vendor Change', key: 'vendor_count_change', width: 12 },
      qty_available: { header: 'Qty Available', key: 'qty_available', width: 12 }
    };

    // Set columns based on selected columns
    dataSheet.columns = columns.map((col: string) => columnMap[col]).filter(Boolean);

    // Add data rows
    data.forEach((item: any) => {
      const row: any = {};
      columns.forEach((col: string) => {
        if (col === 'vendor_list') {
          // Handle vendor_list as either string or array
          if (typeof item[col] === 'string') {
            row[col] = item[col];
          } else if (Array.isArray(item[col])) {
            row[col] = item[col].join(', ');
          } else {
            row[col] = '';
          }
        } else if (col === 'first_seen' || col === 'last_seen') {
          row[col] = item[col] ? new Date(item[col]).toLocaleDateString() : '';
        } else if (col.includes('price') && typeof item[col] === 'number') {
          row[col] = `$${item[col].toFixed(2)}`;
        } else if (col === 'price_change_pct' && item[col] !== null && item[col] !== undefined) {
          row[col] = `${item[col]}%`;
        } else {
          row[col] = item[col] !== null && item[col] !== undefined ? item[col] : '';
        }
      });
      dataSheet.addRow(row);
    });

    // Add vendor analysis sheet
    const vendorSheet = workbook.addWorksheet('Vendor Analysis');
    vendorSheet.columns = [
      { header: 'Vendor', key: 'vendor', width: 25 },
      { header: 'Items Count', key: 'count', width: 15 },
      { header: 'Location', key: 'location', width: 15 }
    ];

    // Calculate vendor stats
    const vendorStats = new Map();
    data.forEach((item: any) => {
      // Handle vendor_list as either string or array
      const vendors = typeof item.vendor_list === 'string' 
        ? item.vendor_list.split(', ').filter(Boolean)
        : Array.isArray(item.vendor_list) 
          ? item.vendor_list 
          : [];
      
      vendors.forEach((vendor: string) => {
        if (!vendorStats.has(vendor)) {
          vendorStats.set(vendor, {
            count: 0,
            location: item.domestic_vendor_count > 0 ? 'Domestic' : 'International'
          });
        }
        const stats = vendorStats.get(vendor);
        stats.count++;
      });
    });

    vendorStats.forEach((stats, vendor) => {
      vendorSheet.addRow({
        vendor,
        count: stats.count,
        location: stats.location
      });
    });

    // Style all sheets
    [summarySheet, dataSheet, vendorSheet].forEach(sheet => {
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4CAF50' }
      };
      sheet.getRow(1).alignment = { horizontal: 'center' };
      
      // Add borders
      sheet.eachRow((row, rowNumber) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
      });
    });

    // Conditional formatting for status (only if status column is included)
    if (columns.includes('status')) {
      const statusColIndex = dataSheet.columns.findIndex(col => col.key === 'status');
      if (statusColIndex !== -1) {
        dataSheet.eachRow((row, rowNumber) => {
          if (rowNumber > 1) {
            const statusCell = row.getCell(statusColIndex + 1); // Excel uses 1-based indexing
            if (statusCell && statusCell.value) {
              const status = statusCell.value.toString().toLowerCase();
              if (status === 'new') {
                statusCell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: 'FFD4EDDA' }
                };
              } else if (status === 'missing') {
                statusCell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: 'FFF8D7' }
                };
              }
            }
          }
        });
      }
    }

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Return as download
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="watchlist_export_${new Date().toISOString().split('T')[0]}.xlsx"`
      }
    });

  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    );
  }
}