#!/bin/bash

# Configuration
MANIFEST_STORE="manifest-store.json"
MANIFEST_REAL="manifest.json"
MANIFEST_TEMP="manifest_backup.json"

# Read version from manifest
VERSION=$(python3 -c "import json; d=json.load(open('$MANIFEST_REAL')); print(d.get('version_name', d.get('version', 'unknown')))")
CHROME_ZIP="YouTubeStudyCompanion_v${VERSION}_Chrome.zip"
EDGE_ZIP="YouTubeStudyCompanion_v${VERSION}_Edge.zip"

FILES_TO_ZIP=(
  "manifest.json"
  "background.js"
  "content.js"
  "sidebar.js"
  "sidebar.html"
  "sidebar.css"
  "monetization.js"
  "SupabaseManager.js"
  "lib"
  "icons"
  "docs"
  "README.md"
  "README.zh-TW.md"
)

echo "📦 Packaging YouTube Study Companion v${VERSION}..."

# Backup real manifest
cp "$MANIFEST_REAL" "$MANIFEST_TEMP"
# Use store manifest (no key field)
cp "$MANIFEST_STORE" "$MANIFEST_REAL"

# --- Chrome ZIP ---
[ -f "$CHROME_ZIP" ] && rm "$CHROME_ZIP"
echo "Creating $CHROME_ZIP..."
zip -r "$CHROME_ZIP" "${FILES_TO_ZIP[@]}" -x "*.DS_Store*" "*__MACOSX*"
echo "✅ $CHROME_ZIP ready for Chrome Web Store"

# --- Edge ZIP (same content, different name) ---
[ -f "$EDGE_ZIP" ] && rm "$EDGE_ZIP"
echo "Creating $EDGE_ZIP..."
cp "$CHROME_ZIP" "$EDGE_ZIP"
echo "✅ $EDGE_ZIP ready for Microsoft Edge Add-ons Store"

# Restore real manifest
mv "$MANIFEST_TEMP" "$MANIFEST_REAL"

echo ""
echo "🎉 Done! v${VERSION} packaged for both stores."
echo "   Chrome : $CHROME_ZIP  → https://chrome.google.com/webstore/devconsole"
echo "   Edge   : $EDGE_ZIP    → https://partner.microsoft.com/dashboard"
