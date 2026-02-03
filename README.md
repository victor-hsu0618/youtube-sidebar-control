[English](README.md) | [繁體中文](README.zh-TW.md)

# YouTube Study Companion v2.5.0

Professional YouTube playback control and learning tool. Transform your YouTube experience into a powerful learning and notetaking workstation.

📖 **[Read the User Manual](docs/USER_MANUAL.md)** for a comprehensive guide. | 📺 **[View Presentation Slides](https://youtube-study-companion-a629h17.gamma.site/)**

## 📥 Installation

This project is a browser extension, currently supporting Chrome and Edge browsers. Please follow these steps to install in Developer Mode:

1. **Get the Code**
   
   Download the ZIP file of this project and extract it, or use Git Clone:
   ```bash
   git clone https://github.com/victor-hsu0618/youtube-sidebar-control.git
   ```

2. **Open Extensions Management Page**
   
   - **Chrome**: Enter `chrome://extensions` in the address bar
   - **Edge**: Enter `edge://extensions` in the address bar

3. **Enable Developer Mode**
   
   Find and toggle the "Developer mode" switch in the corner of the page (usually top right).

4. **Load Unpacked Extension**
   
   - Click "Load unpacked".
   - Select the folder of this project (ensure the folder contains the `manifest.json` file).

5. **Start Using**
   
   After installation is complete, open any YouTube video page, click the Extension icon in the browser toolbar, or open the sidebar to use.

## 🌟 Main Features

### 1. 🎛️ Advanced Playback Control
- **Dual-Panel Workspace**: Dedicated sub-tabs for **Markers** and **Controls** to maximize vertical space
- **Collapsible Controls**: Clean UI with collapsible sections for Speed and Loops within the Controls panel
- **Integrated A-B Loop**: Set start (A) and end (B) points precisely with **visual markers** directly on the progress bar
- **Precise Speed Control**: Accordion-style adjustment from 0.25x to 3.0x
- **Fine Navigation**: Rewind/Fast Forward 10 seconds, or jump to specific timestamp
- **Draggable Progress Bar**: Visual progress bar for quick positioning

### 2. 🔖 Smart Markers
- **Timestamp Notes**: Add markers at any moment in the video
- **Instant Jump**: Click any marker to jump precisely to that timestamp
- **Loop Ready**: Set A-B loop points based on marker time with one click
- **Marker Follow**: Optional auto-scroll to keep the current marker in view, now with **persistent memory** across sessions
- **Group Management**: Organize markers into "Default", "Study", or custom groups

### 3. 💾 Video Library & Multi-Favorite System
- **Video Favorites**: Save multiple "sessions" for a single YouTube video
    - *Example: One favorite for "Vocabulary", another for "Grammar Analysis"*
- **My Defaults (★)**: Mark your favorite favorites as default
- **Auto Detect 🪄**: Smart one-click load of "Default" or "Recently Edited" favorite for current video
- **Favorites Tab**: Specifically view all starred/default favorites

### 4. 🪟 Floating Window (Pop-out)
- **Multi-Screen Support**: Pop out the sidebar as a floating window to place on a second screen
- **Real-time Sync**: Actions in the pop-out window sync immediately with the sidebar (and vice versa)
- **Auto Close**: The pop-out window is automatically cleaned up when the sidebar is closed
- **Toggle Mode**: Pop-out button easily toggles external window on/off

### 5. 🧠 Smart Connection
- **Status Indicator**: Real-time connection feedback (Green dot = Connected, Grey = Standby)
- **Standby Mode**: Automatically detects when you leave YouTube
- **Home Page Guidance**: Helpful dashboard tips when on the YouTube homepage
- **Return to YouTube**: Wakes up immediately and reconnects control
- **Intent-Driven Loading**: When you click a specific favorite in the library, the extension ensures that specific version loads, even if you navigate away
- **Keyboard Power User**: Comprehensive keyboard shortcuts for playback, looping, and marker navigation (see Shortcut Guide in UI)

## 🛠️ Usage

1. **Open**: Click the extension icon on a YouTube page
2. **Control**: Use the top player area to control speed and loops
3. **Save**: Click the **Heart/Save icon** to add current video to your library
4. **Pop-out**: Click the ↗️ arrow in the title bar to detach the window
5. **Manage**: Use "Library" tab to view history, or "Favorites" tab to view starred sessions

## 📝 Notes

This extension supports comprehensive keyboard shortcuts. Click the **Keyboard Icon** in the title bar to view the full **Shortcut Guide**. Most shortcuts mirror native YouTube behavior (Space/K, J/L, 0-9), while others are unique to this tool ([, ], {, }, Arrow Up/Down).
