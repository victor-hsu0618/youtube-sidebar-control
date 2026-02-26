# Changelog

**English** | [繁體中文](CHANGELOG.zh-TW.md)

All notable changes to the **YouTube Study Companion** project will be documented in this file.

## [3.0.1-beta] - 2026-02-26
### Added
- **Group Management (New UI)**: Explicitly separated Favorites into "Manage Groups" and "Group Play".
- **Numerical Sorting**: Reorder favorite items precisely by entering index numbers in the sort field.
- **Batch Actions**: Added checkboxes to Library and Favorites for bulk deletion/movement.
- **Visual Polish**: Replaced all old screenshots with high-resolution v3.0.1 versions.

### Fixed
- **UI Layout (v3.0.1)**: Speed controls are now correctly hidden during Group Play mode.
- **Storage Sync**: Fixed desync issues when reordering items across multiple groups.

## [3.0.0-beta] - 2026-02-13
### Added
- **Group Play (Playlist Mode)**: Automatic sequential playback of all videos within a Favorite Group.
- **Playlist Scraper**: One-click detection and import of entire YouTube playlists into Favorite Groups.
- **Zero-Latency Interaction**: Hybrid architecture using `chrome.storage.session` for instant UI feedback (<5ms).
- **Favorites Management**: Dedicated button (Heart icon) to categorize videos into custom groups.
- **Profile Defaulting**: New button (Star icon) to set specific sessions as the auto-load default for a video ID.
- **Hotkeys**: Added `R` to restart current marker and `Alt+[ / ]` for playlist navigation.

### Changed
- **UI Redesign**: 
    - **Stacked Meta Bar**: Video title now supports 3-line display and full width.
    - **Icon Semantics**: Folder icon now represents Library (Storage); Heart icon represents Favorites (Grouping).
    - **Enlarged Shortcut Guide**: Modal expanded for easier reading.
- **Playlist UI**: Added green glow and "Group Play Mode" banner for visual focus.

## [2.5.1] - 2026-02-03
### Added
- **Known Issues List**: Created bilingual `docs/KNOWN_ISSUES.md` to document Play/Pause lag, sync limitations, and lifecycle issues.
- **Manual Sync Instructions**: Added step-by-step guide in User Manual for manual API Key generation to enable cross-device sync in developer mode.
- **Hotkey Recommendations**: Added pro-tips to User Manual encouraging keyboard shortcuts for better speed and stability.

### Changed
- **Speed Control Optimization**: Adjusted speed increment to 5% (0.05x) for finer playback control.
- **CSS Compatibility Fixes**: Defined standard properties for `line-clamp` in `sidebar.css` and `background-clip` in `landing.css` to improve browser compatibility.
- **Window Interaction**: Improved logic for switching between the sidebar and the pop-out window.

## [2.5.0] - 2026-02-01
### Added
- **Promotional Website**: Launched a landing page in `docs/` for GitHub Pages hosting.
- **Project Renaming**: Officially renamed from "YouTube Sidebar Control" to **"YouTube Study Companion"** to better reflect its educational focus.

### Changed
- **UI Polish**: Updated marker input fields to have a clear focus state and improved readability (White text on transparent background).
- **Play/Pause Responsiveness**: Switched event handling to "bubbling phase" to eliminate click delays.

## [2.4.0] - 2026-01-31
### Added
- **Marker Navigation**: New hotkeys `ArrowUp` / `ArrowDown` to navigate through markers without losing focus.
- **Time Update Optimization**: Increased UI refresh rate to 150ms for smoother progress tracking.

### Fixed
- **Marker Desync**: Fixed a critical bug where marker timestamps would drift from the actual video time.
- **Click Lag**: significantly reduced the "Command Guard" delay from 400ms to 200ms.

## [2.3.0] - 2026-01-30
### Added
- **Global Hotkeys**: Added `Alt+Shift+A` (Add Marker) and `Alt+Shift+P` (Play/Pause).
- **Video Detection**: Added a "Detect Video" button for troubleshooting connection issues.

### Changed
- **Messaging System**: Refactored the message passing between Sidebar and Content Script for 3x better reliability.

## [2.0.0] - 2026-01-20
### Initial Release
- **Core Features**: Sidebar UI, AB Looping, Bookmarks, Speed Control.
