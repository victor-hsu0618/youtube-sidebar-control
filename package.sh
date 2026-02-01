#!/bin/bash

# Configuration
ZIP_NAME="YouTubeStudyCompanion.zip"
FILES_TO_ZIP=(
  "manifest.json"
  "background.js"
  "content.js"
  "sidebar.js"
  "sidebar.html"
  "sidebar.css"
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

echo "Done! $ZIP_NAME is ready for release."
