# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**YouTube Study Companion** is a Chrome/Edge browser extension (Manifest V3) for YouTube playback control and learning. No build tools or test framework — pure vanilla JS.

## Development Workflow

### Loading the Extension
1. Go to `chrome://extensions/` → Enable **Developer mode**
2. Click **Load unpacked** → select this folder (the one with `manifest.json`)
3. After any JS change, click **Reload** on the extension card in `chrome://extensions/`
4. **Always refresh open YouTube tabs** (F5) after reloading — `content.js` must re-inject

### Packaging for Release
```bash
# Dev/GitHub release ZIP
./package.sh

# Store submission ZIPs (Chrome + Edge) — swaps manifest.json with manifest-store.json
./package-store.sh
```

## Architecture

The extension has three independent execution contexts that communicate via `chrome.runtime.sendMessage`:

| File | Context | Role |
|---|---|---|
| `background.js` | Service worker | Sidebar panel management, tab tracking, hotkey relay, proactive content script injection |
| `content.js` | YouTube tab | Video element control, state broadcasting, playlist scraping, loop logic |
| `sidebar.js` + `sidebar.html` + `sidebar.css` | Side panel | Main UI: Player / Favorites / Library views |
| `monetization.js` | Side panel (loaded by `sidebar.html`) | Pro verification via Google Apps Script backend |

### Key Architectural Patterns

**Zero-latency play/pause state**: `content.js` writes play state to `chrome.storage.session` using tab-ID-keyed entries (`videoPlaying_<tabId>`). `sidebar.js` reads this directly for instant UI updates instead of waiting for message round-trips.

**Play/pause reliability**: The play/pause button uses a `data-state` attribute approach (NOT `innerHTML` mutation) to prevent browser-cancelled click events. `sendMessageFast()` bypasses tab validation for latency-sensitive actions.

**SPA navigation handling**: `content.js` listens to `yt-navigate-finish` and `yt-page-data-updated` events plus a 1-second polling interval to detect YouTube's SPA navigation and re-initialize the video element.

**Video control strategy**: `executeCommand()` in `content.js` tries YouTube's internal player API (`movie_player`) first, then falls back to direct `<video>` element manipulation.

### Manifest Variants
- `manifest.json` — includes `"key"` field for consistent Extension ID across dev machines (needed for `chrome.storage.sync` cross-device compatibility)
- `manifest-store.json` — no `"key"` field, used for Chrome Web Store / Edge Add-ons submission
- `package-store.sh` temporarily swaps manifests when creating store ZIPs

### Pro / Monetization
`monetization.js` verifies Pro status against a Google Apps Script (Google Sheets backend) via `CLOUD_API_URL`. Status is cached in `chrome.storage.sync` under key `pro_activated`. The `isPro()` function gates features in `sidebar.js`.

## Storage Keys Reference
- `chrome.storage.sync`: `pro_activated`, `followMarkers`, user settings
- `chrome.storage.local`: markers, library videos, favorites groups, `playback_intent`
- `chrome.storage.session`: `videoPlaying_<tabId>`, `lastGlobalUpdate` (zero-latency state)

## Global Hotkeys (defined in manifest)
- `Alt+Shift+P` — Toggle Play/Pause
- `Alt+Shift+A` — Add Marker
- `Alt+Shift+R` — Restart Active Marker
- `Shift+<` / `Shift+>` — Speed down/up in 0.05x increments (intercepted in `content.js`)
