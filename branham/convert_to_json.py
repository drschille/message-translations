#!/usr/bin/env python3
"""
Convert Branham sermon CSV files to JSON for the PWA app.
Creates:
  - sermons.json (list of all sermons with metadata)
  - paragraphs/{sid}.json (paragraphs for each sermon)
"""

import pandas as pd
import json
import os
import sys

# Configuration
SERMONS_CSV = "sermons.csv"
PARAGRAPHS_CSV = "paragraphs.csv"
OUTPUT_DIR = "."
PARAGRAPHS_DIR = "paragraphs"

def clean_text(text):
    """Clean up escaped characters in text"""
    if not isinstance(text, str):
        return ''
    # Fix escaped quotes and newlines
    text = text.replace("\\'", "'")
    text = text.replace('\\"', '"')
    text = text.replace("\\n", "\n")
    text = text.replace("\\r", "")
    return text

def main():
    print("Converting CSV to JSON for PWA...")
    
    # Check files exist
    if not os.path.exists(SERMONS_CSV):
        print(f"Error: {SERMONS_CSV} not found")
        sys.exit(1)
    
    if not os.path.exists(PARAGRAPHS_CSV):
        print(f"Error: {PARAGRAPHS_CSV} not found")
        sys.exit(1)
    
    # Create output directories
    os.makedirs(PARAGRAPHS_DIR, exist_ok=True)
    
    # Load sermons
    print("Loading sermons...")
    sermons_df = pd.read_csv(
        SERMONS_CSV,
        quotechar='"',
        doublequote=True,
        on_bad_lines='skip',
        encoding='utf-8'
    )
    
    # Create sermons.json
    print("Creating sermons.json...")
    sermons_list = []
    for _, row in sermons_df.iterrows():
        sermon = {
            "sid": int(row['sid']),
            "title": str(row.get('originaltitle', '')),
            "date": str(row.get('sdate', '')),
            "location": str(row.get('location', '')),
            "tag": str(row.get('sdatecust', ''))
        }
        sermons_list.append(sermon)
    
    # Sort by date descending
    sermons_list.sort(key=lambda x: x['date'], reverse=True)
    
    with open('sermons.json', 'w', encoding='utf-8') as f:
        json.dump(sermons_list, f, ensure_ascii=False, indent=2)
    
    print(f"  Created sermons.json with {len(sermons_list)} sermons")
    
    # Load paragraphs
    print("Loading paragraphs...")
    paragraphs_df = pd.read_csv(
        PARAGRAPHS_CSV,
        quotechar='"',
        doublequote=True,
        on_bad_lines='skip',
        encoding='utf-8'
    )
    
    # Group paragraphs by sermon
    print("Creating paragraph files...")
    grouped = paragraphs_df.groupby('sid')
    
    count = 0
    for sid, group in grouped:
        paragraphs = []
        for _, row in group.sort_values('paragraphID').iterrows():
            text = str(row.get('englishparagraph', ''))
            text = clean_text(text)
            if text and text.strip():
                paragraphs.append({
                    "paragraphID": int(row.get('paragraphID', 0)),
                    "text": text
                })
        
        if paragraphs:
            filepath = os.path.join(PARAGRAPHS_DIR, f"{int(sid)}.json")
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(paragraphs, f, ensure_ascii=False)
            count += 1
            
            if count % 100 == 0:
                print(f"  Processed {count} sermons...")
    
    print(f"  Created {count} paragraph files")
    
    print("\nDone!")
    print("\nTo run the app:")
    print("  python3 -m http.server 8000")
    print("  Open http://localhost:8000")

if __name__ == "__main__":
    main()
