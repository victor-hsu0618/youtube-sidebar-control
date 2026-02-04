[English](README.md) | [繁體中文](README.zh-TW.md)

# YouTube Study Companion v2.6.5

專業的 YouTube 播放控制與學習工具。將您的 YouTube 體驗轉變為強大的學習和筆記工作站。

📖 **[閱讀使用手冊](docs/USER_MANUAL.zh-TW.md)** | ⚠️ **[已知問題列表](docs/KNOWN_ISSUES.zh-TW.md)** | 📺 **[觀看產品簡報](https://youtube-study-companion-2azj231.gamma.site/)**

## 📥 安裝說明

本專案是一個瀏覽器擴充功能 (Browser Extension)，目前支援 Chrome 與 Edge 瀏覽器。請依下列步驟以開發者模式安裝：

1. **取得程式碼**
   
   下載此專案的 ZIP 檔並解壓縮，或是使用 Git Clone：
   ```bash
   git clone https://github.com/victor-hsu0618/youtube-sidebar-control.git
   ```

### 📦 安裝步驟 (建議)
1. **下載儲存庫**：點擊綠色的 "Code" 按鈕並選擇 **Download ZIP**。
2. **下載預先打包的擴充功能**：或者，您可以直接下載位於儲存庫根目錄的 [youtube-study-sidebar-v2.6.5.zip](youtube-study-sidebar-v2.6.5.zip)。
3. **解壓縮 ZIP**：在您的電腦上解壓縮該檔案。
4. **載入至 Chrome**：
   - 開啟 Chrome 並進入 `chrome://extensions/`
   - 開啟右上角的 **開發者模式** (Developer mode)。
   - 點擊 **載入未打包項目** (Load unpacked) 並選擇解壓縮後的資料夾。

## 🌟 主要功能

### 1. 🎛️ 進階播放控制
- **雙面板工作區**：專用的 **Markers (標記)** 與 **Advanced (進階)** 子分頁，最大化垂直空間。
- **摺疊式控制面板**：乾淨的介面，速度與循環區塊皆可摺疊收納。
- **整合式 A-B 循環**：直接在進度條上顯示 **A/B 視覺標記**，可精確設定循環起點與終點。
- **精確速度控制**：摺疊式滑桿調整 (0.25x 至 3.0x)。

### 2. 💎 Pro 雲端驗證系統 (新功能)
- **帳戶綁定**：系統會自動識別您的 Google 帳戶 Email。
- **雲端授權**：透過 Google Sheets 後端管理，權限跟隨帳號，換電腦也無需重設。
- **啟用序號**：輸入由作者提供的 Activation Code 即可一鍵解鎖進階功能。

### 3. 🔖 智慧標記
- **時間戳記筆記**：在影片任何時刻新增標記。
- **立即跳轉**：點擊標記即可精確跳轉至該時間點。
- **標記追隨 (Follow)**：自動捲動功能，確保當前標記始終可見。

### 4. 💾 影片庫與感官限制
- **影片收藏**：儲存多部影片的工作階段（標記、循環點）。
- **免費版限制**：免費版可儲存最多 **10 部影片**與每組 **10 個標記**。
- **感官限制**：超過上限的影片仍會顯示在清單中，但會以**半透明鎖定**狀態呈現，提醒您升級 Pro 以解鎖。

### 5. 🪟 浮動視窗與診斷
- **多螢幕支援**：將側邊欄彈出為獨立視窗。
- **進階診斷**：在 Advanced 分頁中內建雲端同步刷新與儲存空間監控。

## 🛠️ 使用方式

1. **開啟**：在 YouTube 頁面點擊 extension 圖示。
2. **控制**：使用 **Advanced** 標籤調整速度和診斷系統。
3. **儲存**：點擊愛心圖示將當前影片加入您的影片庫。
4. **升級**：在 **Advanced** 標籤中點擊 **Activate Pro Features** 並輸入 Code。

## 📝 注意事項

本 extension 支援完整的鍵盤快捷鍵操作。點擊標題列的 **鍵盤圖示** 即可查看完整的 **快捷鍵指南**。
