# 跨電腦開發設置指南 (Cross-Device Development Setup)

若要在新電腦上繼續開發 **YouTube Study Companion**，請按照以下步驟進行設置。

## 1. 取得原始碼 (Clone Repository)

首先，將專案從 GitHub 下載到新電腦：

```bash
git clone https://github.com/victor-hsu0618/youtube-sidebar-control.git
cd youtube-sidebar-control
# 切換到當前的開發分支 (例如 3.0.Beta)
git checkout 3.0.Beta
```

## 2. 載入至 Chrome 瀏覽器

1. 打開 Chrome 瀏覽器，進入 `chrome://extensions/`。
2. 開啟右上角的 **「開發者模式」(Developer mode)**。
3. 點擊 **「載入解壓縮的小工具」(Load unpacked)**。
4. 選擇專案所在的資料夾（包含 `manifest.json` 的那個）。

## 3. 重要：維持一致的 Extension ID (同步功能所需)

由於許多功能（如 Chrome Storage Sync）與 Extension ID 綁定，如果您希望在不同電腦上使用相同的設置或同步數據，您需要確保兩台電腦上的 Extension ID 一致。

### 方法：手動設定 Key

1. 在原電腦的 `manifest.json` 中找到 `"key"` 欄位（如果有的話）。
2. 如果沒有，您需要從 `.pem` 檔案中提取，或者使用目前已載入擴充功能的 ID。
3. 如果是在開發環境，建議在 `manifest.json` 中包含 `"key"` 屬性。這樣無論在哪台電腦載入，生成的 Extension ID 都會維持相同。

## 4. 同步與資料庫

*   **雲端同步**：專案使用了 `chrome.storage.sync`。只要您在 Chrome 登入相同的 Google 帳號，擴充功能的設定（如 `followMarkers`）會自動同步。
*   **本地資料**：影片的標記 (Markers) 通常儲存在 `chrome.storage.local` 或 `.json` 檔案中。您可以透過 UI 中的 **Export (匯出)** 功能在新舊電腦間轉移數據。

## 5. 打包發布 (Packaging)

在新電腦上修改完代碼後，可以使用附帶的腳本進行打包：

```bash
# 給予執行權限
chmod +x package.sh package-store.sh

# 執行打包 (會產生 YouTubeStudyCompanion.zip)
./package.sh
```

## 6. 常見問題排除

*   **分頁未連接**：在新電腦上安裝後，請務必重新整理 (F5) 已經打開的 YouTube 分頁，這樣 `content.js` 才能重新注入並與側邊欄連線。
*   **權限問題**：如果遇到腳本無法執行，請確認您有該目錄的讀寫權限。
