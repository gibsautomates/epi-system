import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

export async function POST(request: NextRequest) {
  try {
    const { report } = await request.json();

    if (!report || !report.items || !report.allVendors) {
      return NextResponse.json({ error: 'Invalid report data' }, { status: 400 });
    }

    // Create a new workbook
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
      { metric: 'Total UPCs Searched', value: report.summary.totalItems },
      { metric: 'Items Found', value: report.summary.itemsFound },
      { metric: 'Items Not Found', value: report.summary.itemsNotFound },
      { metric: 'Unique Vendors', value: report.summary.uniqueVendors }
    ]);

    // Add vendor comparison sheet
    const dataSheet = workbook.addWorksheet('Vendor Comparison');

    // Create columns array
    const columns = [
      { header: 'UPC', key: 'upc', width: 15 },
      { header: 'Item Name', key: 'item_name', width: 40 },
      { header: 'Brand', key: 'brand', width: 20 },
      { header: 'SKU', key: 'sku', width: 15 },
      { header: 'Median Price', key: 'medianPrice', width: 12 },
      { header: 'Avg Price', key: 'avgPrice', width: 12 },
      { header: 'Lowest Price', key: 'lowestPrice', width: 12 },
      { header: 'Lowest Vendor', key: 'lowestVendor', width: 20 },
      { header: 'Qty Available', key: 'lowestVendorQty', width: 12 },
      { header: 'Vendor Count', key: 'vendorCount', width: 12 }
    ];

    // Add vendor columns (price and qty for each vendor)
    report.allVendors.forEach((vendor: string) => {
      columns.push(
        { header: `${vendor} - Price`, key: `${vendor}_price`, width: 12 },
        { header: `${vendor} - Qty`, key: `${vendor}_qty`, width: 10 }
      );
    });

    dataSheet.columns = columns;

    // Add data rows
    report.items.forEach((item: any) => {
      const row: any = {
        upc: item.upc,
        item_name: item.item_name,
        brand: item.brand,
        sku: item.sku || 'New Item',
        medianPrice: item.medianPrice || 0,
        avgPrice: item.avgPrice || 0,
        lowestPrice: item.lowestPrice || 0,
        lowestVendor: item.lowestVendor || '-',
        lowestVendorQty: item.lowestVendorQty || '-',
        vendorCount: item.vendorCount || 0
      };

      // Add vendor data
      report.allVendors.forEach((vendor: string) => {
        const offer = item.vendors.find((v: any) => v.vendor === vendor);
        if (offer) {
          row[`${vendor}_price`] = offer.price;
          row[`${vendor}_qty`] = offer.qty || '';
        } else {
          row[`${vendor}_price`] = '';
          row[`${vendor}_qty`] = '';
        }
      });

      dataSheet.addRow(row);
    });

    // Style the header row
    dataSheet.getRow(1).font = { bold: true };
    dataSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Return the file
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="vendor_comparison_${new Date().toISOString().split('T')[0]}.xlsx"`
      }
    });

  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Failed to export report' },
      { status: 500 }
    );
  }
}