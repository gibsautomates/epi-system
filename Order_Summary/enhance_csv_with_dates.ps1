# PowerShell script to add filename and export_date columns to CSV files
param(
    [string]$SourceDir = "C:\Users\User\OneDrive\Work\Freelancing\99 Perfume\Orders General Export\CSV_Files",
    [string]$OutputDir = "C:\Users\User\OneDrive\Work\Freelancing\99 Perfume\Orders General Export\Enhanced_CSV_Files"
)

function Extract-DateFromFilename {
    param([string]$Filename)
    
    # Pattern to match: Orders Export_MM.DD.YY.csv
    if ($Filename -match 'Orders Export_(\d{2})\.(\d{2})\.(\d{2})\.csv') {
        $month = $matches[1]
        $day = $matches[2]
        $year = "20" + $matches[3]  # Convert YY to YYYY
        
        return "$year-$month-$day"
    }
    
    return $null
}

# Create output directory if it doesn't exist
if (!(Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
    Write-Host "Created output directory: $OutputDir" -ForegroundColor Green
}

# Find all CSV files matching the pattern
$CsvFiles = Get-ChildItem -Path $SourceDir -Filter "Orders Export_*.csv"

if ($CsvFiles.Count -eq 0) {
    Write-Host "No CSV files found matching pattern 'Orders Export_*.csv'" -ForegroundColor Red
    exit 1
}

Write-Host "Found $($CsvFiles.Count) CSV files to process" -ForegroundColor Cyan
Write-Host "Source directory: $SourceDir" -ForegroundColor Gray
Write-Host "Output directory: $OutputDir" -ForegroundColor Gray
Write-Host ("=" * 60) -ForegroundColor Gray

$ProcessedCount = 0
$FailedCount = 0

foreach ($File in $CsvFiles) {
    try {
        Write-Host "Processing: $($File.Name)" -ForegroundColor Yellow
        
        # Extract date from filename
        $ExportDate = Extract-DateFromFilename -Filename $File.Name
        
        if (-not $ExportDate) {
            Write-Host "  Warning: Could not extract date from $($File.Name)" -ForegroundColor Red
            $FailedCount++
            continue
        }
        
        # Read CSV content
        $CsvContent = Import-Csv -Path $File.FullName
        
        # Add new columns to each row
        foreach ($Row in $CsvContent) {
            $Row | Add-Member -NotePropertyName "source_filename" -NotePropertyValue $File.Name -Force
            $Row | Add-Member -NotePropertyName "export_date" -NotePropertyValue $ExportDate -Force
        }
        
        # Create output filename
        $OutputFilename = "enhanced_$($File.Name)"
        $OutputPath = Join-Path $OutputDir $OutputFilename
        
        # Save enhanced CSV
        $CsvContent | Export-Csv -Path $OutputPath -NoTypeInformation
        
        Write-Host "  Enhanced: $($File.Name) -> $OutputFilename (Date: $ExportDate)" -ForegroundColor Green
        $ProcessedCount++
        
    } catch {
        Write-Host "  Error processing $($File.Name): $($_.Exception.Message)" -ForegroundColor Red
        $FailedCount++
    }
}

Write-Host ("=" * 60) -ForegroundColor Gray
Write-Host "Processing complete!" -ForegroundColor Green
Write-Host "Successfully processed: $ProcessedCount files" -ForegroundColor Green

if ($FailedCount -gt 0) {
    Write-Host "Failed to process: $FailedCount files" -ForegroundColor Red
}

if ($ProcessedCount -gt 0) {
    Write-Host "`nEnhanced CSV files saved to: $OutputDir" -ForegroundColor Cyan
    Write-Host "You can now import these enhanced files to Supabase" -ForegroundColor Cyan
}