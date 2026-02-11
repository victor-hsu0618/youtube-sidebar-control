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
- **Global Search**: Find that one concept you learned months ago across all your video notes.

**4. Distraction-Free Sidebar**
- All tools live in a sleek, dark-mode sidebar that doesn't clutter the video player.
- Resize and toggle visibility as needed.

**🔐 Pro Features (Optional)**
- **Unlimited Library Videos**: Save more than the 10-video limit of the Free version.
- **Unlimited Markers**: Remove the 10-marker per group limit for detailed study.
- **Cloud Sync**: Sync your notes and markers across all your devices (Chrome Identity integration).
- Support potential future updates!

---
**Privacy Assurance:**
We value your privacy. Your notes are yours. We collect your email address ONLY to verify your Pro license status and enable cross-device sync. We do not track your browsing history outside of YouTube.
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
