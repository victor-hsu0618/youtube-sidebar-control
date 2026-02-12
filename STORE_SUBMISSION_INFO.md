# Chrome Web Store Submission Guide (YouTube Study Companion)

這份文件整理了上架 Chrome Web Store 時需要填寫的各項資訊，請直接複製貼上或參考使用。

---

## 1. Store Listing (商店資訊)

### Extension Name (擴充功能名稱)
`YouTube Study Companion`

### Summary (短摘要)
**限制：132 個字元以內**
> Transform YouTube into a powerful learning tool with A-B looping, timestamped notes, and precision speed control.
> (將 YouTube 轉變為強大的學習工具，即刻擁有 A-B 循環播放、時間戳記筆記及精準速度控制。)

### Description (詳細描述)
**支援 Markdown 語法**

```markdown
Transform YouTube into your ultimate learning station. Designed for serious learners, musicians, and language students who need more than just a play button.

🚀 **Key Features:**

**1. Precision Playback Control**
- Fine-tune playback speed with 0.1x increments.
- Frame-by-frame seeking (Next/Prev frame) for detailed analysis.
- Custom hotkeys (WASD) for gaming-like control efficiency.

**2. Professional A-B Looping**
- Instantly set Start (A) and End (B) points to loop complex sections.
- Perfect for learning guitar riffs, dance moves, or practicing language pronunciation.
- One-click clear loop to resume normal flow.

**3. Smart Notes & Timestamped Bookmarks**
- Inspiration strikes fast! Add notes with automatic timestamps without stopping the video.
- Click any note to jump exactly to that moment in the video.
- **Video-Specific Focus**: Notes are context-aware and tied to specific videos for organized learning.

**4. Distraction-Free Sidebar**
- All tools live in a sleek, dark-mode sidebar that doesn't clutter the video player.
- Resize and toggle visibility as needed.

**🔐 Pro Features (Optional)**
- **Extended Library**: Save more than the 10-video limit of the Free version.
- **Extended Markers**: Increase marker capacity per group for detailed study.
- Support potential future updates!

---
**Privacy Assurance:**
We value your privacy. Your notes are yours. We collect your email address ONLY to verify your Pro license status and enable cross-device sync. We do not track your browsing history outside of YouTube.
```

### 中文詳細描述 (Chinese Description)
```markdown
將 YouTube 打造為您的終極學習工作站。專為深度學習者、音樂家、語言學生及任何追求效率的使用者設計。

🚀 **核心功能：**

**1. 專業級播放控制**
- 以 0.1x 為單位精細調整播放速度。
- 支援「逐幀前進/後退」，方便進行細節分析。
- 鍵盤快速鍵 (WASD) 操作模式，像玩遊戲一樣高效控制影片。

**2. A-B 循環播放 (AB Loop)**
- 瞬時設定起點 (A) 與終點 (B)，重複播放難點片段。
- 學習樂器、練習語言發音、或分析舞蹈動作的絕佳工具。
- 一鍵清除循環，恢復正常播放流程。

**3. 智慧筆記與時間戳記書籤**
- 靈感稍縱即逝？無需暫停影片即可快速記下帶有時間戳記的筆記。
- 點擊任何筆記，影片會立即跳轉回當時的正確時刻。
- **影片獨立管理**：筆記會與特定影片連結，學習路徑井然有序。

**4. 無干擾側邊欄**
- 所有工具都整合在精緻的暗色調側邊欄中，完全不遮擋影片播放面板。
- 支援調整視窗大小與獨立彈出（Pop-out）功能。

**🔐 Pro 進階功能 (可選)**
- **擴充影片庫**：解除免費版 10 部影片的儲存限制。
- **擴充標記數量**：增加每組標記的容量，滿足高強度筆記需求。
- 支持開發者持續維護與功能開發！

---
**隱私承諾：**
我們重視您的隱私，您的筆記屬於您。我們僅收集 Email 地址用於驗證您的 Pro 授權狀態並支援跨裝置同步。我們絕不會追蹤您在 YouTube 以外的瀏覽紀錄。
```

### Category (類別)
建議選擇：
- **Primary**: `Productivity` (生產力工具)
- **Secondary**: `Education` (教育)

### Language (語言)
`English` (建議設為預設，增加國際曝光) 或 `Chinese (Traditional)`

---

## 2. Graphic Assets (圖片素材)

上架時必須上傳以下圖片 (請確保您已準備好這些檔案)：

| 類型 | 尺寸 (px) | 說明 |
| :--- | :--- | :--- |
| **Store Icon** | 128 x 128 | 商店顯示的小圖示 (PNG, 無透明度) |
| **Marquee Promo Tile** | 440 x 280 | **必要**。小型推廣圖，會顯示在推薦牆上。 |
| **Screenshots** | 1280 x 800 (建議) | 至少 1 張，最多 5 張。展示實際操作畫面 (如 A-B Loop, Notes 介面)。 |
| **Promo Tile (Large)** | 920 x 680 | *非必要*，但建議上傳，用於商店精選推薦。 |

---

## 3. Privacy (隱私權設定)

### Privacy Policy URL (隱私權政策連結)
您必須提供我們託管在 GitHub Pages 的連結：
`https://victor-hsu0618.github.io/youtube-sidebar-control/docs/privacy.html`

### Pricing Page URL (訂閱方案連結 - 僅供參考)
`https://victor-hsu0618.github.io/youtube-sidebar-control/docs/pricing.html`

### Permissions Justification (權限使用說明)

Google 會要求解釋為什麼需要以下權限，請參考以下寫法：

**1. `identity` & `identity.email`**
> "We use the identity API and email permission solely to identify the user for two purposes: 1) To verify if the user has a valid 'Pro' subscription license via our verification server. 2) To serve as a unique ID for syncing their notes and bookmarks across multiple devices. We do not use this for marketing or share it with third parties."

**2. `storage`**
> "Used to save user preferences (like playback speed settings) and cache their video notes locally for offline access and faster load times."

**3. `sidePanel`**
> "This is the core UI of the extension. All controls (Notes, Loop, Speed) are rendered within the browser's side panel to avoid obstructing the video player content."

**4. `scripting` / `activeTab`**
> "Used to inject the video control scripts into the YouTube player page to enable speed manipulation and time seeking functions."

### Data Usage (數據使用勾選)
在 "Privacy" 標籤頁的 "Data usage" 區塊：

1.  **Personally identifiable information**: 勾選 ✅ **Email address**。
    -   用途勾選：✅ **App functionality** (應用程式功能), ✅ **Account management** (帳戶管理)。
2.  **Website content**: 勾選 ✅ **Website content** (因為會讀取當前 YouTube 網址/標題)。
    -   用途勾選：✅ **App functionality**。

---

## 4. Distribution (發行與收費)

### Paid or Free? (付費或免費)
因為您是採用「App 內驗證 (In-App Verification)」而非 Chrome 內建支付：

-   選擇：**Free** (免費)
-   必須勾選：✅ **Offers in-app purchases** (提供應用程式內購買) 或 **Subscriptions**。
    -   *注意：若未勾選此項但實際有收費牆，可能會被下架。*

### Visibility (能見度)
-   選擇：**Public** (公開) - 所有人都能搜尋並安裝。

---

## 5. 上架流程檢查清單

1.  [ ] 備份金鑰：確認 `manifest.json` 沒有包含 `key` (如果是新發佈)，或者包含固定的 `key` (如果是更新)。(您目前的 `package-store.sh` 已經處理了這點)。
2.  [ ] 打包：執行 `./package-store.sh` 產生 `YouTubeStudyCompanion_Store.zip`。
3.  [ ] 上傳：將 ZIP 檔上傳至 Chrome Developer Dashboard。
4.  [ ] 填寫：填入上述 Store Listing 資訊。
5.  [ ] 圖片：上傳 Icon, Screenshots, Promo Tiles。
6.  [ ] 送審：按 "Submit for Review"。

---

## 6. Single Purpose (單一用途說明)

**推薦填寫英文以利全球審核：**

> "The single purpose of YouTube Study Companion is to provide a dedicated, distraction-free interface for video-based learning on YouTube. It achieves this by consolidating professional playback tools—specifically fine-grained speed control (0.1x increments), A-B loop repetition, and timestamped personal notes—into a single, integrated sidebar. Unlike general toolkits, every feature within this extension is strictly designed to help users dissect and review educational content more efficiently. By localizing all controls in the sidebar, it ensures that students, musicians, and language learners can interact with the video information without ever covering the video player itself, thereby maintaining a continuous and effective study flow."

---

## 7. 常見問題與審核注意事項 (FAQ & Review Notes)

### Q: 為什麼 Chrome Store 顯示「已更新：1970年1月1日」？
**原因：** 這是 Unix 紀元 (Unix Epoch) 的起點。當數據遺失、尚未同步或欄位為空值時，系統會預設顯示為 0。
*   這是 **Google 系統端** 的問題，通常發生在剛上傳或審核中。
*   **解決方案：** 無需處理，審核通過後系統會自動更新為正確的日期。

### Q: 如何管理測試人員與進行測試？

如果您希望使用 Chrome 線上應用程式商店的官方測試功能（需等待初次審核通過後）：

#### 1. 設定受信任的測試人員名單 (Trusted Testers)
*   **位置**：登入 [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole/) -> 點擊左側選單的「**Account (帳戶)**」。
*   **設定**：在「**Management (管理)**」分頁中，找到「**Trusted tester accounts**」。
*   **操作**：在此處輸入測試人員的 Google Email 帳號（多個帳號用逗號隔開），或使用 Google Groups。
*   **注意**：這份名單是**帳號層級**的，您所有的擴充功能都可以共享這份測試名單。

#### 2. 將擴充功能發佈給測試人員
*   **位置**：進入擴充功能的管理頁面 -> 點擊「**Distribution (發佈)**」。
*   **Visibility (能見度)** 選擇：
    *   **Private (私下)**：只有您在第一步設定的名單可以看到並安裝。
    *   **Unlisted (不公開)**：只要有連結的人就能安裝，但不會在商店搜尋結果中出現。
*   **提醒**：**初次發佈**（無論是公開、私下或不公開）**都必須經過 Google 人工審核**。

#### 3. 審核期間的緊急測試方案 (不需經過 Google)
如果您在等待審核時，急需讓測試人員看到功能，請使用此方案：
*   **步驟**：
    1. 將包裝好的 Source Code 資料夾（含 `manifest.json`）壓縮傳給測試人員。
    2. 測試人員解壓縮後，至 `chrome://extensions/` 開啟「**開發人員模式**」。
    3. 點擊「**載入解壓縮 (Load unpacked)**」，並選取該資料夾。
*   **優點**：完全繞過審核，即改即測。
