# Paird Week 1 設計文件

> 目標：多人可透過內網 IP 連線，Driver 指定路徑啟動 agent，所有人觀看輸出  
> 驗收：兩個瀏覽器視窗同步顯示 agent 輸出  
> 日期：2026-04-29

---

## 1. 範圍

Week 1 只實作「可觀察的 terminal」，不包含聊天指令、任務列表、Git 面板（Week 2、3 實作）。

**包含：**
- 專案骨架與開發環境設定
- JoinScreen、ProjectSetupScreen、WaitingScreen、MainScreen（含 Header、AgentControlBar、TerminalPanel、ChatPanel 骨架）
- PTY spawn 與 stdout broadcast
- xterm.js 動態 resize
- 內網 IP 自動偵測
- 路徑驗證（存在 + git repo 偵測）
- 最近使用路徑（localStorage，最多 5 筆）
- 線上使用者列表顯示
- Driver 離線自動轉移
- 斷線自動重連

**不包含：**
- 聊天輸入送進 agent stdin（ChatPanel 只做 UI 骨架）
- Task 列表
- Git 面板
- driver:request / driver:pass 事件
- TOKEN 驗證模式（v0.2）

---

## 2. 技術設定

### 2.1 架構方案

Monorepo，前後端各自獨立 tsconfig，共用型別放在 `src/shared/types.ts`。

- 後端：`tsx watch`，target CommonJS
- 前端：Vite，target ESNext
- 開發：`npm run dev`（concurrently）或分開 `npm run dev:server` / `npm run dev:client`

### 2.2 npm scripts

```json
{
  "dev": "concurrently \"npm:dev:server\" \"npm:dev:client\"",
  "dev:server": "tsx watch src/server/index.ts",
  "dev:client": "vite",
  "build": "vite build && tsc -p src/server/tsconfig.json",
  "start": "node dist/server/index.js"
}
```

### 2.3 依賴套件

**後端 dependencies：**
- `express` ^4
- `socket.io` ^4
- `node-pty` ^1
- `simple-git` ^3
- `dotenv` ^16

**後端 devDependencies：**
- `tsx` ^4
- `typescript` ^5
- `@types/express`, `@types/node`

**前端 dependencies：**
- `react` ^18, `react-dom` ^18
- `socket.io-client` ^4
- `xterm` ^5, `xterm-addon-fit` ^0.8
- `zustand` ^4

**前端 devDependencies：**
- `vite` ^5, `@vitejs/plugin-react`
- `tailwindcss` ^3, `autoprefixer`, `postcss`
- `typescript` ^5, `@types/react`, `@types/react-dom`

---

## 3. 目錄結構

```
paird/
├── package.json
├── tsconfig.base.json        # 共用 TS 基礎設定（strict: true, skipLibCheck: true）
├── vite.config.ts
├── .env.example
│
├── src/
│   ├── shared/
│   │   └── types.ts          # 前後端共用型別
│   │
│   ├── server/
│   │   ├── tsconfig.json     # extends ../../tsconfig.base.json，target: ES2020, module: CommonJS
│   │   ├── index.ts          # Express + Socket.io 啟動，HTTP endpoints，Socket 事件
│   │   ├── ptyBridge.ts      # node-pty 封裝
│   │   ├── sessionManager.ts # in-memory session 狀態
│   │   ├── connectionInfo.ts # 內網 IP 偵測
│   │   └── fsValidator.ts    # 路徑驗證
│   │
│   └── client/
│       ├── tsconfig.json     # extends ../../tsconfig.base.json，target: ESNext, module: ESNext
│       ├── main.tsx
│       ├── store.ts          # Zustand store
│       ├── socket.ts         # Socket.io client 初始化與事件訂閱
│       ├── screens/
│       │   ├── JoinScreen.tsx
│       │   ├── ProjectSetupScreen.tsx
│       │   ├── WaitingScreen.tsx
│       │   └── MainScreen.tsx
│       └── components/
│           ├── Header.tsx
│           ├── AgentControlBar.tsx
│           ├── TerminalPanel.tsx
│           └── ChatPanel.tsx  # Week 1 只做 UI 骨架，輸入框無實際功能
│
└── public/
```

---

## 4. 共用型別（src/shared/types.ts）

Week 1 使用的型別子集：

```typescript
export interface User {
  socketId: string;
  name: string;
  joinedAt: Date;
  isDriver: boolean;
}

export interface SessionState {
  driverId: string | null;
  users: User[];
  projectPath: string | null;
  projectName: string | null;
  agentStatus: 'idle' | 'running' | 'stopped';
  tasks: [];       // Week 1 永遠為空陣列
  chatHistory: []; // Week 1 永遠為空陣列
  gitStatus: null; // Week 1 永遠為 null
}

export interface ValidatePathResult {
  exists: boolean;
  isDirectory: boolean;
  isGitRepo: boolean;
  projectName: string;
}

export interface ConnectionInfo {
  mode: 'lan' | 'token';
  defaultAddress: string;
  requiresToken: false;
}
```

---

## 5. 後端模組設計

### 5.1 `fsValidator.ts`

純函式，無狀態。

```typescript
export async function validatePath(p: string): Promise<ValidatePathResult>
```

- 用 `fs.stat` 判斷路徑存在與是否為目錄
- 用 `simple-git(p).checkIsRepo()` 偵測 git repo
- `projectName` 從 `path.basename(p)` 取得

### 5.2 `connectionInfo.ts`

```typescript
export function getLocalIp(): string
// 掃描 os.networkInterfaces()，回傳第一個非 loopback IPv4
// 優先 192.168.x.x，其次 10.x.x.x，找不到則 fallback 'localhost'

export function getConnectionInfo(): ConnectionInfo
// 讀取 process.env.CONNECTION_MODE，組裝 ConnectionInfo 物件
```

### 5.3 `ptyBridge.ts`

```typescript
class PtyBridge {
  spawn(workingDir: string): void
  // 用 process.env.AGENT_COMMAND（預設 'claude'）spawn PTY
  // 初始 cols: 220, rows: 50
  // 監聽 onData，呼叫所有已註冊的 output callback

  write(data: string): void
  // 寫入 stdin；若 PTY 不存在則靜默忽略

  resize(cols: number, rows: number): void

  kill(): void
  // SIGTERM，清空 PTY 引用

  onOutput(callback: (data: string) => void): void
  // 訂閱輸出

  isAlive(): boolean
}
```

`onExit` 時呼叫所有 exit callback（供 `index.ts` broadcast `agent:stopped`）。

### 5.4 `sessionManager.ts`

Week 1 使用的方法：

```typescript
class SessionManager {
  addUser(socketId: string, name: string): User
  removeUser(socketId: string): { removedUser: User, newDriverId: string | null }
  // 若移除的是 driver，自動將下一位設為 driver，回傳新 driverId

  isDriver(socketId: string): boolean
  getDriver(): User | null
  setDriver(socketId: string): void

  setProject(projectPath: string, projectName: string): void
  clearProject(): void

  getFullState(): SessionState
}
```

### 5.5 `index.ts` — HTTP Endpoints

| Method | Path | 說明 |
|--------|------|------|
| `GET` | `/api/health` | `{ status, ptyAlive, projectPath, connectedUsers, uptime }` |
| `GET` | `/api/session` | 回傳 `SessionState` |
| `GET` | `/api/connection-info` | 回傳 `ConnectionInfo` |
| `GET` | `/api/fs/validate?path=...` | 呼叫 `validatePath`，回傳 `ValidatePathResult` |
| `POST` | `/api/agent/start` | Driver 啟動 agent（body: `{ projectPath }`） |
| `GET` | `*` | 提供前端靜態檔案（production build） |

### 5.6 `index.ts` — Socket 事件（Week 1）

**Client → Server：**

| 事件 | 處理邏輯 |
|------|----------|
| `user:join { name }` | `sessionManager.addUser`；若無 driver 自動設為 driver；emit `session:state`；broadcast `user:joined` |
| `agent:start { projectPath }` | 驗證 driver 身份 → `validatePath` → 若已有 PTY 先 kill → `ptyBridge.spawn` → `sessionManager.setProject` → broadcast `agent:started` |
| `agent:stop` | 驗證 driver → `ptyBridge.kill` → `sessionManager.clearProject` → broadcast `agent:stopped` |
| `terminal:resize { cols, rows }` | `ptyBridge.resize` |
| `disconnect` | `sessionManager.removeUser` → broadcast `user:left`；若 driver 變更則 broadcast `driver:changed` |

**Server → Client：**

| 事件 | 時機 |
|------|------|
| `session:state` | user:join 後回傳給該 socket |
| `user:joined` | 有新使用者加入，broadcast |
| `user:left` | 使用者離線，broadcast |
| `driver:changed` | driver 變更，broadcast |
| `agent:started` | agent 啟動成功，broadcast |
| `agent:stopped` | agent 停止（手動或意外），broadcast |
| `agent:error` | agent 啟動失敗，只 emit 給發起者 |
| `terminal:output` | PTY stdout/stderr，broadcast |

---

## 6. 前端設計

### 6.1 Zustand Store（Week 1 欄位）

```typescript
interface AppStore {
  // 連線
  isConnected: boolean;
  mySocketId: string | null;
  myName: string | null;

  // Session
  users: User[];
  driverId: string | null;
  isDriver: () => boolean; // mySocketId === driverId

  // Agent
  projectPath: string | null;
  projectName: string | null;
  agentStatus: 'idle' | 'running' | 'stopped';
}
```

### 6.2 頁面流程

```
App
├── !isConnected                    → JoinScreen
├── isConnected && agentStatus === 'idle' || 'stopped'
│   ├── isDriver()                  → ProjectSetupScreen
│   └── !isDriver()                 → WaitingScreen
└── agentStatus === 'running'       → MainScreen
```

### 6.3 JoinScreen

- 頁面載入時呼叫 `GET /api/connection-info`，預填連線位址欄位
- 使用者填入名字 → 點擊「加入 Session」→ 建立 Socket.io 連線 → emit `user:join { name }`
- 連線位址欄位可手動覆蓋
- v0.1（lan 模式）不顯示 token 欄位

### 6.4 ProjectSetupScreen

- 路徑輸入框：失去焦點或停止輸入 500ms（debounce）後呼叫 `/api/fs/validate`
- 驗證結果：
  - 有效 git repo → 綠色「✓ 有效的 git repo：{projectName}」
  - 存在但非 git repo → 黃色警告「⚠ 非 git repo，可繼續但 git 面板無法使用」
  - 不存在 → 紅色「✗ 路徑不存在」，禁用啟動按鈕
- 最近路徑：從 localStorage 讀取，最多 5 筆，點擊填入，在驗證中或有錯誤時不更新
- 路徑成功啟動後，將路徑存入 localStorage 並去重排序（最新的在前）
- 按「啟動 Agent」→ emit `agent:start { projectPath }`；若收到 `agent:error` 則顯示錯誤訊息

### 6.5 WaitingScreen

顯示「等待 driver 設定 project...」加上線上使用者列表（含 driver 標示）。

### 6.6 MainScreen

```
Header
  Paird — {projectName} | {users.map(name)} | {users.length} online

AgentControlBar（driver only）
  📁 {projectPath}  [重新啟動]  [停止]
  重新啟動：emit agent:stop → 等待 agent:stopped → agentStatus 回到 idle → 進入 ProjectSetupScreen

TerminalPanel
  xterm.js Terminal，fitAddon
  ResizeObserver 監聽容器 div
  → fitAddon.fit() → emit terminal:resize({ cols, rows })
  scrollback: 1000 行上限
  Terminal 本身設為唯讀（不接受鍵盤輸入）

ChatPanel（骨架）
  訊息列表區（空）
  底部輸入框（可輸入但按送出無任何動作）
  placeholder 依身份顯示不同文字
```

---

## 7. 錯誤處理

| 情境 | 處理方式 |
|------|----------|
| 路徑不存在 | `/api/fs/validate` 回傳 `exists: false`，ProjectSetupScreen 顯示紅色錯誤，禁用啟動按鈕 |
| agent spawn 失敗 | server emit `agent:error`，前端顯示錯誤訊息，留在 ProjectSetupScreen |
| Driver 離線 | server 自動將下一位使用者設為 driver，broadcast `driver:changed` |
| PTY 意外結束 | server broadcast `agent:stopped`，所有人回到 WaitingScreen（driver 進 ProjectSetupScreen）|
| 斷線重連 | Socket.io 自動重連，重連後重新 emit `user:join`，server 回傳 `session:state` |
| 非 driver 嘗試啟動 | server 靜默忽略，不 emit 任何事件 |

---

## 8. 環境變數（.env.example）

```bash
PORT=3000
CONNECTION_MODE=lan
ACCESS_TOKEN=
AGENT_COMMAND=claude
GIT_POLL_INTERVAL=3000
```

---

## 9. 驗收條件

1. `npm install && npm run dev` 可成功啟動
2. 開啟兩個瀏覽器視窗，各輸入不同名字加入
3. 第一個加入的人看到 ProjectSetupScreen，第二個看到 WaitingScreen
4. Driver 輸入有效路徑，看到綠色驗證結果
5. Driver 按「啟動 Agent」，兩個視窗都進入 MainScreen
6. Terminal 顯示 claude 的輸出，兩個視窗內容同步
7. 調整視窗大小，terminal 自動 resize
8. Driver 視窗關閉，第二個使用者自動成為 driver，看到 AgentControlBar
