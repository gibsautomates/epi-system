$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$workbook = $excel.Workbooks.Open("C:\Users\User\Downloads\channel lookup.xlsx")
$worksheet = $workbook.Worksheets.Item(1)
$range = $worksheet.UsedRange

Write-Host "Headers:"
$headers = @()
for ($col = 1; $col -le $range.Columns.Count; $col++) {
    $headers += $worksheet.Cells.Item(1, $col).Text
}
$headers -join "|"

Write-Host "`nAll rows:"
for ($row = 2; $row -le $range.Rows.Count; $row++) {
    $rowData = @()
    for ($col = 1; $col -le $range.Columns.Count; $col++) {
        $rowData += $worksheet.Cells.Item($row, $col).Text
    }
    $rowData -join "|"
}

$workbook.Close()
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null