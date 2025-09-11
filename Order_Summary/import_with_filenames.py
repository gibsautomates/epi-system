import pandas as pd
import os
import glob
from pathlib import Path
from datetime import datetime
import re

def extract_date_from_filename(filename):
    """
    Extract date from filename pattern: Orders Export_MM.DD.YY.csv
    Returns date in YYYY-MM-DD format
    """
    # Pattern to match: Orders Export_MM.DD.YY.csv
    pattern = r'Orders Export_(\d{2})\.(\d{2})\.(\d{2})\.csv'
    match = re.search(pattern, filename)
    
    if match:
        month, day, year = match.groups()
        # Convert YY to YYYY (assuming 20XX)
        full_year = f"20{year}"
        return f"{full_year}-{month}-{day}"
    
    return None

def add_filename_and_date_to_csv(csv_file_path, output_dir):
    """
    Add source_filename and export_date columns to CSV
    """
    try:
        # Read the CSV
        df = pd.read_csv(csv_file_path)
        
        # Get filename without path
        filename = Path(csv_file_path).name
        
        # Extract date from filename
        export_date = extract_date_from_filename(filename)
        
        if not export_date:
            print(f"Warning: Could not extract date from {filename}")
            return False
        
        # Add new columns
        df['source_filename'] = filename
        df['export_date'] = export_date
        
        # Create output filename
        output_filename = f"enhanced_{filename}"
        output_path = os.path.join(output_dir, output_filename)
        
        # Save enhanced CSV
        df.to_csv(output_path, index=False)
        
        print(f"Enhanced: {filename} -> {output_filename} (Date: {export_date})")
        return True
        
    except Exception as e:
        print(f"Error processing {filename}: {str(e)}")
        return False

def process_all_csv_files(source_dir, output_dir):
    """
    Process all CSV files in the source directory
    """
    # Create output directory
    os.makedirs(output_dir, exist_ok=True)
    
    # Find all CSV files
    csv_pattern = os.path.join(source_dir, "Orders Export_*.csv")
    csv_files = glob.glob(csv_pattern)
    
    if not csv_files:
        print("No CSV files found matching pattern 'Orders Export_*.csv'")
        return
    
    print(f"Found {len(csv_files)} CSV files to process")
    print("-" * 60)
    
    processed_count = 0
    failed_count = 0
    
    for csv_file in csv_files:
        if add_filename_and_date_to_csv(csv_file, output_dir):
            processed_count += 1
        else:
            failed_count += 1
    
    print("-" * 60)
    print(f"Processing complete!")
    print(f"Successfully processed: {processed_count} files")
    print(f"Failed to process: {failed_count} files")
    
    if processed_count > 0:
        print(f"\nEnhanced CSV files saved to: {output_dir}")
        print("You can now import these enhanced files to Supabase")

if __name__ == "__main__":
    source_directory = r"C:\Users\User\OneDrive\Work\Freelancing\99 Perfume\Orders General Export\CSV_Files"
    output_directory = r"C:\Users\User\OneDrive\Work\Freelancing\99 Perfume\Orders General Export\Enhanced_CSV_Files"
    
    print("Processing CSV files to add filename and export date...")
    print(f"Source directory: {source_directory}")
    print(f"Output directory: {output_directory}")
    print("=" * 60)
    
    process_all_csv_files(source_directory, output_directory)