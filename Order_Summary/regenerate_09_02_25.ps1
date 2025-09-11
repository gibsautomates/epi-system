# PowerShell script to regenerate enhanced CSV for 09.02.25 file
$SourceFile = "C:\Users\User\OneDrive\Work\Freelancing\99 Perfume\Orders General Export\CSV_Files\Orders Export_09.02.25.csv"
$OutputDir = "C:\Users\User\OneDrive\Work\Freelancing\99 Perfume\Orders General Export\Enhanced_CSV_Files"
$OutputFile = Join-Path $OutputDir "enhanced_Orders Export_09.02.25.csv"

Write-Host "Processing: Orders Export_09.02.25.csv" -ForegroundColor Yellow

try {
    # Check if source file exists
    if (!(Test-Path $SourceFile)) {
        Write-Host "Error: Source file not found: $SourceFile" -ForegroundColor Red
        exit 1
    }
    
    # Read CSV content
    $CsvContent = Import-Csv -Path $SourceFile
    
    Write-Host "Read $($CsvContent.Count) rows from source file" -ForegroundColor Gray
    
    # Add new columns to each row
    foreach ($Row in $CsvContent) {
        $Row | Add-Member -NotePropertyName "source_filename" -NotePropertyValue "Orders Export_09.02.25.csv" -Force
        $Row | Add-Member -NotePropertyName "export_date" -NotePropertyValue "2025-09-02" -Force
    }
    
    # Save enhanced CSV
    $CsvContent | Export-Csv -Path $OutputFile -NoTypeInformation
    
    Write-Host "Enhanced: Orders Export_09.02.25.csv -> enhanced_Orders Export_09.02.25.csv (Date: 2025-09-02)" -ForegroundColor Green
    Write-Host "File saved to: $OutputFile" -ForegroundColor Cyan
    
} catch {
    Write-Host "Error processing file: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}