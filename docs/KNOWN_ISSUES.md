# Known Issues

**English** | [繁體中文](KNOWN_ISSUES.zh-TW.md)

This document records the currently known issues, limitations, and suggested workarounds for **YouTube Study Companion**.

## Current Known Issues

### 1. Play/Pause Button Lag after Switching Videos
*   **Description**: For the first few seconds after switching to a new video, clicking the Play/Pause button in the sidebar might be unresponsive.
*   **Affects**: Player Controls
*   **Temporary Workaround**: Keyboard shortcuts `Space` or `K` remain functional. Alternatively, wait 2–3 seconds before clicking.

### 2. Pop-out Window Lifecycle Issues
*   **Description**: When closing the Pop-out Window, if the original browser tab has navigated away from YouTube, the extension may fail to automatically restore the sidebar.
*   **Affects**: Pop-out Window / Sidebar Synchronization
*   **Temporary Workaround**: Manually return to a YouTube video page and click the extension icon in the browser toolbar to re-open the sidebar.

### 3. Synchronization Restrictions Across Browsers (Sync Key Issue)
*   **Description**: Since the extension is not yet published on official browser stores, the default `manifest.json` does not include an official API Key. As a result, the automatic synchronization feature between different browsers or devices is not active by default.
*   **Affects**: Cross-Device Sync
*   **Solution**: Users must manually configure their own API Key in `manifest.json`, or wait for the officially published version.

---

## Fixed or Limitations

### 1. Chrome Extension Sync Delay
*   **Description**: Due to Chrome Sync API limitations, synchronization across devices may have a delay of several seconds to a few minutes.
*   **Status**: This is a browser platform limitation. We recommend waiting a moment or refreshing the page after switching devices.

### 2. Failure due to YouTube UI Changes
*   **Description**: Frequent updates to the YouTube interface may cause the sidebar to fail to detect the video correctly.
*   **Status**: We will continue to monitor and update the code. If this occurs, please try clicking the **Detect Video (🪄)** button in the title bar.
