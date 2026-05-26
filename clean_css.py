def deduplicate_css(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Split by exactly identical blocks or just find where it starts repeating
    # A good heuristic is to find the first occurrence of :root { and see if it repeats
    parts = content.split(':root {')
    
    # If it has more than 2 parts, it means :root { appeared multiple times
    if len(parts) > 2:
        # The first part is everything before the first :root {
        # The second part is the first block of CSS
        # But wait, did upstream add the new classes at the very end of the file?
        pass

import re

def clean_index_css():
    with open('css/index_upstream.css', 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    # We know the file is concatenated multiple times.
    # Let's find the indices of ":root {"
    root_indices = [i for i, line in enumerate(lines) if ':root {' in line]
    
    if len(root_indices) >= 3:
        # The first block is from 0 to root_indices[1]
        # The second block is from root_indices[1] to root_indices[2]
        # The third block is from root_indices[2] to the end.
        
        # We want to keep ONLY ONE copy of the duplicated part, BUT we must keep anything UNIQUE added to the end!
        # Let's take the last block (root_indices[-1] to end) because usually people append to the end of the file.
        # Wait! If they appended to the end, the last block will have the base CSS + the new additions!
        # Let's verify this.
        
        last_block = lines[root_indices[-1]:]
        
        # Write it to see
        with open('css/index_clean.css', 'w', encoding='utf-8') as out:
            # Also keep anything before the first :root if there's any imports
            out.writelines(lines[:root_indices[0]])
            out.writelines(last_block)
            
    else:
        print("Not duplicated?")

clean_index_css()
