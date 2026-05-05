# Paird Git History Panel 設計文件

> 目標：把 `git log` 從即時 `Agent Output` terminal 分流，改為可回頭查閱、可累積、可展開的歷史紀錄視圖
> 驗收：點擊 `GitPanel` 的 `Log` 後，不再把結果寫進 terminal；中央主區可切到 `Git History` tab，看到每次查詢累積成一筆可展開紀錄
> 日期：2026-04-30

---

## 1. 範圍

這份設計文件只處理 `git log` 的顯示位置與資料流調整，不重做整體 Week 3 版面，也不處理完整 git domain 重構。

**包含：**
- 中央主區從單一 `Agent Output` 改為 `Agent Output | Git History` 雙 tab
- `git log` 結果從 `terminal:output` 分流
- `Git History` 的 client state、socket event、UI 結構
- 累積式歷史紀錄模型，每次查詢新增一筆可展開紀錄
- 基本測試覆蓋

**不包含：**
- `git diff` 一併搬移到 `Git History`
- 任意搜尋、篩選、釘選、刪除歷史紀錄
- 多 repository 或多 session 歷史隔離策略變更
- 永久化儲存到資料庫或檔案系統

---

## 2. 問題定義

目前 `GitPanel` 的 `Log` 按鈕會觸發 `git:action('log')`，server 執行後把輸出透過 `terminal:output` 廣播到中央 `TerminalPanel`。這造成兩個問題：

- `git log` 和 agent stdout/stderr 混在同一條 stream，破壞 `Agent Output` 的即時可讀性
- `git log` 是可回查的歷史資料，不是短暫的即時輸出；terminal 串流不適合承載這類資訊

因此需要把 `git log` 重新定位成「主工作區中的歷史資料視圖」，而不是 terminal 的附屬輸出。

---

## 3. 設計目標

- 保持 `Agent Output` 專注於 agent / terminal 即時串流
- 讓 `git log` 變成可回頭查閱的結構化內容
- 每次查詢都保留，不覆蓋前一次結果
- 讓 UI 能直接根據結構化資料渲染，不必從原始 terminal 字串反推內容
- 讓未來 `git diff` 若要分流時，可以沿用同一套歷史紀錄模型

---

## 4. 方案比較

### 4.1 推薦方案：中央主區雙 tab

中央主區改為兩個 tab：
- `Agent Output`
- `Git History`

`Agent Output` 保持現在的 xterm terminal。
`Git History` 承接每次 `git log` 的結構化查詢結果，按時間倒序顯示。

為何推薦：
- 中央主區本來就是詳細內容區，最適合承載長文本歷史資料
- 不壓縮左側 `GitPanel`，維持它作為摘要與操作入口的角色
- 將即時串流與歷史資料分離，資訊架構最清楚

### 4.2 不採用方案

**放進左側 `GitPanel`：**
寬度不足，長 commit message 與多筆紀錄的可讀性差，會把左欄從摘要區變成內容區。

**放進右側 chat 區：**
會與 chat 爭奪垂直空間，也混淆「團隊訊息」與「git 查詢結果」兩種不同資料型別。

**繼續留在 terminal：**
雖然改動最小，但沒有解決核心問題，也無法支援累積式、可展開的歷史閱讀模式。

---

## 5. UI 設計

### 5.1 主工作區結構

目前：

```text
Main Workspace
  -> Agent Output terminal
```

調整後：

```text
Main Workspace
  -> WorkspaceTabs
      -> Agent Output
      -> Git History
```

原則：
- 預設 tab 仍是 `Agent Output`
- 使用者手動切到 `Git History` 後，切換狀態保留在 client store
- 若新的 `git log` 紀錄進來，不強制搶焦點切 tab，避免打斷 driver 正在看 terminal

### 5.2 `Git History` 視圖

`Git History` 顯示為可捲動列表，最新一筆在最上面。

每筆紀錄是一張可展開卡片，預設顯示：
- 查詢時間
- 類型：本階段固定為 `log`
- 實際命令：`git log --oneline -10`
- 簡短摘要

展開後顯示：
- 完整原始輸出

互動原則：
- 新增紀錄時，最新一筆預設展開
- 舊紀錄維持原本展開/收合狀態
- 若沒有任何紀錄，顯示空狀態提示，例如「Run Git Log to view commit history here.」

### 5.3 `GitPanel` 角色

左側 `GitPanel` 維持：
- branch
- 檔案變更摘要
- `Diff` / `Log` / `Commit` 操作

它不再承載 `git log` 大段內容，只作為操作入口。

---

## 6. 資料模型

新增 `GitHistoryItem`：

```typescript
export interface GitHistoryItem {
  id: string
  kind: 'log'
  command: string
  summary: string
  content: string
  createdAt: string
}
```

說明：
- `id`：供 React key 與未來擴充使用
- `kind`：先固定 `log`，保留未來支援 `diff`
- `command`：實際執行命令，當前為 `git log --oneline -10`
- `summary`：供卡片收合狀態快速掃讀，建議來自前 1 到 2 行非空輸出
- `content`：完整輸出
- `createdAt`：ISO timestamp，交給前端格式化

client store 新增：

```typescript
interface WorkspaceState {
  activeWorkspaceTab: 'agent-output' | 'git-history'
  gitHistory: GitHistoryItem[]
}
```

原則：
- `gitHistory` 採最新在前
- 暫時只存在記憶體中，重新整理頁面後可接受清空
- `session:state` 不補回舊歷史，避免把這次小功能擴大成 session replay 問題

---

## 7. Socket 與資料流設計

### 7.1 現況

目前 `git:action('log')` 的資料流為：

```text
GitPanel Log button
  -> socket.emit('git:action', { command: 'log' })
  -> server runGitCommand(...)
  -> io.emit('terminal:output', { data: result.output })
```

### 7.2 調整後

`git log` 改走結構化事件：

```text
GitPanel Log button
  -> socket.emit('git:action', { command: 'log' })
  -> server runGitCommand(...)
  -> io.emit('git:history:added', GitHistoryItem)
```

規則：
- `command === 'log'` 時，不再廣播 `terminal:output`
- `command === 'diff' | 'commit'` 先維持既有 terminal 行為
- `git log` 執行失敗時，不新增 history item，仍透過既有 `error` 事件通知前端

### 7.3 Server 組裝責任

server 在 `runGitCommand` 成功後負責把原始輸出轉成 `GitHistoryItem`：

- `command`：固定填入實際命令字串
- `summary`：從輸出取前 1 到 2 行非空行，若無內容則使用 `No output`
- `content`：完整 stdout/stderr 合併內容
- `createdAt`：server 當下時間
- `id`：可用 `crypto.randomUUID()`

這個責任放在 server，而不是 client，原因是：
- 減少多 client 各自推導摘要造成不一致
- 減少前端知道 git command 細節
- 測試邊界更清楚

---

## 8. 元件拆分

建議新增或調整以下元件：

- `WorkspaceTabs`
  - 負責中央區 tab 切換框架
- `GitHistoryPanel`
  - 負責顯示歷史列表與空狀態
- `GitHistoryCard`
  - 單筆紀錄卡片，處理展開/收合
- `TerminalPanel`
  - 保持純 terminal 顯示

原則：
- terminal 與 git history 分開，不在同一個 component 內用大量條件分支混寫
- 卡片展開/收合狀態可先放在 `GitHistoryPanel` local state，不需要進全域 store

---

## 9. 狀態與互動細節

- 初始 tab：`agent-output`
- 點 `Log` 後：
  - server 成功執行才新增紀錄
  - 前端收到 `git:history:added` 後，把紀錄插到陣列最前面
  - 不自動切換到 `git-history`
- 使用者切換到 `Git History` 後：
  - 可看到所有紀錄，最新在上
  - 最新新增的紀錄預設展開
- 若 `git log` 失敗：
  - 保持目前 tab 不變
  - `Git History` 不新增失敗卡片
  - 錯誤仍走既有錯誤提示流程

不自動切 tab 的原因：
- driver 可能正在看 agent output，不應被 `git log` 打斷
- 累積式歷史資料的價值在於可回查，不一定要即時搶視線

---

## 10. 測試策略

前端測試：
- `MainScreen` 或新 `WorkspaceTabs` 測試，確認中央區有兩個 tab
- 點 tab 可切換 `TerminalPanel` / `GitHistoryPanel`
- 收到 `git:history:added` 後，列表新增一筆紀錄且排序正確
- 新增第二筆紀錄後，兩筆都保留，沒有覆蓋舊資料

server 測試：
- `git:action('log')` 成功時，emit `git:history:added` 而不是 `terminal:output`
- `git:action('diff')` 與 `git:action('commit')` 維持原行為
- `git log` 失敗時，只送錯誤，不送 history item

整合風險：
- 若未來 `git diff` 也要搬移，需確認是否沿用同一資料模型或增加 `kind`
- 若未來需要 session replay，`gitHistory` 可能需要進入 `session:state`

---

## 11. 實作範圍切分

這次變更可拆成四塊：

1. shared types 與 client store 擴充
2. server `git:action` 對 `log` 分支改發 `git:history:added`
3. 中央主區 tab 與 `GitHistoryPanel` UI
4. 測試補齊

這個切分可以保持每塊責任明確，也能避免在單一大元件內混合 terminal、history、socket 與卡片邏輯。

---

## 12. 驗收標準

- 點 `GitPanel` 的 `Log` 後，`Agent Output` terminal 不再出現 `git log` 內容
- 中央區可切到 `Git History`
- 每次 `Log` 都新增一筆新紀錄，不覆蓋舊紀錄
- 每筆紀錄可展開看到完整內容
- 最新紀錄排最上方
- `diff` / `commit` 仍維持既有功能，不因這次調整回歸失敗

---

## 13. 決策摘要

本設計採：
- 中央主區雙 tab，而不是把歷史放進左側 `GitPanel`
- 結構化 `git:history:added` 事件，而不是重用 `terminal:output`
- 累積式、可展開卡片，而不是單次覆蓋結果視圖

這樣可以在不重做整個 git 架構的前提下，先解決目前最直接的 UX 問題：`git log` 與 `Agent Output` 混流。
