# YouTube Study Companion - Developer Guide

This document provides essential context and instructions for developers working on the YouTube Study Companion extension.

## 🚀 Project Overview
A professional Manifest V3 browser extension designed to optimize YouTube for learning and research. It features precise playback controls, A-B looping, marker-based notetaking, and a persistent video library.

- **Tech Stack**: Vanilla JavaScript (ES6+), HTML5, CSS3.
- **Architecture**: Decoupled Side Panel (`sidebar.js`), Content Script (`content.js`), and Service Worker (`background.js`).
- **Design Philosophy**: Zero-latency UI updates using `chrome.storage.session` and hybrid player control (YouTube API + direct DOM).

## 🛠️ Development Workflow

### Loading the Extension
1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select the project root directory.
4. **Important**: Refresh any open YouTube tabs after loading or reloading the extension.

### Packaging & Release
- **Standard ZIP**: Run `./package.sh` for GitHub/manual releases.
- **Store Submission**: Run `./package-store.sh`. This script handles swapping `manifest.json` with `manifest-store.json` (which omits the developer key).

## 🏗️ Architecture Detail

| Component | Responsibility |
| :--- | :--- |
| **`background.js`** | Side panel initialization, hotkey relaying, and ensuring content scripts are injected into active YouTube tabs. |
| **`content.js`** | Injected logic that interacts with the YouTube player. Handles `yt-navigate-finish` for SPA support and writes real-time play state to `chrome.storage.session`. |
| **`sidebar.js`** | The "brain" of the UI. Manages the multi-tab interface (Player, Favorites, Library), marker rendering, and synchronization with the content script. |
| **`monetization.js`** | Verifies "Pro" status via a Google Apps Script backend. Gated features check `isPro()` before allowing execution. |

## 💾 Storage Strategy
- **`chrome.storage.sync`**: Small configuration items and the `pro_activated` flag.
- **`chrome.storage.local`**: Heavy data including `markers`, `library` videos, and `favorites` groups.
- **`chrome.storage.session`**: Tab-specific transient state (e.g., `videoPlaying_<tabId>`) for sub-5ms UI responsiveness.

## ⌨️ Global Hotkeys
- `Alt+Shift+P`: Toggle Play/Pause
- `Alt+Shift+A`: Add Marker
- `Alt+Shift+R`: Restart Active Marker
- `Shift+<` / `Shift+>`: Increment/Decrement speed by 0.05x (Handled in `content.js`).

## 📜 Key Files Summary
- `manifest.json`: Primary configuration for development.
- `sidebar.html`: The structure for the Side Panel UI.
- `sidebar.css`: Modern CSS with custom scrollbars and dark-mode optimization.
- `monetization.js`: Logic for the "Pro" verification system.
- `CLAUDE.md`: Highly detailed architectural notes and state management keys.
- `.project_context.md`: High-level project summary and recent milestones.
