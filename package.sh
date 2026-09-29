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
  "monetization.js"
  "icons"
  "docs"
  "README.md"
  "README.zh-TW.md"
)

ZIP_EXCLUDES=(
  "*.DS_Store*"
  "*__MACOSX*"
  "_metadata/*"
  "*/_metadata/*"
)

validate_zip() {
  if unzip -Z1 "$ZIP_NAME" | grep -E '(^|/)_metadata(/|$)' >/dev/null; then
    echo "Error: $ZIP_NAME contains reserved Chrome extension directory _metadata"
    exit 1
  fi
}

# Clean up old zip if exists
if [ -f "$ZIP_NAME" ]; then
  rm "$ZIP_NAME"
fi

# Create new zip
echo "Creating $ZIP_NAME..."
zip -r "$ZIP_NAME" "${FILES_TO_ZIP[@]}" -x "${ZIP_EXCLUDES[@]}"
validate_zip

echo "Done! $ZIP_NAME is ready for release."
