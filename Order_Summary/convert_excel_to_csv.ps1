# PowerShell script to convert Excel files to CSV
param(
    [string]$SourceDir = "C:\Users\User\OneDrive\Work\Freelancing\99 Perfume\Orders General Export",
    [string]$OutputDir = ""
)

# Set default output directory if not provided
if ([string]::IsNullOrEmpty($OutputDir)) {
    $OutputDir = Join-Path $SourceDir "CSV_Files"
}

# Create output directory if it doesn't exist
if (!(Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
    Write-Host "Created output directory: $OutputDir" -ForegroundColor Green
}

# Find all Excel files
$ExcelFiles = Get-ChildItem -Path $SourceDir -Filter "*.xlsx" | Where-Object { !$_.PSIsContainer }

Write-Host "Found $($ExcelFiles.Count) Excel files to convert" -ForegroundColor Cyan
Write-Host "Source directory: $SourceDir" -ForegroundColor Gray
Write-Host "Output directory: $OutputDir" -ForegroundColor Gray
Write-Host ("-" * 50) -ForegroundColor Gray

if ($ExcelFiles.Count -eq 0) {
    Write-Host "No Excel files found in the source directory!" -ForegroundColor Red
    exit 1
}

# Initialize Excel Application
try {
    $Excel = New-Object -ComObject Excel.Application
    $Excel.Visible = $false
    $Excel.DisplayAlerts = $false
    
    $ConvertedCount = 0
    $FailedFiles = @()
    
    foreach ($File in $ExcelFiles) {
        try {
            $BaseName = [System.IO.Path]::GetFileNameWithoutExtension($File.Name)
            $CsvFileName = "$BaseName.csv"
            $CsvPath = Join-Path $OutputDir $CsvFileName
            
            Write-Host "Converting: $($File.Name) -> $CsvFileName" -ForegroundColor Yellow
            
            # Open the Excel file
            $Workbook = $Excel.Workbooks.Open($File.FullName)
            
            # Save as CSV (format 6 = CSV)
            $Workbook.SaveAs($CsvPath, 6)
            $Workbook.Close($false)
            
            $ConvertedCount++
            
        } catch {
            Write-Host "Error converting $($File.Name): $($_.Exception.Message)" -ForegroundColor Red
            $FailedFiles += $File.Name
        }
    }
    
    # Clean up Excel application
    $Excel.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($Excel) | Out-Null
    
    Write-Host "`nConversion complete!" -ForegroundColor Green
    Write-Host "Successfully converted: $ConvertedCount files" -ForegroundColor Green
    
    if ($FailedFiles.Count -gt 0) {
        Write-Host "Failed to convert: $($FailedFiles.Count) files" -ForegroundColor Red
        foreach ($FailedFile in $FailedFiles) {
            Write-Host "  - $FailedFile" -ForegroundColor Red
        }
    }
    
    Write-Host "`nCSV files have been saved to: $OutputDir" -ForegroundColor Cyan
    
} catch {
    Write-Host "Error initializing Excel: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Make sure Microsoft Excel is installed on this system." -ForegroundColor Yellow
    exit 1
}