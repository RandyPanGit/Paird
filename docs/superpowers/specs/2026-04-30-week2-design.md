# Paird Week 2 設計文件

> 目標：把 Week 1 的 ChatPanel 骨架擴充為可操作的聊天介面，完成統一輸入流、chat command parsing、driver 轉交與基本 task/git command 能力  
> 驗收：driver 可透過聊天面板送指令給 agent，observer 可 team chat，slash commands 可由 server 正確解析與廣播  
> 日期：2026-04-30

---

## 1. 範圍

Week 2 聚焦在「可操作的聊天介面」，不把 TaskPanel 與 GitPanel 的完整 UI 一起納入。

**包含：**
- `ChatPanel` 從 placeholder 變成可送出、可顯示訊息的面板
- 單一輸入流：所有輸入統一走 `chat:send`
- Server 端 command router
- Driver 的一般文字輸入可寫入 PTY stdin
- Observer 的一般文字輸入作為 team chat 廣播
- `/task <描述>` 指令
- `/pass <名字>` 指令
- `/git diff`、`/git log`、`/git commit <message>` 指令
- `chatHistory`、`tasks` 正式進入 session/store 狀態
- 錯誤訊息回傳與前端提示

**不包含：**
- 獨立 `TaskPanel`
- 獨立 `GitPanel`
- git status polling
- 從 agent 輸出自動偵測 task 完成
- 細粒度 command 權限系統
- 多 session 支援

---

## 2. 設計目標

Week 2 的核心不是增加更多面板，而是讓既有右側聊天區成為所有操作的入口。設計上維持 MVP 文件原本的模型：單一輸入框，同一條訊息流，server 集中解析規則。

這樣做有三個目的：
- 避免前後端各自維護 slash command 規則
- 保持 driver 與 observer 在同一個 UI 內工作，只由 server 決定權限與結果
- 先穩定 `chatHistory` / `tasks` / command routing 的邊界，讓 Week 3 之後可以再擴成獨立 Task/Git 視圖

---

## 3. 架構方案

### 3.1 單一輸入流

Week 2 採單一輸入框、server 統一解析。

資料流如下：

```text
ChatPanel input
  -> socket.emit('chat:send', { content })
  -> server command router
     -> team chat broadcast
     -> OR PTY stdin write
     -> OR task state update
     -> OR driver handoff
     -> OR git command execution
  -> broadcast events
  -> client store update
  -> ChatPanel / Header / terminal UI refresh
```

前端不判斷 slash command，只做：
- 去除前後空白
- 避免空字串送出
- 送出中短暫 disable
- 顯示訊息列表與錯誤提示

所有語意判斷都集中在 server，避免規則分散。

### 3.2 為什麼不拆雙輸入模式

本週不拆成 `Agent Command` / `Team Chat` 兩個輸入模式，原因如下：
- 偏離 `claude-pair-mvp.md` 原本的一條輸入流設計
- 增加使用者切換成本
- 讓 observer/driver 的行為分散到不同 UI 區塊
- 無法減少 server 權限檢查的必要性

---

## 4. 資料模型

### 4.1 共用型別

Week 2 需要把 `src/shared/types.ts` 從 Week 1 的空陣列 placeholder 擴成正式型別。

```typescript
export type AgentStatus = 'idle' | 'running' | 'stopped';
export type TaskStatus = 'queued' | 'running' | 'done' | 'failed';
export type ChatMessageType = 'user' | 'command' | 'system';

export interface User {
  socketId: string;
  name: string;
  joinedAt: Date;
  isDriver: boolean;
}

export interface Task {
  id: string;
  description: string;
  status: TaskStatus;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface ChatMessage {
  id: string;
  senderId: string | null;
  senderName: string;
  content: string;
  timestamp: Date;
  type: ChatMessageType;
}

export interface SessionState {
  driverId: string | null;
  users: User[];
  projectPath: string | null;
  projectName: string | null;
  agentStatus: AgentStatus;
  tasks: Task[];
  chatHistory: ChatMessage[];
  gitStatus: null;
}
```

### 4.2 Session 狀態策略

`SessionManager` 新增：
- `chatHistory`：保留最近 100 則
- `tasks`：記錄目前 task 陣列

保留策略：
- `chatHistory` 超過 100 則時丟掉最舊訊息
- `tasks` 本週只新增，不做自動完成判定

### 4.3 命名與限制

- `/pass <名字>` 只做「精準匹配目前在線 user name」
- 找不到或同名不唯一都視為錯誤
- 不做模糊比對、大小寫寬鬆比對或部分匹配

---

## 5. Socket 事件設計

### 5.1 Client -> Server

| 事件 | Payload | 說明 |
|------|---------|------|
| `chat:send` | `{ content: string }` | 統一聊天與 command 入口 |
| `agent:start` | `{ projectPath: string }` | 延續 Week 1 |
| `agent:stop` | `—` | 延續 Week 1 |
| `terminal:resize` | `{ cols: number, rows: number }` | 延續 Week 1 |

### 5.2 Server -> Client

| 事件 | Payload | 說明 |
|------|---------|------|
| `session:state` | `SessionState` | 初始完整狀態，現在包含 `tasks` 與 `chatHistory` |
| `chat:message` | `ChatMessage` | 新增一則聊天或系統訊息 |
| `task:updated` | `Task[]` | 完整 task 陣列 |
| `driver:changed` | `{ newDriverId: string, newDriverName: string }` | driver 轉交成功 |
| `error` | `{ code: string, message: string }` | command 或權限錯誤 |
| `terminal:output` | `{ data: string }` | 延續 Week 1 |
| `agent:started` | `{ projectPath: string, projectName: string }` | 延續 Week 1 |
| `agent:stopped` | `—` | 延續 Week 1 |

---

## 6. Command Router 規則

### 6.1 解析入口

Server 收到 `chat:send` 後，按以下順序處理：

1. `trim` 內容，空字串直接忽略
2. 判斷是否為 slash command
3. 若不是 slash command，依 sender 是否為 driver 決定是 team chat 還是 agent command
4. 執行結果後，視情況 broadcast `chat:message` / `task:updated` / `driver:changed`

### 6.2 一般文字

**Observer：**
- 建立 `type: 'user'` 的 `ChatMessage`
- 廣播給所有 client
- 不寫入 PTY

**Driver：**
- 建立 `type: 'command'` 的 `ChatMessage`
- 先廣播給所有 client
- 再把內容加上 `\r` 後寫入 PTY stdin

這個順序可避免 UI 因等待 agent 輸出而顯得卡住。

### 6.3 `/task <描述>`

行為：
- 只允許 driver 執行
- 描述空白時回錯誤
- 建立新 task，初始狀態固定為 `queued`
- 廣播完整 `task:updated`
- 同步插入一則 `system` 訊息，例如 `Task added: 修正 reconnect bug`

Week 2 不做：
- task 狀態手動切換
- task 自動完成偵測
- running/done 規則推導

### 6.4 `/pass <名字>`

行為：
- 只允許 driver 執行
- 以精準名稱匹配目前在線使用者
- 成功後更新 `driverId`
- 廣播 `driver:changed`
- 插入一則 `system` 訊息，例如 `Alice passed driver to Bob`

錯誤情況：
- 名字不存在
- 名字重複
- 傳給自己
- sender 不是 driver

### 6.5 `/git diff`

執行：

```bash
git diff --stat && git diff
```

結果：
- stdout/stderr 都寫進 terminal output
- 不新增 chat message，避免聊天區被大量 git 內容淹沒

### 6.6 `/git log`

執行：

```bash
git log --oneline -10
```

結果與 `/git diff` 相同，輸出只進 terminal。

### 6.7 `/git commit <message>`

執行：

```bash
git add -A && git commit -m "<message>"
```

規則：
- 只允許 driver 執行
- commit message 空白視為錯誤
- git command 失敗時 stderr/stdout 也要寫到 terminal

### 6.8 非支援指令

所有未知 slash command 回：

```json
{
  "code": "UNKNOWN_COMMAND",
  "message": "Unsupported command: /xxx"
}
```

---

## 7. Server 模組變更

### 7.1 `sessionManager.ts`

新增職責：
- 管理 `chatHistory`
- 管理 `tasks`
- 提供 append/broadcast 所需的方法
- 支援依名稱找使用者與 driver handoff

建議方法：

```typescript
addChatMessage(message: ChatMessage): void;
getChatHistory(): ChatMessage[];

addTask(task: Task): void;
getTasks(): Task[];

findUsersByName(name: string): User[];
passDriverTo(socketId: string): void;
```

### 7.2 `index.ts`

新增 `chat:send` handler，流程如下：

```text
receive chat:send
  -> validate sender + state
  -> parse command
  -> execute branch
  -> update session state
  -> emit result events
```

`index.ts` 需新增的輔助責任：
- 建立 `ChatMessage` / `Task` id
- 透過 child process 或 git wrapper 執行 git command
- 將 git output 導到既有 `terminal:output` broadcast

### 7.3 Git command 執行策略

Week 2 的 git command 不經過 PTY，不注入 Claude agent；由 server 直接在目前 project path 執行 shell command，再把結果當作 terminal output 廣播。

原因：
- 避免 agent prompt 被 git 指令污染
- 保持 git command 有同步、可預期的結果
- 錯誤處理可獨立於 Claude agent

---

## 8. Client 設計

### 8.1 Store 變更

`src/client/store.ts` 新增：

```typescript
chatMessages: ChatMessage[];
tasks: Task[];
errorMessage: string | null;

setChatMessages(messages: ChatMessage[]): void;
appendChatMessage(message: ChatMessage): void;
setTasks(tasks: Task[]): void;
setError(message: string | null): void;
```

### 8.2 `socket.ts`

新增事件訂閱：
- `chat:message`
- `task:updated`
- `error`

連線後收到 `session:state` 時，要把 `chatHistory` 與 `tasks` 一起 hydrate 到 store。

### 8.3 `ChatPanel.tsx`

`ChatPanel` 會從 placeholder 改為：
- 上半部：訊息列表
- 下半部：輸入框 + send button
- 底部或輸入框上方：簡短錯誤提示區

訊息樣式：
- `user`：隊友聊天，顯示 sender name + time + content
- `command`：driver 指令，使用較弱對比樣式
- `system`：置中灰字

placeholder 規則保留：
- Driver：`Send command to agent or /task, /pass, /git...`
- Observer：`Message teammates (you're observing)`

送出後行為：
- trim 後若為空，不送出
- 送出成功後清空輸入框
- 收到錯誤事件時顯示最近一次錯誤

### 8.4 `Header.tsx`

不需要大改，但需確保：
- `driver:changed` 後 driver 標示立即更新
- observer/driver 權限切換後 placeholder 與 `AgentControlBar` 行為同步

### 8.5 `MainScreen.tsx`

版面不變，仍是左 terminal、右 chat。

Week 2 不新增 Task/Git 區塊，避免 scope 外擴。

---

## 9. 錯誤處理

### 9.1 錯誤代碼建議

```typescript
type ErrorCode =
  | 'AGENT_NOT_RUNNING'
  | 'NOT_DRIVER'
  | 'INVALID_COMMAND'
  | 'UNKNOWN_COMMAND'
  | 'TASK_DESCRIPTION_REQUIRED'
  | 'PASS_TARGET_NOT_FOUND'
  | 'PASS_TARGET_AMBIGUOUS'
  | 'PASS_TARGET_SELF'
  | 'GIT_REPO_REQUIRED'
  | 'COMMIT_MESSAGE_REQUIRED'
  | 'GIT_COMMAND_FAILED';
```

### 9.2 錯誤規則

- agent 未啟動時：
  - driver 的一般文字輸入回 `AGENT_NOT_RUNNING`
  - 所有 `/git ...` 指令回 `AGENT_NOT_RUNNING`
- sender 不是 driver 時：
  - `/task`、`/pass`、`/git commit` 回 `NOT_DRIVER`
- projectPath 非 git repo 時：
  - 所有 `/git ...` 指令回 `GIT_REPO_REQUIRED`
- `/task` 空描述：
  - 回 `TASK_DESCRIPTION_REQUIRED`
- `/pass` 找不到人：
  - 回 `PASS_TARGET_NOT_FOUND`
- `/pass` 名字重複：
  - 回 `PASS_TARGET_AMBIGUOUS`
- `/pass` 傳給自己：
  - 回 `PASS_TARGET_SELF`
- `/git commit` 缺 message：
  - 回 `COMMIT_MESSAGE_REQUIRED`

### 9.3 Git 失敗可見性

git command 執行失敗時：
- socket 發 `error`
- stdout/stderr 也進 terminal output

這樣使用者可以看到高層錯誤提示，也能看到底層 git 實際報錯。

---

## 10. 測試策略

### 10.1 Server 單元測試

覆蓋：
- 一般文字 vs slash command 判斷
- `/task`、`/pass`、`/git ...` 解析
- 錯誤輸入分類
- driver/observer 權限判定

### 10.2 Server 整合測試

覆蓋：
- `chat:send` 是否正確觸發 `chat:message`
- driver 一般文字是否會寫入 PTY
- observer 一般文字是否不會寫入 PTY
- `/task` 是否更新 `task:updated`
- `/pass` 是否更新 `driver:changed`
- git command 是否將輸出導向 `terminal:output`

### 10.3 Client UI 測試

覆蓋：
- `ChatPanel` 是否依 `user` / `command` / `system` 正確渲染
- 送出後輸入框是否清空
- 不同身份 placeholder 是否正確
- 收到錯誤事件時 UI 是否顯示錯誤提示

---

## 11. 驗收標準

- driver 輸入一般文字後，所有 client 先看到 command message，agent 隨後收到 stdin
- observer 輸入一般文字後，只出現在 team chat，不進 PTY
- `/task <描述>` 成功後，所有 client 收到同步的 task 陣列與 system message
- `/pass <名字>` 成功後，Header 與 driver 權限立即切換
- `/git diff`、`/git log`、`/git commit <message>` 的輸出都進 terminal
- git command 失敗時，使用者同時看到 error message 與 terminal 內的實際錯誤內容
- 非法或不支援的指令不會 silent fail

---

## 12. 實作切分建議

Week 2 實作可拆成以下順序：

1. 擴充 shared types 與 session state
2. 新增 `chat:send`、`chat:message`、`task:updated`、`error` socket 流
3. 完成 server command router
4. 完成 git command execution 與 terminal output bridge
5. 完成 `ChatPanel` UI 與 store 綁定
6. 補上 driver handoff、錯誤提示與驗收測試

這個切分能讓功能從「有 state」到「有行為」逐步驗證，不必一次改完整個 UI。
