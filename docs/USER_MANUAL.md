# User Manual: YouTube Studio Sidebar

歡迎使用 YouTube Studio Sidebar！本指南將協助您熟悉這個擴充功能的所有功能，讓您在 YouTube 上擁有更強大的學習與控制體驗。

**提示**：為了達到最佳閱讀體驗，建議您可以將實際操作畫面截圖後，替換本文中的圖片佔位符。

---

## 📖 目錄

1.  [介面總覽 (Interface Overview)](#1-介面總覽-interface-overview)
2.  [播放控制 (Player Controls)](#2-播放控制-player-controls)
3.  [A-B 循環 (A-B Loop)](#3-a-b-循環-a-b-loop)
4.  [智慧標籤 (Smart Bookmarks)](#4-智慧標籤-smart-bookmarks)
5.  [影片庫與多設定檔 (Library & Profiles)](#5-影片庫與多設定檔-library--profiles)
6.  [浮動視窗 (Pop-out Window)](#6-浮動視窗-pop-out-window)

---

## 1. 介面總覽 (Interface Overview)

啟動 Extension 後，您會看到主畫面。側邊欄設計簡潔，主要分為三個分頁：

*   **Player (播放器)**：主要的操作區域，包含播放控制、速度調整、循環與標記 (Markers)。
*   **Library (影片庫)**：檢視所有您儲存過設定檔的影片歷史紀錄。
*   **Favorites (我的最愛)**：快速存取您標記為「星號/預設」的常用設定檔。

![介面總覽截圖](images/interface_overview.png)
*(建議截圖：開啟 Sidebar 後的完整畫面)*

上方標題列右側有一個 **↗️ 箭頭按鈕**，點擊可將視窗獨立出來（Pop-out）。

---

## 2. 播放控制 (Player Controls)

在 Player 分頁的最上方，您可以完全掌控影片播放。

![播放控制區截圖](images/player_controls.png)
*(建議截圖：Player 分頁上半部，包含進度條與播放按鈕)*

### 功能說明：

*   **Video Status**: 顯示目前偵測到的影片標題。
    *   **Auto Detect (🪄)**: 若未偵測到影片，點擊此按鈕重新偵測。
    *   **Save/Heart (❤️)**: 點擊愛心圖示，將目前影片的設定（標記、循環點）儲存到影片庫。
*   **Transport Controls**:
    *   **Restart**: 回到影片開頭。
    *   **-10s / +10s**: 快速倒退或快進 10 秒。
    *   **Play/Pause**: 中央的大型播放/暫停按鈕。
*   **Playback Speed (速度控制)**:
    *   **Slider**: 拖曳滑桿可從 0.25x 到 3.0x 精細調整速度。
    *   **Presets**: 快速按鈕 (0.5x, 1.0x, 1.5x, 2.0x)。

---

## 3. A-B 循環 (A-B Loop)

專為語言學習或樂器練習設計，讓您重複播放特定片段。

![循環控制截圖](images/loop_controls.png)
*(建議截圖：A-B Loop 區域)*

1.  **設定起點 (A)**：播放到想要開始的地方，點擊 `📍` 按鈕。
2.  **設定終點 (B)**：播放到想要結束的地方，點擊 `🏁` 按鈕。
3.  **開啟循環**：打開右上角的開關 (Toggle Use Loop)，影片將在 A 與 B 之間無限重複。
4.  **微調**：您可以直接在輸入框修改時間 (格式 mm:ss)。

---

## 4. 智慧標記 (Smart Markers)

標記功能讓您在影片的時間軸上做筆記，並隨時跳轉回去。

![標記區域截圖](images/bookmarks.png)
*(建議截圖：Markers 區域，包含幾個已建立的標記)*

*   **新增標記**：點擊 `+ Add "Now" to Current Marker Group`，即可在當下時間點建立標記。
*   **分組管理 (Groups)**：
    *   透過下拉選單選擇分組（例如：`Default`, `Study`）。
    *   不同性質的筆記可以分開存放。
*   **點擊跳轉**：點擊列表中的標記，影片會立刻跳轉到該時間點。
*   **匯入/匯出**: 使用上方的下載/上傳圖示，備份您的標記資料 (JSON 格式)。

---

## 5. 影片庫與多設定檔 (Library & Profiles)

這是一個強大的功能，允許您為**同一部影片**儲存多個不同的「學習情境」。

![影片庫截圖](images/library.png)
*(建議截圖：Library 分頁)*

### 什麼是「影片設定檔 (Profile)」？
當您點擊標題列的愛心圖示 `❤️` 時，您實際上是儲存了一個「設定檔」。您可以為同一部影片儲存多次，例如：
*   第一次儲存：專注於「單字筆記」。
*   第二次儲存：專注於「文法分析」。

### 操作方式：
*   **Library 分頁**：列出所有儲存過的影片。
*   **Favorites 分頁**：只顯示您標記為「星號」的設定檔。
*   **Clone Session**: 在 Player 頁面，點擊 `Clone` 按鈕可以複製當前的設定檔，建立一個新版本。
*   **Set as Default**: 將某個設定檔設為該影片的「預設值」，下次打開該影片時會自動載入此設定。

---

## 6. 浮動視窗 (Pop-out Window)

如果您使用雙螢幕，或希望控制面板獨立於瀏覽器之外，請使用此功能。

1.  點擊標題列右側的 **Pop-out 圖示 (↗️)**。
2.  側邊欄會轉變為一個獨立的小視窗。
3.  **即時同步**：您在浮動視窗的操作，會與原來的側邊欄完全同步。

---

> **Note**: 本擴充功能所有資料皆儲存在您的瀏覽器本地端 (Local Storage)，請定期使用匯出功能備份重要資料。
