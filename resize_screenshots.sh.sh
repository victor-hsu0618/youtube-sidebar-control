#!/bin/bash

# Resize all screenshots to 1280x800 for Edge/Chrome Store
INPUT_DIR="./docs/images/screenshot/v3.0.1"
OUTPUT_DIR="./docs/images/screenshot/v3.1.0_store"

mkdir -p "$OUTPUT_DIR"

python3 << EOF
from PIL import Image
import os

input_dir = "$INPUT_DIR"
output_dir = "$OUTPUT_DIR"
target_size = (1280, 800)

files = [f for f in os.listdir(input_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]

for filename in files:
    input_path = os.path.join(input_dir, filename)
    output_path = os.path.join(output_dir, os.path.splitext(filename)[0] + '.png')

    img = Image.open(input_path)
    original_size = img.size
    print(f"Processing: {filename} ({original_size[0]}x{original_size[1]}) -> 1280x800")

    # Resize with aspect ratio preserved, then pad with black
    img_ratio = img.width / img.height
    target_ratio = 1280 / 800

    if img_ratio > target_ratio:
        # Wider than target, fit width
        new_width = 1280
        new_height = int(1280 / img_ratio)
    else:
        # Taller than target, fit height
        new_height = 800
        new_width = int(800 * img_ratio)

    img_resized = img.resize((new_width, new_height), Image.LANCZOS)

    # Create canvas and paste
    canvas = Image.new('RGB', (1280, 800), (0, 0, 0))
    x = (1280 - new_width) // 2
    y = (800 - new_height) // 2
    canvas.paste(img_resized, (x, y))
    canvas.save(output_path, 'PNG')
    print(f"  Saved: {output_path}")

print(f"\nDone! {len(files)} screenshots saved to {output_dir}")
EOF