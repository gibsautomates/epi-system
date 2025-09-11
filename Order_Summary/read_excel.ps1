$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$workbook = $excel.Workbooks.Open("C:\Users\User\OneDrive\Work\Freelancing\99 Perfume\Orders General Export\Orders Export_09.08.25.xlsx")
$worksheet = $workbook.Worksheets.Item(1)
$range = $worksheet.UsedRange

Write-Host "Headers:"
$headers = @()
for ($col = 1; $col -le $range.Columns.Count; $col++) {
    $headers += $worksheet.Cells.Item(1, $col).Text
}
$headers -join "|"

Write-Host "`nSample rows:"
for ($row = 2; $row -le [Math]::Min(5, $range.Rows.Count); $row++) {
    $rowData = @()
    for ($col = 1; $col -le $range.Columns.Count; $col++) {
        $rowData += $worksheet.Cells.Item($row, $col).Text
    }
    $rowData -join "|"
}

$workbook.Close()
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null