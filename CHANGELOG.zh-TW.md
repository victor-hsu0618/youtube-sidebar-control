# 更新日誌 (Changelog)

[English](CHANGELOG.md) | **繁體中文**

**YouTube Study Companion** 專案的所有重要更新紀錄。

## [2.5.1] - 2026-02-03
### 新增 (Added)
- **已知問題列表**: 建立 `docs/KNOWN_ISSUES.md` (中英雙語)，紀錄 Play/Pause 延遲、同步限制等已知事項。
- **同步手冊更新**: 在使用手冊中加入手動產生 API Key 的詳細步驟，以達成開發環境下的跨裝置同步。
- **專業操作建議**: 於使用手冊中加入使用快捷鍵的專業建議 (Hotkey Recommendation)，提升操作效率。

### 變更 (Changed)
- **速度控制優化**: 將播放速度的調整間隔細分至 5% (0.05x)，提供更精確的控制。
- **CSS 相容性修正**: 修復了 `sidebar.css` 中的 `line-clamp` 與 `landing.css` 中的 `background-clip` 標準屬性定義，提升瀏覽器相容性。
- **視窗互動優化**: 改善了側邊欄與浮動視窗 (Pop-out) 切換時的行為邏輯。

## [2.5.0] - 2026-02-01
### 新增 (Added)
- **宣傳網站**: 於 `docs/` 建立 Landing Page 供 GitHub Pages 託管。
- **專案更名**: 正式從 "YouTube Sidebar Control" 更名為 **"YouTube Study Companion"** 以符合教育學習用途。

### 變更 (Changed)
- **介面優化**: 改善 Marker 輸入框樣式，新增聚焦狀態並提升可讀性（透明背景 + 白色文字）。
- **播放/暫停反應速度**: 將事件處理改為 "bubbling phase"，徹底消除點擊延遲。

## [2.4.0] - 2026-01-31
### 新增 (Added)
- **Marker 導航**: 新增 `ArrowUp` / `ArrowDown` 快捷鍵，可在不失焦的情況下快速切換 Marker。
- **時間更新優化**: 將 UI 更新率提升至 150ms，進度條更流暢。

### 修正 (Fixed)
- **Marker 同步問題**: 修正 Marker 時間戳記與實際影片時間不同的重大 Bug。
- **點擊延遲**: 將 "Command Guard" 延遲從 400ms 大幅降至 200ms。

## [2.3.0] - 2026-01-30
### 新增 (Added)
- **全域快捷鍵**: 新增 `Alt+Shift+A` (新增 Marker) 與 `Alt+Shift+P` (播放/暫停)。
- **影片偵測**: 新增 "Detect Video" 按鈕以排除連線問題。

### 變更 (Changed)
- **訊息系統**: 重構 Sidebar 與 Content Script 間的訊息傳遞機制，可靠性提升 3 倍。

## [2.0.0] - 2026-01-20
### 首次發布 (Initial Release)
- **核心功能**: 側邊欄 UI、AB 循環播放、書籤標記、速度控制。
