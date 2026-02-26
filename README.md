[English](README.md) | [繁體中文](README.zh-TW.md)

# YouTube Study Companion v3.0.1 (Beta)

Professional YouTube playback control and learning tool. Transform your YouTube experience into a powerful learning and notetaking workstation.

📖 **[Read the User Manual](docs/USER_MANUAL.md)** | ⚠️ **[Known Issues](docs/KNOWN_ISSUES.md)** | 📺 **[View Presentation Slides](https://youtube-study-companion-a629h17.gamma.site/)**

## 📥 Installation

This project is a browser extension, currently supporting Chrome and Edge browsers. Please follow these steps to install in Developer Mode:

1. **Get the Code**
   
   Download the ZIP file of this project and extract it, or use Git Clone:
   ```bash
   git clone https://github.com/victor-hsu0618/youtube-sidebar-control.git
   ```

### 📦 Installation Steps (Recommended)
1. **Download Repository**: Click the green "Code" button and select **Download ZIP**.
2. **Download Pre-packaged Extension**: Alternatively, you can download `YouTubeStudyCompanion.zip` from the root directory.
3. **Extract ZIP**: Extract the file on your computer.
4. **Load into Chrome**:
   - Open Chrome and go to `chrome://extensions/`
   - Enable **Developer mode** in the top right.
   - Click **Load unpacked** and select the extracted folder.

## 🌟 Main Features (v3.0 New)

### 1. 🎵 Group Play (Playlist Mode)
- **Sequential Playback**: Automatically play all videos within a Favorite Group in order.
- **Visual Mode Indicator**: Professional green glow and status banner when Group Play is active.
- **Playlist Scraper**: One-click to detect and import entire YouTube playlists into your favorite groups.

### 2. ⚡ Zero-Latency Interaction
- **Hybrid Architecture**: Uses `chrome.storage.session` and `MutationObserver` for instant UI feedback (<5ms).
- **Persistent Pop-out**: Seamlessly switch between Sidebar and independent Pop-out windows without losing state.

## 🌟 Core Features (Legacy v2.x)

### 3. 🎛️ Advanced Playback Control
- **Dual-Panel Workspace**: Dedicated sub-tabs for **Markers** and **Advanced** to maximize vertical space.
- **Integrated A-B Loop**: Set start (A) and end (B) points precisely with **visual markers** directly on the progress bar.
- **Precise Speed Control**: Accordion-style adjustment in **0.05x increments** from 0.25x to 3.0x.

### 4. 🔖 Smart Markers
- **Timestamp Notes**: Add markers at any moment in the video.
- **Marker Follow**: Auto-scroll to keep the current marker in view.
- **Hotkeys**: Full support for `A` (Add Marker) and `R` (Restart Marker).

### 5. 💎 Pro Verification & Limits
- **Free Version Limits**: Maximum of 10 saved videos in the Library, and 10 markers per video.
- **Pro Version (Unlimited)**: Unlimited video saves, unlimited markers, and unrestricted features.
- **Account Binding**: Automatically detects your Google Account Email.
- **Cloud Authorization**: Permissions follow your account across devices via cloud sync.

### 6. 💾 Library & Management
- **Video Sessions**: Save multiple sessions (markers, loop points) for any video.
- **Batch Operations**: Edit, delete, or move multiple videos between groups at once.

## 🛠️ Usage

1. **Open**: Click the extension icon on a YouTube page.
2. **Group Play**: Go to **Favorites**, select a group, and click **▶ Play Group**.
3. **Save**: Click the heart icon to add current video to your library.
4. **Shortcuts**: Click the **Keyboard Icon** in the title bar to view the full **Shortcut Guide**.

## 📝 Notes

This extension is actively maintained. Please refer to [CHANGELOG.md](CHANGELOG.md) for detailed update history.
