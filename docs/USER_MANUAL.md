[English](USER_MANUAL.md) | [繁體中文](USER_MANUAL.zh-TW.md)

# User Manual: YouTube Study Companion

Welcome to YouTube Study Companion! This guide will help you familiarize yourself with all features of this extension, giving you a more powerful learning and control experience on YouTube and YouTube Music.

**Tip**: For the best reading experience, it is recommended to take screenshots of the actual operation interface and replace the image placeholders in this text.

---

## 📖 Table of Contents

1.  [Interface Overview](#1-interface-overview)
2.  [Player Controls](#2-player-controls)
3.  [A-B Loop](#3-a-b-loop)
4.  [Smart Markers](#4-smart-markers)
5.  [Library & Groups](#5-library--groups)
6.  [Pop-out Window](#6-pop-out-window)
7.  [Keyboard Shortcuts](#7-keyboard-shortcuts)
8.  [Local Auto Backup](#8-local-auto-backup)
9.  [Cross-Device Synchronization](#9-cross-device-synchronization)

---

## 1. Interface Overview

After launching the Extension, you will see the main screen. The sidebar is designed simply, mainly divided into three tabs:

*   **Player**: The main operation area. It now features two internal sub-tabs:
    *   **Video Marks**: Your primary workspace for taking and browsing notes.
*   **Settings**: Adjustment area for Speed, Cloud Sync Refresh, and **Pro Account Activation**.
*   **Library**: View all saved sessions through the **All Videos** group, or switch to custom groups for focused collections. Free users are limited to **20 saved videos** here.

![Interface Overview Screenshot](images/screenshot/v3.0.1/Favorites-UI-v3.0.1.png)
*(Suggested Screenshot: Full screen after opening Sidebar)*

On the right side of the top title bar is a **↗️ Arrow Button**. Click to detach the window (Pop-out). 

### Supported Sites
YouTube Study Companion supports both regular YouTube video pages and YouTube Music playback pages:
- **YouTube**: `youtube.com/watch`, playlists, Shorts, and embedded/video pages.
- **YouTube Music**: `music.youtube.com/watch` and playlist pages.

When a video or playlist is imported from YouTube Music, the extension remembers that source. Opening it later from Library or Group Play will return to `music.youtube.com` instead of regular YouTube.

### 🟢 Status Indicator
Next to the **v3.0.0** badge, you will see a status indicator:
- **Green**: Extension is actively connected to the YouTube video.
- **Grey**: Extension is in Standby mode.
- **[New] Group Play Banner**: A green banner appears at the top when Group Play mode is active.
- **[New] Mode Border**: The whole player panel highlights with a green border during playlist playback.
- **[New] Color-coded Title Highlight**: 
    - **Amber Title**: Indicates the video is on a hidden tab in the current window.
    - **Blue Title**: Indicates the video is in a different window (Pop-out or Dual Monitor mode).

---

## 2. Pro Features & Cloud Verification

YouTube Study Companion now supports cloud-linked account binding.

1.  **Auto Identification**: The system automatically detects the Google account logged into your Chrome browser.
2.  **Unlocking**: Go to **Settings**, click **Activate Pro Features**, and enter the Code provided by the author.
3.  **Sync Persistence**: Once activated, your Pro status is stored in the cloud. It will automatically be recognized on any computer where you are logged into the same Google account.
4.  **Free Version Limits**:
    *   Library capped at 20 saved videos.
    *   Marker groups capped at 20 markers per group.
    *   Locked videos in the Library appear dimmed and unclickable until you upgrade.

---

## 3. Player Controls

At the top of the Player tab, you have full control over video playback.

![Player Controls Screenshot](images/screenshot/v3.0.1/Play-Advance-UI-v3.0.1.png)
*(Suggested Screenshot: Upper part of Player tab, including progress bar and play buttons)*

### Feature Explanation:

*   **Video Status**: Displays the currently detected video title.
    *   **Re-Detect Video (🪄)**: Reconnect the sidebar to the current tab and detect the active video.
    *   **Manage Library Groups (❤️)**: Assign the current video to library groups. Unsaved videos are saved first.
*   **Transport Controls**:
    *   **Restart**: Return to video start.
    *   **-10s / +10s**: Fast rewind or fast forward 10 seconds.
    *   **Play/Pause**: Large central Play/Pause button.
*   **Playback Speed**:
    *   **Collapsible Area**: Click the "Playback Speed" header or chevron to expand/collapse.
    *   **Slider**: Drag slider to finely adjust speed from 0.25x to 3.0x.
    *   **Presets**: Quick buttons (0.5x, 1.0x, 1.5x, 2.0x).

---

## 3. A-B Loop

Designed for language learning or instrument practice, allowing you to repeat specific segments.

![Loop Controls Screenshot](images/loop_controls.png)
*(Suggested Screenshot: A-B Loop area)*

1.  **Expand Section**: Click the "A-B Loop" header to see the controls.
2.  **Set Start (A)**: Play to where you want to start, click the `S` button.
3.  **Set End (B)**: Play to where you want to end, click the `E` button.
4.  **Enable Loop**: Turn on the toggle switch in the header, video will repeat infinitely between A and B.
4.  **Fine Tune**: You can directly modify the time in the input box (format mm:ss).

---

## 4. Smart Markers

Marker function allows you to take notes on the video timeline and jump back at any time.

![Markers Area Screenshot](images/bookmarks.png)
*(Suggested Screenshot: Markers area, including several created markers)*

*   **Add Marker**: Click `+ Add Marker (A)` to create a marker at the current time.
*   **Follow Playback**: Toggle the "Follow" switch to auto-scroll the list to the current marker.
*   **Group Management (Groups)**:
    *   Select group via dropdown menu (e.g., `Default`, `Study`).
*   **[New] Hotkey R**: Press **`R`** to instantly restart the most recently active marker.
*   **Import/Export**: Use the icons in the title bar to back up your data (JSON format).

---

## 5. Group Play & Playlists (New in v3.0)

Group Play allows you to treat All Videos or any Library Group as a sequential playlist.

### How to use:
1.  **Start Group Play**: Go to the **Library** tab, select **All Videos** or a custom group, and click **▶ Play All** or **▶ Play Group**.
2.  **Navigation**: The interface transitions into "Playlist Mode" with a green header. Use the **Prev/Next** buttons (visible only in this mode) to switch videos.
3.  **Automatic Next**: When a video ends, the next one in the group will load automatically.
4.  **Integrated Scraper**:
    *   Open a YouTube or YouTube Music playlist page. You can also use a YouTube Music watch page with a visible queue/list.
    *   Go to **Library -> Manage Groups (Gear icon)**.
    *   Click **Detect & Import YouTube Playlist**.
    *   The extension will scrape visible titles/IDs and create a new group for you.

### YouTube Music Notes
*   Player controls, speed control, A-B Loop, markers, Library groups, and Group Play are supported on YouTube Music playback pages.
*   Imported YouTube Music items are saved with their Music source, so later playback opens in YouTube Music.
*   Playlist import reads the currently visible YouTube Music playlist or queue. If YouTube Music has not loaded all tracks yet, scroll the list first and run detection again.

---

## 5. Library & Groups

This is a powerful feature allowing you to save multiple different "learning contexts" for the **same video**.

![Library Screenshot](images/screenshot/v3.0.1/Library-UI-v3.0.1.png)
*(Suggested Screenshot: Library tab)*

### What is a "Video Favorite"?
When you click the heart icon `❤️` in the title bar, you can save the current video profile and assign it to library groups. You can save multiple profiles for the same video, for example:
*   First save: Focus on "Vocabulary Notes".
*   Second save: Focus on "Grammar Analysis".

### Operation:
*   **All Videos**: The built-in Library group. It lists every saved video profile and sorts them by latest update.
*   **Custom Groups**: User-created groups for focused playlists or study collections.
*   **Default Group**: A built-in group for profiles you mark as default.
*   **[New] Batch Management**: In Edit mode, select multiple items to delete them at once or move them to a different group collectively.
*   **[New] Numerical Index Sorting**: Precisely reorder your items within a custom group by entering the target index number in the sort field. All Videos is sorted by recent update.
*   **Clone Session**: In the Player page, click `Clone` button to copy the current favorite and create a new version.
*   **Set as Default**: Set a favorite as the "Default" for that video; this setting loads automatically next time you open the video.

---

## 7. Keyboard Shortcuts
> [!TIP]
> **Pro Tip**: For the smoothest experience, we strongly recommend using **Keyboard Shortcuts** instead of mouse-clicking the UI. This significantly speeds up your workflow and reduces potential anomalies caused by UI rendering or click delays.

YouTube Study Companion supports a wide range of keyboard shortcuts. Click the **Keyboard Icon (⌨️)** in the title bar to toggle the on-screen guide.

### Basic Controls
*   **Space / K**: Play / Pause.
*   **J / L**: Rewind / Forward (10s).
*   **, / .**: Frame back / forward (When paused).
*   **0-9**: Jump to percentage of video (0%–90%).
*   **M**: Mute / Unmute.
*   **F**: Fullscreen.

### Advanced Looping
*   **`[`**: Set Point A.
*   **`]`**: Set Point B.
*   **`{` (Shift+[)**: Jump to Start A.
*   **`}` (Shift+])**: Toggle A-B Loop.

### Markers & Navigation
*   **A**: Add a new marker at current time.
*   **S**: Toggle "Follow Playback" mode.
*   **R**: Restart the active marker.
*   **Alt+[ / Alt+]**: Prev / Next Video (Only in Group Play mode).
*   **↑ / ↓**: Navigate sequentially through markers.

---

## 8. Local Auto Backup
The extension automatically creates local JSON snapshots on this device every 6 hours and keeps the latest 5 backups.

In **Settings -> Local Data Backup**, you can:
*   Create a local backup immediately.
*   Restore the latest local backup.
*   Export or import a JSON backup manually.

Local auto backups stay on the current device only. Use Export JSON or Cloud Sync when moving data to another computer.

---

## 9. Cross-Device Synchronization
Your settings, bookmarks, and notes are automatically synchronized across all your computers where you use Google Chrome.

**How to enable:**
1.  Sign in to Chrome with the same Google Account on both devices.
2.  Go to `chrome://settings/syncSetup`.
3.  Ensure that **Extensions** is enabled in the "Manage what you sync" section.
4.  The extension will automatically sync your data in the background.

### ⚠️ Manual Sync Enablement (For Developer Mode)
As the extension is not yet published, to sync between different computers, you need to fix your "Extension ID". Please generate your own key through the browser:
1. Compress the project folder into a `.zip` file.
2. Go to the [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole) (Login with Google account).
3. Click "Add new item" and upload your `.zip` file (**Note: You only need to upload; no $5 fee or actual publishing is required**).
4. Once uploaded, navigate to the "Package" tab in the left menu for that item.
5. Click "View public key" to see a long string.
6. Copy this string and paste it into the `"key": "..."` field of your local `manifest.json`.
7. Now, when you load the project on any computer, the ID will remain consistent, and auto-sync will work correctly.

---

> **Note**: While syncing is automatic, it is recommended to use the export function regularly to back up critical data (JSON).
