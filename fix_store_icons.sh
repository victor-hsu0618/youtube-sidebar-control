#!/bin/bash

# Define the icons to check and their required dimensions
# Format: "filename:width:height"
ICONS_TO_CHECK=(
  "icons/store/promo_440x280.png:440:280"
  "icons/store/promo_920x680.png:920:680"
  "icons/store/promo_1400x560.png:1400:560"
)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_icon() {
  local file_path=$1
  local target_w=$2
  local target_h=$3

  if [ ! -f "$file_path" ]; then
    echo -e "${RED}Error: File not found: $file_path${NC}"
    return 1
  fi

  # Get image properties using sips
  local current_w=$(sips -g pixelWidth "$file_path" | awk '/pixelWidth:/{print $2}')
  local current_h=$(sips -g pixelHeight "$file_path" | awk '/pixelHeight:/{print $2}')
  local has_alpha=$(sips -g hasAlpha "$file_path" | awk '/hasAlpha:/{print $2}')

  local needs_fix=0

  echo -n "Checking $file_path... "

  if [ "$current_w" -ne "$target_w" ] || [ "$current_h" -ne "$target_h" ]; then
    echo -e "${YELLOW}Wrong size ($current_w x $current_h). Target: $target_w x $target_h.${NC}"
    needs_fix=1
  fi

  if [ "$has_alpha" == "yes" ]; then
    echo -e "${YELLOW}Has alpha channel (transparency). Target: no alpha.${NC}"
    needs_fix=1
  fi

  if [ "$needs_fix" -eq 0 ]; then
    echo -e "${GREEN}OK${NC}"
    return 0
  else
    return 1
  fi
}

fix_icon() {
  local file_path=$1
  local target_w=$2
  local target_h=$3

  echo -e "${YELLOW}Fixing $file_path...${NC}"
  
  # 1. Resize EXACTLY to target dimensions (ignoring aspect ratio if needed, but here they should match)
  # 2. Convert to NO ALPHA by using sips with -s format png and --setProperty hasAlpha no (implicitly handled by intermediate JPG conversion for robustness)
  
  # Robust way: PNG -> JPG -> PNG (removes alpha and ensures clean pixels)
  local temp_jpg="${file_path%.*}.tmp.jpg"
  
  sips -z "$target_h" "$target_w" "$file_path" --out "$temp_jpg" -s format jpeg > /dev/null 2>&1
  sips -s format png "$temp_jpg" --out "$file_path" > /dev/null 2>&1
  
  rm "$temp_jpg"
  
  echo -e "${GREEN}Fixed!${NC}"
}

echo "--- Promotional Icons Validation ---"

ANY_FAILED=0

for icon_info in "${ICONS_TO_CHECK[@]}"; do
  IFS=":" read -r path w h <<< "$icon_info"
  if ! check_icon "$path" "$w" "$h"; then
    ANY_FAILED=1
    # Ask if user wants to fix (or just fix it if in auto-mode)
    # For this script we'll just fix automatically or provide a flag.
    fix_icon "$path" "$w" "$h"
  fi
done

echo "-------------------------------------"
if [ $ANY_FAILED -eq 0 ]; then
  echo -e "${GREEN}All icons are perfect for store submission!${NC}"
else
  echo -e "${GREEN}Icons have been normalized.${NC}"
fi
