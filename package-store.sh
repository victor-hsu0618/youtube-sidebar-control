#!/bin/bash

# Configuration
ZIP_NAME="YouTubeStudyCompanion_Store.zip"
MANIFEST_STORE="manifest-store.json"
MANIFEST_REAL="manifest.json"
MANIFEST_TEMP="manifest_backup.json"

echo "Preparing Store version..."

# Backup real manifest if it has key
cp "$MANIFEST_REAL" "$MANIFEST_TEMP"
# Use store manifest
cp "$MANIFEST_STORE" "$MANIFEST_REAL"

FILES_TO_ZIP=(
  "manifest.json"
  "background.js"
  "content.js"
  "sidebar.js"
  "sidebar.html"
  "sidebar.css"
  "monetization.js"
  "icons"
  "docs"
  "README.md"
  "README.zh-TW.md"
)

# Clean up old zip if exists
if [ -f "$ZIP_NAME" ]; then
  rm "$ZIP_NAME"
fi

# Create new zip
echo "Creating $ZIP_NAME..."
zip -r "$ZIP_NAME" "${FILES_TO_ZIP[@]}" -x "*.DS_Store*" "*__MACOSX*"

# Restore real manifest
mv "$MANIFEST_TEMP" "$MANIFEST_REAL"

echo "Done! $ZIP_NAME is ready for upload to Chrome Web Store."
