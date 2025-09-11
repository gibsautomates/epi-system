import pandas as pd
import os
import glob
from pathlib import Path

def convert_excel_to_csv(source_dir, output_dir=None):
    """
    Convert all Excel files in a directory to CSV format
    
    Args:
        source_dir: Path to directory containing Excel files
        output_dir: Path to output directory (if None, uses source_dir)
    """
    if output_dir is None:
        output_dir = source_dir
    
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Find all Excel files
    excel_pattern = os.path.join(source_dir, "*.xlsx")
    excel_files = glob.glob(excel_pattern)
    
    print(f"Found {len(excel_files)} Excel files to convert")
    
    converted_count = 0
    failed_files = []
    
    for excel_file in excel_files:
        try:
            # Get base filename without extension
            base_name = Path(excel_file).stem
            csv_filename = f"{base_name}.csv"
            csv_path = os.path.join(output_dir, csv_filename)
            
            print(f"Converting: {Path(excel_file).name} -> {csv_filename}")
            
            # Read Excel file and convert to CSV
            df = pd.read_excel(excel_file)
            df.to_csv(csv_path, index=False, encoding='utf-8')
            
            converted_count += 1
            
        except Exception as e:
            print(f"Error converting {Path(excel_file).name}: {str(e)}")
            failed_files.append(excel_file)
    
    print(f"\nConversion complete!")
    print(f"Successfully converted: {converted_count} files")
    
    if failed_files:
        print(f"Failed to convert: {len(failed_files)} files")
        for failed_file in failed_files:
            print(f"  - {Path(failed_file).name}")
    
    return converted_count, failed_files

if __name__ == "__main__":
    source_directory = r"C:\Users\User\OneDrive\Work\Freelancing\99 Perfume\Orders General Export"
    
    # Create a CSV subdirectory to keep things organized
    csv_output_dir = os.path.join(source_directory, "CSV_Files")
    
    print("Starting Excel to CSV conversion...")
    print(f"Source directory: {source_directory}")
    print(f"Output directory: {csv_output_dir}")
    print("-" * 50)
    
    converted, failed = convert_excel_to_csv(source_directory, csv_output_dir)
    
    if converted > 0:
        print(f"\nCSV files have been saved to: {csv_output_dir}")