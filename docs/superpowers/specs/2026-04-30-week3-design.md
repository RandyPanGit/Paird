# Paird Week 3 設計文件

> 目標：把 Week 2 的 chat-driven MVP 擴充成可日常使用的協作工作區，補齊 TaskPanel、GitPanel、Header 強化與 git 狀態同步  
> 驗收：所有 client 可在主畫面持續看到 task/git 狀態；driver 可直接從面板操作 task 與 git；git 狀態會在事件驅動更新與低頻補漏 polling 下保持同步  
> 日期：2026-04-30

---

## 1. 範圍

Week 3 聚焦在「把已存在的 command 能力變成可觀察、可操作的工作區」。Week 2 已經建立單一輸入流與 server command routing；Week 3 不重做這套模型，而是在它上面補齊獨立面板、狀態同步與日常使用所需的互動。

**包含：**
- `TaskPanel` 元件，顯示任務列表與狀態
- `GitPanel` 元件，顯示 branch 與 `modified` / `added` / `deleted` 檔案
- `Header` 強化，明確顯示 driver 名稱、所有在線使用者、目前 project
- `MainScreen` 改版為左資訊欄、中央 terminal、右 chat
- `task:update` 事件，支援 driver 從 UI 手動更新 task 狀態
- `git:action` 事件，支援從 GitPanel 觸發 `diff` / `log` / `commit`
- `git:status` 狀態同步，採事件驅動優先、低頻 polling 補漏
- 弱自動 task 完成偵測，僅作輔助，不凌駕手動操作
- 前後端測試補齊，覆蓋 UI 權限、狀態同步與錯誤處理

**不包含：**
- 多 session 管理
- 細粒度權限系統
- 程式碼編輯器
- 手機版最佳化
- 完整的 git staged/unstaged 細分
- 高可信度 agent 結構化 task API

---

## 2. 設計目標

Week 3 不是再新增另一套操作模型，而是把 Week 2 已存在的 command flow 變成穩定的工作介面。

設計目標如下：
- 保持 server 為單一真相來源，避免 task/git 狀態分散在多個前端局部 state
- 保持 chat slash command 可用，同時新增更直觀的面板操作入口
- 讓 `TerminalPanel` 仍是主工作區，不被 task/git 面板壓縮成次要內容
- 在 MVP 範圍內提升可靠性，避免過度依賴從 agent 純文字輸出猜測狀態

這一週的核心不是重構 Week 2，而是明確補齊 Week 2 刻意留白的部分：獨立 `TaskPanel`、獨立 `GitPanel`、git 狀態同步、driver 與 presence 顯示。

---

## 3. 架構方案

### 3.1 推薦方案：UI 補強 + 輕量事件模型

Week 3 採用「沿用 Week 2 command router，補上結構化 UI 與少量新事件」的方案。

資料流如下：

```text
Chat slash commands
  -> server chat router
  -> SessionManager / git action handler / PTY
  -> broadcast state events

TaskPanel controls
  -> socket.emit('task:update', { id, status })
  -> SessionManager
  -> broadcast task:updated

GitPanel buttons
  -> socket.emit('git:action', { command, message? })
  -> shared git action handler
  -> terminal output + git snapshot refresh
  -> broadcast git:status when changed
```

原因：
- 與 Week 2 延續性最高，風險最低
- 不需要推翻現有 `chat:send` 與 server routing
- 新功能的結構化狀態可由面板直接消費

### 3.2 不採用的方案

**狀態中心化重構：**
把 task/git 完整抽成新的 domain service。這在長期會更乾淨，但對 Week 3 太重，容易把交付重心從功能補齊轉成架構整理。

**前端先行拼接：**
只做 UI，不明確補 server 事件。這會讓面板與 chat command 逐漸分岔，後續維護成本高。

---

## 4. 版面與元件設計

### 4.1 主畫面配置

Week 3 主畫面調整為三欄：

```text
┌──────────────────────────────────────────────────────────────┐
│ Header                                                       │
├──────────────────────────────────────────────────────────────┤
│ AgentControlBar                                              │
├───────────────┬──────────────────────────────┬───────────────┤
│ Left Rail     │ Main Workspace               │ Right Rail    │
│               │                              │               │
│ TaskPanel     │ TerminalPanel                │ ChatPanel     │
│ GitPanel      │                              │               │
│               │                              │               │
└───────────────┴──────────────────────────────┴───────────────┘
```

配置原則：
- 左欄是持續可見的輔助資訊，不佔主輸出焦點
- `TerminalPanel` 保持最大面積
- `ChatPanel` 延續 week 2 的使用心智模型，不另開第二套輸入模式

### 4.2 `Header`

`Header` 顯示：
- `Paird - <projectName>`
- agent 狀態
- driver 名稱
- 所有在線使用者名稱列表
- 線上人數

互動原則：
- `driver:changed` 後立即更新 driver 標示
- `user:joined` / `user:left` 立即反映在線列表
- 若尚未啟動 agent，仍顯示 session/presence，但 project 名稱改為占位文案

### 4.3 `TaskPanel`

`TaskPanel` 顯示欄位：
- 任務描述
- 狀態 badge：`queued` / `running` / `done` / `failed`
- `createdBy`
- `updatedAt`

互動：
- driver 可直接切換狀態
- observer 只讀
- 列表依狀態與更新時間排序，優先顯示 `running`、再來 `queued`

空狀態：
- 無 task 時顯示簡短提示，並教 driver 用 `/task <描述>` 或後續 UI 入口新增

### 4.4 `GitPanel`

`GitPanel` 顯示：
- branch 名稱
- 最近更新時間
- `modified` / `added` / `deleted` 檔案分組
- 檔案總數摘要

互動：
- 顯示 `Diff`、`Log`、`Commit` 按鈕
- 與 week 2 chat commands 共用同一套 server 行為
- observer 可見按鈕但 disabled，或直接隱藏寫入型操作；spec 採較明確的 disabled 樣式，讓權限邊界可見

`Commit` 互動：
- 需要簡短 message 輸入
- 空 message 立即在 client 擋下，server 仍保留驗證

---

## 5. 資料模型

### 5.1 共用型別延伸

Week 3 延續 Week 2 的 `Task`、`ChatMessage`、`SessionState`，並正式補上 `GitStatus`。

```typescript
export interface GitStatus {
  branch: string;
  modified: string[];
  added: string[];
  deleted: string[];
  lastUpdated: Date;
}
```

`SessionState.gitStatus` 從 Week 2 的 `null` placeholder 擴充為：
- 尚未進入 git repo 或 agent 未啟動時可為 `null`
- 有有效 project repo 時為最新 snapshot

### 5.2 Client store

前端 store 必須正式管理：
- `tasks`
- `gitStatus`
- `chatMessages`
- `users`
- `driverId`
- `agentStatus`
- 最近錯誤訊息

原則：
- 所有 server 廣播事件都直接寫回單一 store
- `TaskPanel` / `GitPanel` / `Header` 只讀取 store，不各自維護影子狀態

---

## 6. Socket 事件設計

### 6.1 延續事件

Week 2 既有事件繼續使用：
- `session:state`
- `chat:message`
- `task:updated`
- `driver:changed`
- `terminal:output`
- `agent:started`
- `agent:stopped`
- `error`

### 6.2 新增 Client -> Server

| 事件 | Payload | 說明 |
|------|---------|------|
| `task:update` | `{ id: string, status: TaskStatus }` | Driver 手動更新 task 狀態 |
| `git:action` | `{ command: 'diff' \| 'log' \| 'commit', message?: string }` | GitPanel 觸發 git 指令 |

### 6.3 新增/正式化 Server -> Client

| 事件 | Payload | 說明 |
|------|---------|------|
| `git:status` | `GitStatus` | 廣播最新 git snapshot |

原則：
- 不新增過多一次性事件
- `task:update` 的結果仍以完整 `task:updated` 回推，避免 client 各自 patch 單筆狀態造成不一致

---

## 7. Task 狀態規則

### 7.1 手動優先

Task 狀態模型採：
- 新 task 一律建立為 `queued`
- driver 可手動切為 `running` / `done` / `failed`
- observer 不可更改

### 7.2 弱自動完成偵測

Week 3 保留 MVP 想法，但把自動判定限制在保守範圍。

規則：
- 只對目前唯一的 `running` task 生效
- 只在 terminal output 命中有限完成關鍵字時才嘗試自動標記 `done`
- 若沒有 `running` task，或同時有多個 `running` task，則完全不自動更新
- 手動設定過的 `failed` task 不會被自動改回 `done`
- 任何後續手動操作都可覆蓋自動結果

目的：
- 提供輕量便利性
- 避免從自然語言輸出做激進推論

### 7.3 排序與顯示

顯示順序：
1. `running`
2. `queued`
3. `failed`
4. `done`

同狀態內依 `updatedAt` 新到舊排序。

---

## 8. Git 同步與操作規則

### 8.1 雙入口

Git 操作保留雙入口：
- chat slash command：`/git diff`、`/git log`、`/git commit <message>`
- GitPanel 按鈕：`Diff`、`Log`、`Commit`

兩者都必須共用同一套 server handler、同一套權限檢查、同一套 terminal output 行為。

### 8.2 狀態同步策略

採「事件驅動優先，低頻 polling 補漏」。

**事件驅動刷新時機：**
- `agent:start` 成功後
- `git:action` 執行完成後
- server 偵測到可能引發工作樹變化的命令節點後

**補漏 polling：**
- 保留低頻週期刷新，用來處理 agent 自行改檔、但沒有經過顯性 git action 的情況
- 若 snapshot 無變化，不廣播 `git:status`

### 8.3 呈現規則

`GitPanel` 只顯示工作樹層級資訊，不納入 staged/unstaged 細分，避免 MVP 範圍膨脹。

terminal 與面板分工：
- `git diff` / `git log` / `git commit` 的完整 stdout/stderr 仍顯示在 terminal
- `GitPanel` 只顯示結構化摘要

---

## 9. 錯誤處理

### 9.1 Task 相關

- 非 driver 嘗試 `task:update`：回 `NOT_DRIVER`
- 找不到 task id：先沿用 `INVALID_COMMAND`，避免 Week 3 額外擴充錯誤碼集合
- 無效狀態轉換：由 server 拒絕並回錯誤

### 9.2 Git 相關

- 尚未啟動 agent 或無 project path：回 `AGENT_NOT_RUNNING` 或 `GIT_REPO_REQUIRED`
- 非 git repo：回 `GIT_REPO_REQUIRED`
- commit message 缺失：回 `COMMIT_MESSAGE_REQUIRED`
- git command 失敗：terminal 顯示原始輸出，前端另收到 `GIT_COMMAND_FAILED`

### 9.3 UI 體驗

前端錯誤提示原則：
- 不把大量 git 內容塞進 chat
- 結構化錯誤走 toast/inline error
- terminal 保留原始命令輸出，方便排查

---

## 10. 測試與驗收

### 10.1 Server 測試

至少覆蓋：
- `task:update` 的 driver 權限檢查
- task 手動更新後 `task:updated` 是否同步
- 弱自動 task 完成在唯一 `running` task 時才生效
- `git:status` snapshot 只有在變化時才廣播
- `git:action` 與 chat `/git ...` 是否共用相同行為

### 10.2 Client 測試

至少覆蓋：
- `TaskPanel` 正確顯示狀態與 driver-only 控制
- `GitPanel` 正確顯示 branch、檔案分組與 disabled 按鈕狀態
- `Header` 在 `driver:changed`、`user:joined`、`user:left` 後更新
- `MainScreen` 新布局在一般桌面寬度下維持左欄 / 中央 / 右欄結構
- 空狀態與錯誤狀態文案

### 10.3 驗收條件

- 進入主畫面後，所有 client 都能持續看到 task 與 git 狀態
- driver 可從 `TaskPanel` 更新 task 狀態
- driver 可從 `GitPanel` 執行 `diff` / `log` / `commit`
- observer 無法執行 driver-only 操作
- git 工作樹變化後，`GitPanel` 能在事件驅動刷新或低頻 polling 下更新
- terminal 仍是完整命令與 agent 輸出的唯一詳細視圖

---

## 11. 實作切分建議

Week 3 適合拆成四個實作區塊：

1. shared types + session/git snapshot 資料結構
2. server 事件與 git sync 流程
3. `TaskPanel` / `GitPanel` / `Header` / `MainScreen` UI
4. 測試、空狀態、錯誤處理

這樣可以維持每一段都有可驗證結果，也避免 UI 與 server 同時大幅漂移。

---

## 12. 風險與取捨

**Task 自動偵測仍可能誤判**
- 已透過「僅限唯一 running task」與「手動優先」降低風險
- 不追求高自動化，避免把錯誤推論寫進真實工作流

**GitPanel 與 chat command 雙入口可能出現重複心智模型**
- 這是刻意取捨，因為雙入口共用同一 server 行為，重複的是入口，不是邏輯
- 對使用者而言，這比要求記住所有 slash commands 更實用

**事件驅動 + polling 會多一套同步機制**
- 這是為了處理 agent 自行改檔的現實情況
- 透過差異比對避免無效廣播，控制成本

---

## 13. 結論

Week 3 的正確方向不是重寫 Week 2，而是把 Week 2 已具備的 command 能力整理成真正可用的 pair programming 工作區。

本設計採：
- 左資訊欄、中央 terminal、右 chat 的主布局
- task 手動優先、弱自動輔助
- GitPanel 與 chat commands 雙入口
- 事件驅動優先、低頻 polling 補漏的 git 同步策略

這能在不擴大 MVP 範圍的前提下，把 Paird 從「可操作的 chat shell」提升成「可觀察、可協作的日常工作介面」。
