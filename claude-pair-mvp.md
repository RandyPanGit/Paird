# Paird — MVP 規格文件

> 多人即時協作 AI Coding Agent Web 介面  
> 版本：0.1 MVP｜日期：2026-04-28  
> 連線模式：v0.1 內網 IP（無驗證）→ v0.2 TOKEN 驗證 + 公網

---

## 目錄

1. [專案概述](#1-專案概述)
2. [使用者故事](#2-使用者故事)
3. [功能範圍](#3-功能範圍)
4. [系統架構](#4-系統架構)
5. [技術選型](#5-技術選型)
6. [資料結構與狀態設計](#6-資料結構與狀態設計)
7. [API 與 Socket 事件定義](#7-api-與-socket-事件定義)
8. [前端頁面與元件設計](#8-前端頁面與元件設計)
9. [後端模組設計](#9-後端模組設計)
10. [安全性設計](#10-安全性設計)
11. [開發里程碑](#11-開發里程碑)
12. [目錄結構](#12-目錄結構)
13. [環境設定與啟動方式](#13-環境設定與啟動方式)
14. [已知限制與後續規劃](#14-已知限制與後續規劃)

---

## 1. 專案概述

### 1.1 背景

Claude Code 是一個強大的 AI coding agent，但目前只支援單人使用。Pair programming 場景下，兩人必須透過 tmux 共享 terminal，操作體驗粗糙，也無法顯示結構化的任務進度與 git 狀態。

### 1.2 目標

打造一個輕量的 Web GUI（Paird），讓多人可以連進同一個 AI coding agent session 進行 pair programming，提供：

- 即時廣播 Claude Code 的輸出
- 結構化的任務列表與進度顯示
- Git 狀態即時監控
- 聊天介面讓 driver 下指令給 Claude

### 1.3 MVP 範圍定義

MVP 只解決「多人觀看同一個 agent session 並由一人下指令」這個核心問題，不做多 session 管理、不做程式碼編輯器、不做複雜的權限系統。

---

## 2. 使用者故事

| ID | 角色 | 故事 | 驗收條件 |
|----|------|------|----------|
| US-01 | Driver | 我可以透過聊天介面對 Claude 下指令 | 訊息送出後 Claude Code 收到輸入並回應 |
| US-02 | Observer | 我可以即時看到 Claude 的所有輸出 | 輸出延遲 < 500ms |
| US-03 | Observer | 我可以看到目前的任務列表與狀態 | 任務狀態即時更新 |
| US-04 | 任何人 | 我可以看到目前 git 變更的檔案列表 | 每 3 秒自動更新 |
| US-05 | Driver | 我可以把 driver 身份轉讓給隊友 | 轉讓後原 driver 變成 observer |
| US-06 | Observer | 我可以在 team chat 留言給隊友 | 訊息廣播給所有人，不進入 Claude |
| US-07 | 任何人 | 我可以點擊按鈕執行 `git diff` 或 `git log` | 結果顯示在 Claude 輸出面板 |
| US-08 | Driver | 我可以在介面上指定 project 路徑並啟動 agent | Agent 在指定路徑啟動，git 面板切換到該 repo |

---

## 3. 功能範圍

### 3.1 MVP 包含（In scope）

**多人連線**
- 支援最多 5 人同時連線同一 session
- 顯示線上人數與使用者名稱
- 顯示誰是目前的 driver

**Agent 整合**
- Driver 可在介面上輸入 project 路徑並啟動 agent（不依賴設定檔寫死）
- 後端透過 `node-pty` spawn agent process（預設 Claude Code）
- stdout/stderr 即時串流到所有 client
- 只有 driver 可以送指令進 stdin
- Driver 可隨時停止目前 agent 並切換到新的 project 路徑重新啟動

**Task 列表**
- Driver 可用 `/task <描述>` 指令新增任務
- Claude 回應中偵測到 task 完成關鍵字時自動標記為 done
- 顯示 running / queued / done 三種狀態

**Git 面板**
- 每 3 秒 polling `git status` 並推播變更
- 顯示 modified / added / deleted 檔案
- 提供 `git diff`、`git log`、`git commit` 快捷按鈕

**Team Chat**
- 所有人都可以在 team chat 留言
- Chat 訊息不會進入 Claude Code stdin
- 訊息帶使用者名稱與時間戳

### 3.2 MVP 不包含（Out of scope）

- 多個 agent session 管理
- 程式碼編輯器（Monaco / CodeMirror）
- 細粒度的權限控制（role-based）
- 使用者帳號系統（登入 / 註冊）
- 行動裝置最佳化
- 暗色模式切換

---

## 4. 系統架構

```
┌─────────────────────────────────────────────┐
│                Browser Clients               │
│   User A (driver)   User B   User C         │
└──────────┬──────────────┬───────────┬────────┘
           │              │           │
           └──────────────┼───────────┘
                          │  WebSocket (Socket.io)
┌─────────────────────────▼───────────────────┐
│              Node.js Server                  │
│                                              │
│  ┌──────────────┐    ┌────────────────────┐  │
│  │ Socket.io    │    │  Session Manager   │  │
│  │ Gateway      │    │  (driver 狀態)     │  │
│  └──────┬───────┘    └────────────────────┘  │
│         │                                    │
│  ┌──────▼───────┐    ┌────────────────────┐  │
│  │ PTY Bridge   │    │  Git Watcher       │  │
│  │ (node-pty)   │    │  (simple-git)      │  │
│  └──────┬───────┘    └────────┬───────────┘  │
└─────────┼────────────────────┼───────────────┘
          │                    │
┌─────────▼────────────────────▼───────────────┐
│              Local Machine                    │
│   Agent Process (Claude Code)   Git Repository      │
└───────────────────────────────────────────────┘
```

### 4.1 資料流說明

**Driver 送指令流程：**
```
Driver 輸入訊息
  → Socket.io (chat:send)
  → Server 確認 sender 是 driver
  → 寫入 PTY stdin
  → Agent 處理
  → stdout 輸出
  → Server broadcast (terminal:output)
  → 所有 Client 即時顯示
```

**Git 狀態更新流程：**
```
Server 每 3 秒執行 git status
  → 比對前次狀態是否有變更
  → 有變更則 broadcast (git:status)
  → 所有 Client 更新 Git 面板
```

---

## 5. 技術選型

| 層級 | 技術 | 選擇原因 |
|------|------|----------|
| 後端 runtime | Node.js 20+ | node-pty 生態系完整，async I/O 適合 streaming |
| Web framework | Express 4 | 輕量，只需要提供靜態檔案與初始化 |
| WebSocket | Socket.io 4 | 自動 reconnect、room 管理、fallback to polling |
| PTY 控制 | node-pty | 完整模擬 terminal，agent 正常運作 |
| Git 操作 | simple-git | 對 Node.js 友善的 git wrapper |
| 前端框架 | React 18 + Vite | 元件化、開發速度快 |
| 前端狀態 | Zustand | 輕量，適合 MVP 規模 |
| Terminal 顯示 | xterm.js | 支援 ANSI color codes，直接渲染 PTY 輸出 |
| 樣式 | Tailwind CSS | 快速排版，不需要設計系統 |
| 語言 | TypeScript | 前後端共用型別定義 |

---

## 6. 資料結構與狀態設計

### 6.1 Server 端狀態（in-memory）

```typescript
// session 狀態（整個應用只有一個 session）
interface SessionState {
  driverId: string | null;        // 目前 driver 的 socket id
  users: Map<string, User>;       // socketId -> User
  projectPath: string | null;     // 目前 agent 執行的 project 路徑
  projectName: string | null;     // 從路徑解析出的資料夾名稱
  agentStatus: 'idle' | 'running' | 'stopped';
  tasks: Task[];
  chatHistory: ChatMessage[];     // 保留最近 100 則
  gitStatus: GitStatus | null;
}

interface User {
  socketId: string;
  name: string;
  joinedAt: Date;
  isDriver: boolean;
}

interface Task {
  id: string;
  description: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;  // user name
}

interface ChatMessage {
  id: string;
  senderName: string;
  senderId: string;
  content: string;
  timestamp: Date;
  type: 'user' | 'system';  // system 用於「Alice 變成 driver」這類通知
}

interface GitStatus {
  branch: string;
  modified: string[];
  added: string[];
  deleted: string[];
  lastUpdated: Date;
}
```

### 6.2 Client 端狀態（Zustand store）

```typescript
interface AppStore {
  // 連線狀態
  isConnected: boolean;
  mySocketId: string | null;
  myName: string | null;

  // Session
  users: User[];
  driverId: string | null;
  isDriver: () => boolean;

  // Agent
  projectPath: string | null;
  projectName: string | null;
  agentStatus: 'idle' | 'running' | 'stopped';

  // Tasks
  tasks: Task[];

  // Git
  gitStatus: GitStatus | null;

  // Chat
  chatMessages: ChatMessage[];

  // Actions
  startAgent: (projectPath: string) => void;
  stopAgent: () => void;
  sendCommand: (text: string) => void;
  sendChatMessage: (text: string) => void;
  requestDriverRole: () => void;
  addTask: (description: string) => void;
}
```

---

## 7. API 與 Socket 事件定義

### 7.1 HTTP Endpoints

| Method | Path | 說明 |
|--------|------|------|
| `GET` | `/` | 提供前端靜態檔案 |
| `GET` | `/api/health` | 健康檢查，回傳 server 狀態與 PTY 是否存活 |
| `GET` | `/api/session` | 取得目前 session 初始狀態（tasks、git、users） |
| `GET` | `/api/connection-info` | 回傳連線模式與預設位址供 Join Screen 預填 |
| `POST` | `/api/agent/start` | Driver 啟動 agent（帶 projectPath） |
| `POST` | `/api/agent/stop` | Driver 停止目前 agent |
| `GET` | `/api/fs/validate` | 驗證路徑是否存在且為 git repo |

**`POST /api/agent/start` request:**
```json
{
  "projectPath": "/Users/alice/projects/my-app"
}
```

**`POST /api/agent/start` response:**
```json
{
  "ok": true,
  "projectPath": "/Users/alice/projects/my-app",
  "projectName": "my-app",
  "isGitRepo": true
}
```

**`GET /api/fs/validate?path=/Users/alice/projects/my-app` response:**
```json
{
  "exists": true,
  "isDirectory": true,
  "isGitRepo": true,
  "projectName": "my-app"
}
```

**`GET /api/health` response:**
```json
{
  "status": "ok",
  "ptyAlive": true,
  "projectPath": "/Users/alice/projects/my-app",
  "connectedUsers": 3,
  "uptime": 3600
}
```

**`GET /api/session` response:**
```json
{
  "users": [...],
  "driverId": "abc123",
  "projectPath": "/Users/alice/projects/my-app",
  "projectName": "my-app",
  "agentStatus": "running",
  "tasks": [...],
  "gitStatus": {...},
  "chatHistory": [...]
}
```

### 7.2 Socket.io 事件

#### Client → Server

| 事件 | Payload | 說明 |
|------|---------|------|
| `user:join` | `{ name: string }` | 加入 session |
| `chat:send` | `{ content: string }` | 送出聊天訊息或指令 |
| `driver:request` | — | 請求 driver 身份 |
| `driver:pass` | `{ toSocketId: string }` | 轉讓 driver 給指定使用者 |
| `agent:start` | `{ projectPath: string }` | Driver 啟動 agent（路徑由介面輸入） |
| `agent:stop` | — | Driver 停止目前 agent |
| `task:add` | `{ description: string }` | 新增任務 |
| `task:update` | `{ id: string, status: TaskStatus }` | 手動更新任務狀態 |
| `git:action` | `{ command: 'diff' \| 'log' \| 'commit', message?: string }` | 執行 git 指令 |

#### Server → Client

| 事件 | Payload | 說明 |
|------|---------|------|
| `session:state` | `SessionState` | 連線後的初始完整狀態 |
| `user:joined` | `User` | 有新使用者加入 |
| `user:left` | `{ socketId: string, name: string }` | 有使用者離開 |
| `driver:changed` | `{ newDriverId: string, newDriverName: string }` | Driver 身份變更 |
| `agent:started` | `{ projectPath: string, projectName: string }` | Agent 啟動成功，廣播給所有人 |
| `agent:stopped` | — | Agent 已停止 |
| `agent:error` | `{ message: string }` | Agent 啟動失敗（路徑不存在等） |
| `terminal:output` | `{ data: string }` | Agent stdout/stderr |
| `chat:message` | `ChatMessage` | 新聊天訊息（含 system 通知） |
| `task:updated` | `Task[]` | 完整任務列表更新 |
| `git:status` | `GitStatus` | Git 狀態更新 |
| `error` | `{ code: string, message: string }` | 錯誤通知 |

### 7.3 聊天指令解析規則

Server 收到 `chat:send` 後，依照以下規則處理：

```
/task <描述>     → 新增任務，不送進 agent
/pass <名字>     → 轉讓 driver，不送進 agent
/git diff        → 執行 git diff，結果輸出到 terminal
/git log         → 執行 git log --oneline -10
/git commit <msg> → 執行 git add -A && git commit -m "<msg>"
其他文字         → 若 sender 是 driver，送進 agent stdin
                   若 sender 是 observer，只廣播為 chat 訊息
```

---

## 8. 前端頁面與元件設計

### 8.1 頁面結構

```
App
├── JoinScreen               # 輸入名字、連線位址進入 session
├── ProjectSetupScreen       # Driver 專用：設定 project 路徑並啟動 agent
└── MainScreen               # 主畫面（agent 啟動後進入）
    ├── Header               # session 名稱、線上人數、driver 標示
    ├── AgentControlBar      # project 路徑顯示、重新啟動 / 停止按鈕（driver 限定）
    ├── TaskPanel            # 任務列表
    ├── GitPanel             # Git 狀態
    ├── TerminalPanel        # Agent 輸出（xterm.js）
    └── ChatPanel            # Team chat + 輸入框
```

**頁面流程：**

```
所有人       → JoinScreen（輸入名字連線）
                    ↓
Driver       → ProjectSetupScreen（輸入 project 路徑 → 啟動 agent）
Observer     → 等待畫面（顯示「等待 driver 設定 project...」）
                    ↓ agent:started 事件
所有人       → MainScreen
```

### 8.2 版面配置

```
┌──────────────────────────────────────────────────────┐
│  Header: Paird — my-app   A B C  3 online             │
├──────────────────────────────────────────────────────┤
│  AgentControlBar（driver 限定）                       │
│  📁 /Users/alice/projects/my-app  [重新啟動] [停止]   │
├─────────────────────┬────────────────────────────────┤
│  Tasks (左上)        │  Git Status (右上)              │
│  ─────────────────  │  ─────────────────────────────  │
│  ● running task 1   │  branch: main · 3 changed      │
│  ● running task 2   │  M src/auth/middleware.ts       │
│  ○ queued task 3    │  M src/services/UserService.ts  │
│  ✓ done task 4      │  A src/auth/rateLimiter.ts      │
│                     │  [diff] [log] [commit]          │
├─────────────────────┼────────────────────────────────┤
│  Agent Output (左下) │  Team Chat (右下)               │
│  ─────────────────  │  ─────────────────────────────  │
│  $ claude code ...  │  Claude: Refactoring done.      │
│  Reading files...   │  Alice: check refresh tokens    │
│  Writing auth.ts    │  Bob: +1 saw a bug there        │
│  Tests: 12/14 pass  │                                 │
│                     │  [輸入訊息...............][Send] │
└─────────────────────┴────────────────────────────────┘
```

### 8.3 元件說明

**`<ProjectSetupScreen>`**（Driver 專用）

Agent 尚未啟動時，Driver 看到此畫面，Observer 看到等待提示。

```
┌─────────────────────────────────────┐
│  Paird — 設定 Project               │
│                                      │
│  Project 路徑                        │
│  ┌──────────────────────────────┐   │
│  │  /Users/alice/projects/      │   │  ← 可手動輸入
│  └──────────────────────────────┘   │
│  ✓ 有效的 git repo：my-app           │  ← 即時驗證結果
│                                      │
│  [        啟動 Agent              ]  │
│                                      │
│  最近使用的路徑                       │
│  · /Users/alice/projects/my-app     │  ← 點擊快速填入
│  · /Users/alice/projects/api-server │
└─────────────────────────────────────┘
```

路徑輸入框失去焦點或停止輸入 500ms 後，自動呼叫 `/api/fs/validate` 驗證路徑並顯示結果。最近使用的路徑儲存在 localStorage，最多保留 5 筆。

**`<AgentControlBar>`**（Driver 限定，MainScreen 頂部）

顯示目前執行中的 project 路徑，提供重新啟動與停止控制。Observer 看不到此列。

- **重新啟動**：停止目前 agent → 回到 ProjectSetupScreen
- **停止**：停止 agent，所有人回到等待畫面

**`<TaskPanel>`**

顯示任務列表，狀態用顏色點標示：
- running：綠色實心點，帶 spinner 動畫
- queued：橙色點
- done：灰色點 + 刪除線

Driver 可點擊任務旁的按鈕手動更新狀態。

**`<GitPanel>`**

顯示 `git status` 解析結果，M / A / D 前綴標示變更類型。底部三個快捷按鈕：
- `git diff`：輸出到 TerminalPanel
- `git log`：輸出到 TerminalPanel
- `commit`：彈出輸入框要求填寫 commit message，送出後執行

**`<TerminalPanel>`**

使用 xterm.js 渲染，保留 ANSI color codes，支援捲動。Terminal 本身不可輸入（輸入從 ChatPanel 進入），只顯示輸出。

**`<ChatPanel>`**

訊息列表 + 底部輸入框。訊息依來源區分樣式：
- 自己：右對齊
- 隊友：左對齊，顯示名字
- Agent：左對齊，綠色名稱標示
- System（如 driver 變更通知）：置中、灰色細字

輸入框 placeholder 會依身份變化：
- Driver：「Send command to agent or /task, /pass, /git...」
- Observer：「Message teammates (you're observing)」

---

## 9. 後端模組設計

### 9.1 `ptyBridge.ts`

負責 spawn 和管理 Claude Code process。

```typescript
class PtyBridge {
  private pty: IPty | null = null;

  spawn(workingDir: string): void
  // 啟動 agent process，設定 cols/rows，監聽 onData

  write(data: string): void
  // 寫入 stdin，只有 server 確認 driver 後才呼叫

  resize(cols: number, rows: number): void
  // 前端 terminal 調整大小時同步

  onOutput(callback: (data: string) => void): void
  // 訂閱輸出，server 收到後 broadcast

  kill(): void
  // 結束 process
}
```

### 9.2 `gitWatcher.ts`

定期 polling git 狀態並在有變更時觸發 callback。

```typescript
class GitWatcher {
  private interval: NodeJS.Timeout | null = null;
  private lastStatus: string = '';

  start(repoPath: string, onChange: (status: GitStatus) => void): void
  // 每 3 秒執行 git status --porcelain 和 git branch --show-current
  // 與上次結果比較，有變更才呼叫 onChange

  stop(): void

  parseStatus(raw: string): GitStatus
  // 解析 git status --porcelain 輸出
}
```

### 9.3 `sessionManager.ts`

維護 in-memory session 狀態，處理業務邏輯。

```typescript
class SessionManager {
  private state: SessionState;

  addUser(socketId: string, name: string): User
  removeUser(socketId: string): void
  getDriver(): User | null
  setDriver(socketId: string): void
  isDriver(socketId: string): boolean

  setProject(projectPath: string, projectName: string): void
  // 更新 projectPath、projectName，agentStatus 設為 running
  clearProject(): void
  // 清除 projectPath，agentStatus 設為 idle

  addTask(description: string, createdBy: string): Task
  updateTask(id: string, status: TaskStatus): Task

  addChatMessage(msg: Omit<ChatMessage, 'id' | 'timestamp'>): ChatMessage

  detectTaskCompletion(terminalOutput: string): string | null
  // 掃描 agent 輸出，偵測「task done」相關關鍵字
  // 回傳應標記為 done 的 task id，若無則回傳 null

  getFullState(): SessionState
}
```

### 9.4 `server.ts`（主程式）

組裝以上模組，處理所有 Socket.io 事件。

```typescript
// 事件處理邏輯摘要

socket.on('user:join', ({ name }) => {
  const user = sessionManager.addUser(socket.id, name);
  // 若目前無 driver，自動設為 driver
  if (!sessionManager.getDriver()) {
    sessionManager.setDriver(socket.id);
  }
  socket.emit('session:state', sessionManager.getFullState());
  io.emit('user:joined', user);
});

socket.on('agent:start', async ({ projectPath }) => {
  // 只有 driver 可以啟動
  if (!sessionManager.isDriver(socket.id)) return;

  // 驗證路徑是否存在
  const valid = await validatePath(projectPath);
  if (!valid.exists || !valid.isDirectory) {
    socket.emit('agent:error', { message: `路徑不存在：${projectPath}` });
    return;
  }

  // 若已有 agent 在執行，先停止
  if (ptyBridge.isAlive()) {
    ptyBridge.kill();
    gitWatcher.stop();
  }

  // 啟動新的 agent
  const projectName = path.basename(projectPath);
  sessionManager.setProject(projectPath, projectName);
  ptyBridge.spawn(projectPath);
  gitWatcher.start(projectPath, (status) => {
    io.emit('git:status', status);
  });

  io.emit('agent:started', { projectPath, projectName });
});

socket.on('agent:stop', () => {
  if (!sessionManager.isDriver(socket.id)) return;
  ptyBridge.kill();
  gitWatcher.stop();
  sessionManager.clearProject();
  io.emit('agent:stopped');
});

socket.on('chat:send', ({ content }) => {
  const message = sessionManager.addChatMessage({...});
  io.emit('chat:message', message);

  if (sessionManager.isDriver(socket.id)) {
    if (content.startsWith('/task ')) {
      // 新增任務
    } else if (content.startsWith('/git ')) {
      // 執行 git 指令
    } else {
      ptyBridge.write(content + '\n');  // 送進 agent stdin
    }
  }
});

ptyBridge.onOutput((data) => {
  io.emit('terminal:output', { data });
  // 嘗試偵測任務完成
  const completedTaskId = sessionManager.detectTaskCompletion(data);
  if (completedTaskId) {
    sessionManager.updateTask(completedTaskId, 'done');
    io.emit('task:updated', sessionManager.getTasks());
  }
});
```

---

## 10. 安全性設計

連線安全依開發階段分為兩個模式，透過 `CONNECTION_MODE` 環境變數切換。

### 10.1 v0.1 模式：內網 IP（無驗證）

第一階段假設在**同一個內部網路**下使用，不面向公網，移除所有驗證邏輯以降低開發複雜度。

連線方式：直接用內網 IP 開啟，不需要帶任何 token。

```
http://192.168.x.x:3000
```

server.ts 連線處理（無 middleware）：

```typescript
// CONNECTION_MODE=lan 時，直接接受所有連線
io.on('connection', (socket) => {
  socket.on('user:join', ({ name }) => {
    // 直接加入，不驗證
  });
});
```

啟動前查詢自己的內網 IP：

```bash
# macOS / Linux
ifconfig | grep "inet 192"

# Windows
ipconfig
```

**v0.1 不做的事：**
- 不做 ACCESS_TOKEN 驗證
- 不做 HTTPS
- 不做 rate limiting
- 不做使用者帳號驗證
- 不限制 agent 可存取的檔案系統路徑

### 10.2 v0.2 模式：TOKEN 驗證（公網 / 外部連線）

第二階段開放外部連線時啟用。Server 啟動時讀取環境變數 `ACCESS_TOKEN`，Client 連線時必須在 query string 帶上 token。

```
http://<host>:3000?token=<ACCESS_TOKEN>
```

Socket.io middleware 驗證 token，不符合則拒絕連線：

```typescript
// CONNECTION_MODE=token 時啟用
io.use((socket, next) => {
  const token = socket.handshake.query.token;
  if (token !== process.env.ACCESS_TOKEN) {
    return next(new Error('Unauthorized'));
  }
  next();
});
```

要讓外部連進來可搭配 ngrok：

```bash
ngrok http 3000
# 把 ngrok 給的 https URL 傳給隊友，記得加上 ?token=...
```

### 10.3 連線介面（Join Screen）

Join Screen 依 `CONNECTION_MODE` 自動調整顯示內容。

**v0.1 內網模式（無 token 欄位）：**

```
┌─────────────────────────────────┐
│  🔗  Paird                      │
│                                  │
│  你的名字                        │
│  ┌──────────────────────────┐   │
│  │  Alice                   │   │
│  └──────────────────────────┘   │
│                                  │
│  連線位址                        │
│  ┌──────────────────────────┐   │
│  │  192.168.1.42:3000       │   │  ← 自動偵測並填入內網 IP
│  └──────────────────────────┘   │
│                                  │
│  [        加入 Session        ]  │
│                                  │
│  ℹ️  內網模式，無需驗證           │
└─────────────────────────────────┘
```

**v0.2 TOKEN 模式（加入 token 欄位）：**

```
┌─────────────────────────────────┐
│  🔗  Paird                      │
│                                  │
│  你的名字                        │
│  ┌──────────────────────────┐   │
│  │  Alice                   │   │
│  └──────────────────────────┘   │
│                                  │
│  連線位址                        │
│  ┌──────────────────────────┐   │
│  │  https://abc.ngrok.io    │   │
│  └──────────────────────────┘   │
│                                  │
│  Access Token                    │
│  ┌──────────────────────────┐   │
│  │  ••••••••••••••••        │   │
│  └──────────────────────────┘   │
│                                  │
│  [        加入 Session        ]  │
└─────────────────────────────────┘
```

Join Screen 的連線位址欄位在頁面載入時會自動呼叫 `/api/connection-info` 取得預設值，使用者可手動覆蓋。

```typescript
// GET /api/connection-info
// 回傳當前 server 的連線資訊供 Join Screen 預填
{
  mode: 'lan' | 'token',
  defaultAddress: 'http://192.168.1.42:3000',  // lan 模式自動偵測
  requiresToken: false
}
```

### 10.4 指令過濾（兩種模式共用）

送進 agent stdin 的內容，過濾以下字元：
- 控制字元（`\x03`, `\x04` 等）避免意外終止 process
- 超過 4096 bytes 的單次輸入截斷

git commit 的 message 做 shell escaping，防止 command injection。

---

## 11. 開發里程碑

### Week 1：可觀察的 terminal（內網模式）

**目標**：多人可以透過內網 IP 連進來，Driver 指定路徑啟動 agent，所有人觀看輸出

任務清單：
- [ ] 建立 Node.js + Express + Socket.io 基礎架構
- [ ] 實作 `FsValidator`，驗證路徑與 git repo
- [ ] 實作 `PtyBridge`，spawn agent process（Claude Code）
- [ ] PTY stdout 透過 Socket.io broadcast 給所有 client
- [ ] `agent:start` / `agent:stop` socket 事件處理
- [ ] `/api/agent/start`、`/api/fs/validate` endpoint
- [ ] 前端 Join Screen（v0.1 內網模式：名字 + 連線位址，無 token 欄位）
- [ ] 前端 ProjectSetupScreen（路徑輸入 + 即時驗證 + 最近使用記錄）
- [ ] 前端 WaitingScreen（Observer 等待 driver 啟動 agent）
- [ ] `/api/connection-info` endpoint，自動偵測內網 IP 供 Join Screen 預填
- [ ] 前端用 xterm.js 顯示 terminal 輸出
- [ ] 顯示線上使用者列表

**驗收**：Driver 在介面輸入 project 路徑並啟動 agent，兩個瀏覽器視窗同步顯示 agent 輸出。

### Week 2：可操作的聊天介面

**目標**：Driver 可以下指令，team 可以聊天

任務清單：
- [ ] 實作 `SessionManager`，維護 driver 狀態
- [ ] ChatPanel 元件，區分 driver / observer 的輸入行為
- [ ] Driver 訊息送進 agent stdin，observer 訊息只進 team chat
- [ ] `driver:request` 和 `driver:pass` 事件處理
- [ ] `/task` 指令新增任務
- [ ] System 通知（driver 變更、使用者加入/離開）

**驗收**：Driver 輸入訊息，agent 收到並回應；Observer 輸入訊息，只出現在 team chat。

### Week 3：任務列表與 Git 面板

**目標**：完整 UI，可以實際使用

任務清單：
- [ ] 實作 `GitWatcher`，polling git status
- [ ] GitPanel 元件，顯示 modified / added / deleted 檔案
- [ ] git diff / log / commit 快捷按鈕
- [ ] TaskPanel 元件，顯示任務狀態
- [ ] Agent 輸出偵測任務完成關鍵字，自動更新任務狀態
- [ ] Header 顯示 driver 名稱與所有線上使用者
- [ ] 斷線自動重連，重連後補齊 session 狀態

**驗收**：完整 pair programming session 可以運作，任務狀態自動更新，git 面板即時反映檔案變更。

---

## 12. 目錄結構

```
paird/
├── package.json
├── tsconfig.json
├── .env.example
│
├── src/
│   ├── server/
│   │   ├── index.ts              # Express + Socket.io 啟動
│   │   ├── ptyBridge.ts          # Agent process 管理
│   │   ├── gitWatcher.ts         # Git 狀態 polling
│   │   ├── sessionManager.ts     # Session 狀態與業務邏輯
│   │   ├── connectionInfo.ts     # 內網 IP 偵測、連線模式判斷
│   │   ├── fsValidator.ts        # 路徑驗證、git repo 偵測
│   │   └── types.ts              # 共用型別（也給 client 用）
│   │
│   └── client/
│       ├── main.tsx              # React 進入點
│       ├── store.ts              # Zustand store
│       ├── socket.ts             # Socket.io client 初始化
│       │
│       ├── screens/
│       │   ├── JoinScreen.tsx        # 連線介面（依模式顯示 lan / token）
│       │   ├── ProjectSetupScreen.tsx # Driver 輸入 project 路徑並啟動 agent
│       │   ├── WaitingScreen.tsx      # Observer 等待 driver 設定 project
│       │   └── MainScreen.tsx
│       │
│       └── components/
│           ├── Header.tsx
│           ├── AgentControlBar.tsx   # project 路徑顯示 + 重啟 / 停止（driver 限定）
│           ├── TaskPanel.tsx
│           ├── GitPanel.tsx
│           ├── TerminalPanel.tsx
│           └── ChatPanel.tsx
│
├── public/                       # Vite build 輸出目錄
└── vite.config.ts
```

---

## 13. 環境設定與啟動方式

### 13.1 `.env.example`

```bash
# Server port
PORT=3000

# 連線模式：lan（內網無驗證）或 token（需驗證，用於公網）
CONNECTION_MODE=lan

# ACCESS_TOKEN：CONNECTION_MODE=token 時必填，lan 模式可留空
ACCESS_TOKEN=

# Agent 啟動指令（預設 Claude Code，未來可換成 codex 等）
AGENT_COMMAND=claude

# Git polling 間隔（毫秒）
GIT_POLL_INTERVAL=3000
```

> `WORKSPACE_PATH` 已從設定檔移除，改由 Driver 在 ProjectSetupScreen 介面上動態指定。

### 13.2 啟動步驟

```bash
# 安裝依賴
npm install

# 複製環境設定
cp .env.example .env
# 只需確認 AGENT_COMMAND 是否正確（預設 claude）
# Project 路徑不需要在此設定，啟動後由 Driver 在介面上指定

# 開發模式（前後端同時啟動）
npm run dev

# 或分開啟動
npm run dev:server   # port 3000
npm run dev:client   # port 5173，proxy 到 3000

# Production build
npm run build
npm start
```

### 13.3 連線方式

**v0.1 內網模式（`CONNECTION_MODE=lan`）：**

查詢自己的內網 IP 後，直接把網址傳給隊友：

```bash
# macOS / Linux
ifconfig | grep "inet 192"

# Windows
ipconfig
```

```
http://192.168.x.x:3000
```

隊友開啟網址後會看到 Join Screen，輸入名字即可加入，不需要 token。

**v0.2 TOKEN 模式（`CONNECTION_MODE=token`）：**

設定 `.env` 中的 `ACCESS_TOKEN`，搭配 ngrok 開放外部連線：

```bash
ngrok http 3000
# 把 ngrok 給的 https URL 傳給隊友，記得加上 ?token=...
# 或直接傳網址，讓對方在 Join Screen 的 Token 欄位填入
```

---

## 14. 已知限制與後續規劃

### 14.1 MVP 已知限制

**只有一個 session**：整個 server 只跑一個 agent process。要支援多個獨立的 pair session，需要重構 session 管理層。

**Task 偵測不精準**：自動偵測 agent 完成任務是依賴關鍵字比對，容易有誤判。較好的做法是讓 driver 手動確認，或使用 agent 的結構化輸出（若有 API 支援）。

**無持久化**：Server 重啟後 task 列表和聊天記錄消失。MVP 階段可接受，後續加 SQLite 或 Redis 即可解決。

**xterm.js 捲動緩衝**：長時間使用後 terminal 緩衝區可能佔用大量記憶體，需要設定 scrollback 上限（建議 1000 行）。

### 14.2 v0.2 後續規劃

- **TOKEN 驗證連線模式**：`CONNECTION_MODE=token` 啟用，Join Screen 顯示 token 欄位，支援公網 / ngrok 連線
- **HTTPS 支援**：搭配 TOKEN 模式一起推出，防止 token 明文傳輸
- 加入持久化（SQLite 儲存 task 和 chat 記錄）
- 支援多個獨立 session（不同 project 或不同 agent）
- Git commit 前顯示 diff preview
- Task 支援指派給特定使用者
- 鍵盤快捷鍵（切換 driver、新增 task）

### 14.3 v1.0 長期規劃

- 使用者帳號系統與細粒度權限
- 嵌入式程式碼編輯器（唯讀 diff 檢視）
- Session 錄製與回放
- 支援 Docker 容器化部署
- HTTPS 與生產環境安全加固

---

*文件維護：請在每次架構決策變更時同步更新本文件。*
