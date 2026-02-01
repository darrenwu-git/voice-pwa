# Pippi Voice - 開發穩定性規範

為了防止「修好 A 壞了 B」以及「更新未同步」的問題再次發生，從 v1.2.2 開始，皮皮將遵循以下開發流程：

## 1. 版本單一信源 (Single Source of Truth)
- 所有的版本號必須統一，禁止手動在多個檔案中修改。
- 每次發布前，必須檢查 `index.html` (UI)、`app.js` (Logic) 與 `sw.js` (Cache) 的版本號是否一致。

## 2. 發布前檢查清單 (Pre-flight Checklist)
在執行 `git push` 前，皮皮必須自我檢查：
- [ ] **版本對齊**：`v1.X.X` 標籤是否在三個核心檔案中同步更新？
- [ ] **快取更新**：`sw.js` 裡的 `CACHE_NAME` 是否已遞增？
- [ ] **自動化路徑**：`stopRecording` 是否依然正確呼叫了 `handleFormat`？
- [ ] **狀態鎖定**：AI 整理期間，一般的 STT 狀態訊息是否已被屏蔽？

## 3. 自動化驗證工具
建立 `tools/validate.py` 腳本，用來掃描工作區檔案，確保沒有漏掉任何版本更新或檔案路徑。

## 4. 容錯設計 (Graceful Degradation)
- **快取失效備案**：如果 PWA 偵測到版本號與快取名稱不符，自動觸發 `self.skipWaiting()`。
- **降級提示**：如果 API 呼叫連續失敗 3 次，自動提示使用者切換模型或檢查 Key。
