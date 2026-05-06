# Paird Week 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立多人即時觀看同一個 Claude Code agent session 的 Web GUI，完成「可觀察的 terminal」核心功能。

**Architecture:** Monorepo，後端 Node.js + Express + Socket.io + node-pty，前端 React + Vite + xterm.js + Zustand。前後端各自獨立 tsconfig，共用型別放在 `src/shared/types.ts`。PTY stdout 透過 Socket.io broadcast 給所有連線的 client。

**Tech Stack:** Node.js 20+, TypeScript 5, Express 4, Socket.io 4, node-pty, React 18, Vite 5, xterm.js 5, Zustand 4, Tailwind CSS 3

---

## 檔案結構總覽

**新建檔案：**
- `package.json` — root scripts + 全部依賴
- `tsconfig.base.json` — 共用 TS 設定
- `vite.config.ts` — Vite 設定，含 proxy 到 port 3000
- `.env.example` — 環境變數範本
- `index.html` — Vite 前端進入點
- `src/shared/types.ts` — 前後端共用型別
- `src/server/tsconfig.json` — 後端 TS 設定
- `src/server/index.ts` — Express + Socket.io server
- `src/server/ptyBridge.ts` — node-pty 封裝
- `src/server/sessionManager.ts` — in-memory session 狀態
- `src/server/connectionInfo.ts` — 內網 IP 偵測
- `src/server/fsValidator.ts` — 路徑驗證
- `src/client/tsconfig.json` — 前端 TS 設定
- `src/client/main.tsx` — React 進入點
- `src/client/store.ts` — Zustand store
- `src/client/socket.ts` — Socket.io client 初始化與事件訂閱
- `src/client/screens/JoinScreen.tsx`
- `src/client/screens/ProjectSetupScreen.tsx`
- `src/client/screens/WaitingScreen.tsx`
- `src/client/screens/MainScreen.tsx`
- `src/client/components/Header.tsx`
- `src/client/components/AgentControlBar.tsx`
- `src/client/components/TerminalPanel.tsx`
- `src/client/components/ChatPanel.tsx`

---

## Task 1: 專案骨架與依賴設定

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `vite.config.ts`
- Create: `.env.example`
- Create: `index.html`
- Create: `src/server/tsconfig.json`
- Create: `src/client/tsconfig.json`

- [ ] **Step 1: 建立 package.json**

```json
{
  "name": "paird",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "concurrently \"npm:dev:server\" \"npm:dev:client\"",
    "dev:server": "tsx watch src/server/index.ts",
    "dev:client": "vite",
    "build": "vite build && tsc -p src/server/tsconfig.json --outDir dist/server",
    "start": "node dist/server/index.js"
  },
  "dependencies": {
    "dotenv": "^16.0.0",
    "express": "^4.18.0",
    "node-pty": "^1.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "simple-git": "^3.22.0",
    "socket.io": "^4.7.0",
    "socket.io-client": "^4.7.0",
    "xterm": "^5.3.0",
    "xterm-addon-fit": "^0.8.0",
    "zustand": "^4.5.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/node": "^20.0.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.0",
    "concurrently": "^8.2.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "tsx": "^4.7.0",
    "typescript": "^5.3.0",
    "vite": "^5.1.0"
  }
}
```

- [ ] **Step 2: 建立 tsconfig.base.json**

```json
{
  "compilerOptions": {
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  }
}
```

- [ ] **Step 3: 建立 src/server/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "moduleResolution": "node",
    "outDir": "../../dist/server",
    "rootDir": ".."
  },
  "include": [".", "../shared"]
}
```

- [ ] **Step 4: 建立 src/client/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "lib": ["ESNext", "DOM", "DOM.Iterable"],
    "noEmit": true
  },
  "include": [".", "../shared"]
}
```

- [ ] **Step 5: 建立 vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  root: '.',
  build: {
    outDir: 'public',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
      },
    },
  },
})
```

- [ ] **Step 6: 建立 index.html**

```html
<!DOCTYPE html>
<html lang="zh-TW">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Paird</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/client/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: 建立 .env.example**

```bash
PORT=3000
CONNECTION_MODE=lan
ACCESS_TOKEN=
AGENT_COMMAND=claude
GIT_POLL_INTERVAL=3000
```

- [ ] **Step 8: 安裝依賴**

執行：
```bash
npm install
```

預期：`node_modules/` 建立成功，無 error。

- [ ] **Step 9: 初始化 Tailwind CSS**

```bash
npx tailwindcss init -p
```

然後修改 `tailwind.config.js`，將 content 設定為：

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/client/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
}
```

- [ ] **Step 10: commit**

```bash
git add package.json tsconfig.base.json vite.config.ts .env.example index.html tailwind.config.js postcss.config.js src/server/tsconfig.json src/client/tsconfig.json
git commit -m "chore: project scaffold and dependencies"
```

---

## Task 2: 共用型別

**Files:**
- Create: `src/shared/types.ts`

- [ ] **Step 1: 建立 src/shared/types.ts**

```typescript
export interface User {
  socketId: string;
  name: string;
  joinedAt: Date;
  isDriver: boolean;
}

export type AgentStatus = 'idle' | 'running' | 'stopped';

export interface SessionState {
  driverId: string | null;
  users: User[];
  projectPath: string | null;
  projectName: string | null;
  agentStatus: AgentStatus;
  tasks: never[];
  chatHistory: never[];
  gitStatus: null;
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

export interface TerminalResizePayload {
  cols: number;
  rows: number;
}
```

- [ ] **Step 2: commit**

```bash
git add src/shared/types.ts
git commit -m "feat: add shared types"
```

---

## Task 3: `fsValidator.ts`

**Files:**
- Create: `src/server/fsValidator.ts`

- [ ] **Step 1: 建立 src/server/fsValidator.ts**

```typescript
import fs from 'fs/promises'
import path from 'path'
import { simpleGit } from 'simple-git'
import type { ValidatePathResult } from '../shared/types'

export async function validatePath(p: string): Promise<ValidatePathResult> {
  const projectName = path.basename(p)

  let stat
  try {
    stat = await fs.stat(p)
  } catch {
    return { exists: false, isDirectory: false, isGitRepo: false, projectName }
  }

  if (!stat.isDirectory()) {
    return { exists: true, isDirectory: false, isGitRepo: false, projectName }
  }

  let isGitRepo = false
  try {
    isGitRepo = await simpleGit(p).checkIsRepo()
  } catch {
    isGitRepo = false
  }

  return { exists: true, isDirectory: true, isGitRepo, projectName }
}
```

- [ ] **Step 2: 驗證可編譯**

```bash
npx tsx src/server/fsValidator.ts
```

預期：無輸出，無 error（tsx 執行空模組正常退出）。

- [ ] **Step 3: commit**

```bash
git add src/server/fsValidator.ts
git commit -m "feat(server): add fsValidator"
```

---

## Task 4: `connectionInfo.ts`

**Files:**
- Create: `src/server/connectionInfo.ts`

- [ ] **Step 1: 建立 src/server/connectionInfo.ts**

```typescript
import os from 'os'
import type { ConnectionInfo } from '../shared/types'

export function getLocalIp(): string {
  const interfaces = os.networkInterfaces()
  for (const iface of Object.values(interfaces)) {
    if (!iface) continue
    for (const info of iface) {
      if (info.family === 'IPv4' && !info.internal) {
        if (info.address.startsWith('192.168.') || info.address.startsWith('10.')) {
          return info.address
        }
      }
    }
  }
  return 'localhost'
}

export function getConnectionInfo(port: number): ConnectionInfo {
  const mode = (process.env.CONNECTION_MODE === 'token' ? 'token' : 'lan') as 'lan' | 'token'
  const ip = getLocalIp()
  return {
    mode,
    defaultAddress: `http://${ip}:${port}`,
    requiresToken: false,
  }
}
```

- [ ] **Step 2: 快速手動驗證**

```bash
npx tsx -e "import { getLocalIp } from './src/server/connectionInfo.ts'; console.log(getLocalIp())"
```

預期：印出內網 IP（如 `192.168.x.x`）或 `localhost`。

- [ ] **Step 3: commit**

```bash
git add src/server/connectionInfo.ts
git commit -m "feat(server): add connectionInfo LAN IP detection"
```

---

## Task 5: `ptyBridge.ts`

**Files:**
- Create: `src/server/ptyBridge.ts`

- [ ] **Step 1: 建立 src/server/ptyBridge.ts**

```typescript
import * as pty from 'node-pty'

type OutputCallback = (data: string) => void
type ExitCallback = () => void

export class PtyBridge {
  private ptyProcess: pty.IPty | null = null
  private outputCallbacks: OutputCallback[] = []
  private exitCallbacks: ExitCallback[] = []

  spawn(workingDir: string): void {
    if (this.ptyProcess) {
      this.kill()
    }

    const command = process.env.AGENT_COMMAND ?? 'claude'

    this.ptyProcess = pty.spawn(command, [], {
      name: 'xterm-color',
      cols: 220,
      rows: 50,
      cwd: workingDir,
      env: process.env as Record<string, string>,
    })

    this.ptyProcess.onData((data) => {
      for (const cb of this.outputCallbacks) cb(data)
    })

    this.ptyProcess.onExit(() => {
      this.ptyProcess = null
      for (const cb of this.exitCallbacks) cb()
    })
  }

  write(data: string): void {
    this.ptyProcess?.write(data)
  }

  resize(cols: number, rows: number): void {
    this.ptyProcess?.resize(cols, rows)
  }

  kill(): void {
    if (this.ptyProcess) {
      this.ptyProcess.kill('SIGTERM')
      this.ptyProcess = null
    }
  }

  onOutput(callback: OutputCallback): void {
    this.outputCallbacks.push(callback)
  }

  onExit(callback: ExitCallback): void {
    this.exitCallbacks.push(callback)
  }

  isAlive(): boolean {
    return this.ptyProcess !== null
  }
}
```

- [ ] **Step 2: commit**

```bash
git add src/server/ptyBridge.ts
git commit -m "feat(server): add PtyBridge for agent process management"
```

---

## Task 6: `sessionManager.ts`

**Files:**
- Create: `src/server/sessionManager.ts`

- [ ] **Step 1: 建立 src/server/sessionManager.ts**

```typescript
import type { User, SessionState, AgentStatus } from '../shared/types'

export class SessionManager {
  private users: Map<string, User> = new Map()
  private driverId: string | null = null
  private projectPath: string | null = null
  private projectName: string | null = null
  private agentStatus: AgentStatus = 'idle'

  addUser(socketId: string, name: string): User {
    const user: User = {
      socketId,
      name,
      joinedAt: new Date(),
      isDriver: false,
    }
    this.users.set(socketId, user)
    return user
  }

  removeUser(socketId: string): { removedUser: User | null; newDriverId: string | null } {
    const removedUser = this.users.get(socketId) ?? null
    this.users.delete(socketId)

    let newDriverId: string | null = null

    if (this.driverId === socketId) {
      this.driverId = null
      const next = this.users.keys().next().value
      if (next) {
        this.setDriver(next)
        newDriverId = next
      }
    }

    return { removedUser, newDriverId }
  }

  isDriver(socketId: string): boolean {
    return this.driverId === socketId
  }

  getDriver(): User | null {
    if (!this.driverId) return null
    return this.users.get(this.driverId) ?? null
  }

  setDriver(socketId: string): void {
    if (this.driverId) {
      const prev = this.users.get(this.driverId)
      if (prev) prev.isDriver = false
    }
    this.driverId = socketId
    const user = this.users.get(socketId)
    if (user) user.isDriver = true
  }

  setProject(projectPath: string, projectName: string): void {
    this.projectPath = projectPath
    this.projectName = projectName
    this.agentStatus = 'running'
  }

  clearProject(): void {
    this.projectPath = null
    this.projectName = null
    this.agentStatus = 'idle'
  }

  setAgentStatus(status: AgentStatus): void {
    this.agentStatus = status
  }

  getFullState(): SessionState {
    return {
      driverId: this.driverId,
      users: Array.from(this.users.values()),
      projectPath: this.projectPath,
      projectName: this.projectName,
      agentStatus: this.agentStatus,
      tasks: [],
      chatHistory: [],
      gitStatus: null,
    }
  }
}
```

- [ ] **Step 2: commit**

```bash
git add src/server/sessionManager.ts
git commit -m "feat(server): add SessionManager"
```

---

## Task 7: `index.ts` — Express + Socket.io Server

**Files:**
- Create: `src/server/index.ts`

- [ ] **Step 1: 建立 src/server/index.ts**

```typescript
import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import path from 'path'
import { validatePath } from './fsValidator'
import { getConnectionInfo } from './connectionInfo'
import { PtyBridge } from './ptyBridge'
import { SessionManager } from './sessionManager'

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, { cors: { origin: '*' } })

app.use(express.json())

const PORT = Number(process.env.PORT ?? 3000)
const sessionManager = new SessionManager()
const ptyBridge = new PtyBridge()
const startTime = Date.now()

// PTY exit → broadcast agent:stopped
ptyBridge.onExit(() => {
  sessionManager.setAgentStatus('stopped')
  io.emit('agent:stopped')
})

// PTY output → broadcast terminal:output
ptyBridge.onOutput((data) => {
  io.emit('terminal:output', { data })
})

// ─── HTTP Endpoints ───────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    ptyAlive: ptyBridge.isAlive(),
    projectPath: sessionManager.getFullState().projectPath,
    connectedUsers: sessionManager.getFullState().users.length,
    uptime: Math.floor((Date.now() - startTime) / 1000),
  })
})

app.get('/api/session', (_req, res) => {
  res.json(sessionManager.getFullState())
})

app.get('/api/connection-info', (_req, res) => {
  res.json(getConnectionInfo(PORT))
})

app.get('/api/fs/validate', async (req, res) => {
  const p = String(req.query.path ?? '')
  if (!p) {
    res.status(400).json({ error: 'path required' })
    return
  }
  const result = await validatePath(p)
  res.json(result)
})

app.post('/api/agent/start', async (req, res) => {
  const { projectPath } = req.body as { projectPath: string }
  const result = await validatePath(projectPath)
  if (!result.exists || !result.isDirectory) {
    res.status(400).json({ ok: false, error: `路徑不存在：${projectPath}` })
    return
  }
  if (ptyBridge.isAlive()) ptyBridge.kill()
  sessionManager.setProject(projectPath, result.projectName)
  ptyBridge.spawn(projectPath)
  io.emit('agent:started', { projectPath, projectName: result.projectName })
  res.json({ ok: true, projectPath, projectName: result.projectName, isGitRepo: result.isGitRepo })
})

// Serve frontend static files in production
app.use(express.static(path.join(process.cwd(), 'public')))
app.get('*', (_req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'))
})

// ─── Socket.io Events ─────────────────────────────────────────

io.on('connection', (socket) => {
  socket.on('user:join', ({ name }: { name: string }) => {
    const user = sessionManager.addUser(socket.id, name)
    if (!sessionManager.getDriver()) {
      sessionManager.setDriver(socket.id)
    }
    socket.emit('session:state', sessionManager.getFullState())
    socket.broadcast.emit('user:joined', sessionManager.getFullState().users.find(u => u.socketId === socket.id))
  })

  socket.on('agent:start', async ({ projectPath }: { projectPath: string }) => {
    if (!sessionManager.isDriver(socket.id)) return
    const result = await validatePath(projectPath)
    if (!result.exists || !result.isDirectory) {
      socket.emit('agent:error', { message: `路徑不存在：${projectPath}` })
      return
    }
    if (ptyBridge.isAlive()) ptyBridge.kill()
    sessionManager.setProject(projectPath, result.projectName)
    ptyBridge.spawn(projectPath)
    io.emit('agent:started', { projectPath, projectName: result.projectName })
  })

  socket.on('agent:stop', () => {
    if (!sessionManager.isDriver(socket.id)) return
    ptyBridge.kill()
    sessionManager.clearProject()
    io.emit('agent:stopped')
  })

  socket.on('terminal:resize', ({ cols, rows }: { cols: number; rows: number }) => {
    ptyBridge.resize(cols, rows)
  })

  socket.on('disconnect', () => {
    const { removedUser, newDriverId } = sessionManager.removeUser(socket.id)
    if (removedUser) {
      io.emit('user:left', { socketId: socket.id, name: removedUser.name })
    }
    if (newDriverId) {
      io.emit('driver:changed', {
        newDriverId,
        newDriverName: sessionManager.getDriver()?.name ?? '',
      })
    }
  })
})

httpServer.listen(PORT, () => {
  console.log(`Paird server running on http://localhost:${PORT}`)
})
```

- [ ] **Step 2: 啟動 server 測試**

```bash
cp .env.example .env
npx tsx src/server/index.ts
```

預期：印出 `Paird server running on http://localhost:3000`，無 error。

- [ ] **Step 3: 測試 health endpoint**

在另一個 terminal 執行：
```bash
curl http://localhost:3000/api/health
```

預期：
```json
{"status":"ok","ptyAlive":false,"projectPath":null,"connectedUsers":0,"uptime":0}
```

- [ ] **Step 4: 停止 server，commit**

```bash
git add src/server/index.ts .env
git commit -m "feat(server): add Express + Socket.io server with all Week 1 endpoints"
```

注意：將 `.env` 加入 `.gitignore`：

```bash
echo ".env" >> .gitignore
git add .gitignore
git commit -m "chore: add .env to .gitignore"
```

---

## Task 8: 前端入口與 Zustand Store

**Files:**
- Create: `src/client/main.tsx`
- Create: `src/client/store.ts`
- Create: `src/client/index.css`

- [ ] **Step 1: 建立 src/client/index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 2: 建立 src/client/store.ts**

```typescript
import { create } from 'zustand'
import type { User, AgentStatus } from '../shared/types'

interface AppStore {
  // 連線
  isConnected: boolean
  mySocketId: string | null
  myName: string | null

  // Session
  users: User[]
  driverId: string | null

  // Agent
  projectPath: string | null
  projectName: string | null
  agentStatus: AgentStatus

  // Computed
  isDriver: () => boolean

  // Actions
  setConnected: (socketId: string) => void
  setDisconnected: () => void
  setMyName: (name: string) => void
  setUsers: (users: User[]) => void
  setDriverId: (id: string | null) => void
  setProject: (path: string | null, name: string | null) => void
  setAgentStatus: (status: AgentStatus) => void
}

export const useStore = create<AppStore>((set, get) => ({
  isConnected: false,
  mySocketId: null,
  myName: null,
  users: [],
  driverId: null,
  projectPath: null,
  projectName: null,
  agentStatus: 'idle',

  isDriver: () => {
    const { mySocketId, driverId } = get()
    return mySocketId !== null && mySocketId === driverId
  },

  setConnected: (socketId) => set({ isConnected: true, mySocketId: socketId }),
  setDisconnected: () => set({ isConnected: false, mySocketId: null }),
  setMyName: (name) => set({ myName: name }),
  setUsers: (users) => set({ users }),
  setDriverId: (id) => set({ driverId: id }),
  setProject: (path, name) => set({ projectPath: path, projectName: name }),
  setAgentStatus: (status) => set({ agentStatus: status }),
}))
```

- [ ] **Step 3: 建立 src/client/main.tsx**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 4: 建立 src/client/App.tsx（骨架）**

```tsx
import { useStore } from './store'
import JoinScreen from './screens/JoinScreen'
import ProjectSetupScreen from './screens/ProjectSetupScreen'
import WaitingScreen from './screens/WaitingScreen'
import MainScreen from './screens/MainScreen'

export default function App() {
  const { isConnected, agentStatus, isDriver } = useStore()

  if (!isConnected) return <JoinScreen />
  if (agentStatus === 'running') return <MainScreen />
  if (isDriver()) return <ProjectSetupScreen />
  return <WaitingScreen />
}
```

- [ ] **Step 5: commit**

```bash
git add src/client/
git commit -m "feat(client): add Zustand store and App routing skeleton"
```

---

## Task 9: Socket.io Client 初始化

**Files:**
- Create: `src/client/socket.ts`

- [ ] **Step 1: 建立 src/client/socket.ts**

```typescript
import { io, Socket } from 'socket.io-client'
import { useStore } from './store'
import type { User, SessionState } from '../shared/types'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io({ autoConnect: false })
  }
  return socket
}

export function connectSocket(serverUrl: string, name: string): void {
  const s = getSocket()
  const store = useStore.getState()

  store.setMyName(name)

  if (s.connected) s.disconnect()

  // 重新指向新的 server URL
  socket = io(serverUrl, { autoConnect: false })
  const newSocket = socket

  newSocket.on('connect', () => {
    store.setConnected(newSocket.id!)
    newSocket.emit('user:join', { name })
  })

  newSocket.on('disconnect', () => {
    store.setDisconnected()
  })

  newSocket.on('session:state', (state: SessionState) => {
    store.setUsers(state.users)
    store.setDriverId(state.driverId)
    store.setProject(state.projectPath, state.projectName)
    store.setAgentStatus(state.agentStatus)
  })

  newSocket.on('user:joined', (user: User) => {
    const users = useStore.getState().users
    if (!users.find(u => u.socketId === user.socketId)) {
      store.setUsers([...users, user])
    }
  })

  newSocket.on('user:left', ({ socketId }: { socketId: string }) => {
    store.setUsers(useStore.getState().users.filter(u => u.socketId !== socketId))
  })

  newSocket.on('driver:changed', ({ newDriverId }: { newDriverId: string }) => {
    store.setDriverId(newDriverId)
    const users = useStore.getState().users.map(u => ({
      ...u,
      isDriver: u.socketId === newDriverId,
    }))
    store.setUsers(users)
  })

  newSocket.on('agent:started', ({ projectPath, projectName }: { projectPath: string; projectName: string }) => {
    store.setProject(projectPath, projectName)
    store.setAgentStatus('running')
  })

  newSocket.on('agent:stopped', () => {
    store.setAgentStatus('stopped')
    store.setProject(null, null)
  })

  newSocket.connect()
}

export function emitAgentStart(projectPath: string): void {
  getSocket().emit('agent:start', { projectPath })
}

export function emitAgentStop(): void {
  getSocket().emit('agent:stop')
}

export function emitTerminalResize(cols: number, rows: number): void {
  getSocket().emit('terminal:resize', { cols, rows })
}
```

- [ ] **Step 2: commit**

```bash
git add src/client/socket.ts
git commit -m "feat(client): add Socket.io client with session event handlers"
```

---

## Task 10: JoinScreen

**Files:**
- Create: `src/client/screens/JoinScreen.tsx`

- [ ] **Step 1: 建立 src/client/screens/JoinScreen.tsx**

```tsx
import { useState, useEffect } from 'react'
import { connectSocket } from '../socket'
import type { ConnectionInfo } from '../../shared/types'

export default function JoinScreen() {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/connection-info')
      .then(r => r.json())
      .then((info: ConnectionInfo) => setAddress(info.defaultAddress))
      .catch(() => setAddress('http://localhost:3000'))
  }, [])

  function handleJoin() {
    if (!name.trim() || !address.trim()) return
    setLoading(true)
    connectSocket(address.trim(), name.trim())
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-8 w-full max-w-sm space-y-5">
        <h1 className="text-white text-2xl font-bold">🔗 Paird</h1>

        <div className="space-y-1">
          <label className="text-gray-400 text-sm">你的名字</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            placeholder="Alice"
            className="w-full bg-gray-800 text-white border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="space-y-1">
          <label className="text-gray-400 text-sm">連線位址</label>
          <input
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="http://192.168.x.x:3000"
            className="w-full bg-gray-800 text-white border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
          />
        </div>

        <button
          onClick={handleJoin}
          disabled={!name.trim() || !address.trim() || loading}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium py-2 rounded transition-colors"
        >
          {loading ? '連線中...' : '加入 Session'}
        </button>

        <p className="text-gray-600 text-xs text-center">ℹ️ 內網模式，無需驗證</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: commit**

```bash
git add src/client/screens/JoinScreen.tsx
git commit -m "feat(client): add JoinScreen"
```

---

## Task 11: ProjectSetupScreen

**Files:**
- Create: `src/client/screens/ProjectSetupScreen.tsx`

- [ ] **Step 1: 建立 src/client/screens/ProjectSetupScreen.tsx**

```tsx
import { useState, useEffect, useRef } from 'react'
import { emitAgentStart, getSocket } from '../socket'
import type { ValidatePathResult } from '../../shared/types'

const STORAGE_KEY = 'paird:recentPaths'
const MAX_RECENT = 5

function getRecentPaths(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function saveRecentPath(p: string): void {
  const paths = [p, ...getRecentPaths().filter(x => x !== p)].slice(0, MAX_RECENT)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(paths))
}

export default function ProjectSetupScreen() {
  const [pathInput, setPathInput] = useState('')
  const [validation, setValidation] = useState<ValidatePathResult | null>(null)
  const [validating, setValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recentPaths] = useState<string[]>(getRecentPaths)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const socket = getSocket()
    const handler = ({ message }: { message: string }) => setError(message)
    socket.on('agent:error', handler)
    return () => { socket.off('agent:error', handler) }
  }, [])

  function handlePathChange(value: string) {
    setPathInput(value)
    setValidation(null)
    setError(null)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value.trim()) return
    debounceRef.current = setTimeout(() => validate(value.trim()), 500)
  }

  async function validate(p: string) {
    setValidating(true)
    try {
      const res = await fetch(`/api/fs/validate?path=${encodeURIComponent(p)}`)
      const data: ValidatePathResult = await res.json()
      setValidation(data)
    } catch {
      setError('驗證失敗，請檢查網路連線')
    } finally {
      setValidating(false)
    }
  }

  function handleStart() {
    if (!canStart) return
    saveRecentPath(pathInput.trim())
    emitAgentStart(pathInput.trim())
  }

  const canStart = validation?.exists && validation?.isDirectory && !validating && !error

  function validationMessage() {
    if (validating) return <span className="text-gray-400 text-sm">驗證中...</span>
    if (!validation) return null
    if (!validation.exists) return <span className="text-red-400 text-sm">✗ 路徑不存在</span>
    if (!validation.isDirectory) return <span className="text-red-400 text-sm">✗ 不是目錄</span>
    if (!validation.isGitRepo) return <span className="text-yellow-400 text-sm">⚠ 非 git repo，可繼續但 git 面板無法使用</span>
    return <span className="text-green-400 text-sm">✓ 有效的 git repo：{validation.projectName}</span>
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-8 w-full max-w-md space-y-5">
        <h1 className="text-white text-2xl font-bold">Paird — 設定 Project</h1>

        <div className="space-y-1">
          <label className="text-gray-400 text-sm">Project 路徑</label>
          <input
            type="text"
            value={pathInput}
            onChange={e => handlePathChange(e.target.value)}
            onBlur={() => pathInput.trim() && validate(pathInput.trim())}
            placeholder="/Users/alice/projects/my-app"
            className="w-full bg-gray-800 text-white border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
          />
          <div className="min-h-5">{validationMessage()}</div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>

        <button
          onClick={handleStart}
          disabled={!canStart}
          className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium py-2 rounded transition-colors"
        >
          啟動 Agent
        </button>

        {recentPaths.length > 0 && (
          <div className="space-y-2">
            <p className="text-gray-500 text-xs">最近使用的路徑</p>
            {recentPaths.map(p => (
              <button
                key={p}
                onClick={() => handlePathChange(p)}
                className="block w-full text-left text-gray-400 hover:text-white text-sm truncate"
              >
                · {p}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: commit**

```bash
git add src/client/screens/ProjectSetupScreen.tsx
git commit -m "feat(client): add ProjectSetupScreen with path validation and recent paths"
```

---

## Task 12: WaitingScreen

**Files:**
- Create: `src/client/screens/WaitingScreen.tsx`

- [ ] **Step 1: 建立 src/client/screens/WaitingScreen.tsx**

```tsx
import { useStore } from '../store'

export default function WaitingScreen() {
  const { users, driverId } = useStore()
  const driver = users.find(u => u.socketId === driverId)

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-8 w-full max-w-sm space-y-5 text-center">
        <div className="text-4xl animate-pulse">⏳</div>
        <p className="text-white text-lg">等待 driver 設定 project...</p>
        {driver && (
          <p className="text-gray-400 text-sm">Driver：{driver.name}</p>
        )}
        <div className="space-y-1">
          <p className="text-gray-500 text-xs">線上使用者</p>
          {users.map(u => (
            <div key={u.socketId} className="flex items-center justify-center gap-2 text-sm">
              <span className={u.isDriver ? 'text-yellow-400' : 'text-gray-300'}>{u.name}</span>
              {u.isDriver && <span className="text-yellow-400 text-xs">(driver)</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: commit**

```bash
git add src/client/screens/WaitingScreen.tsx
git commit -m "feat(client): add WaitingScreen"
```

---

## Task 13: Header 與 AgentControlBar 元件

**Files:**
- Create: `src/client/components/Header.tsx`
- Create: `src/client/components/AgentControlBar.tsx`

- [ ] **Step 1: 建立 src/client/components/Header.tsx**

```tsx
import { useStore } from '../store'

export default function Header() {
  const { users, projectName } = useStore()

  return (
    <header className="bg-gray-900 border-b border-gray-700 px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-white font-bold">Paird</span>
        {projectName && (
          <>
            <span className="text-gray-600">—</span>
            <span className="text-green-400 font-mono text-sm">{projectName}</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        {users.map(u => (
          <span
            key={u.socketId}
            className={`text-xs px-2 py-0.5 rounded-full ${u.isDriver ? 'bg-yellow-600 text-white' : 'bg-gray-700 text-gray-300'}`}
            title={u.isDriver ? `${u.name} (driver)` : u.name}
          >
            {u.name}
          </span>
        ))}
        <span className="text-gray-500 text-xs ml-1">{users.length} online</span>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: 建立 src/client/components/AgentControlBar.tsx**

```tsx
import { useStore } from '../store'
import { emitAgentStop } from '../socket'

export default function AgentControlBar() {
  const { projectPath, isDriver } = useStore()

  if (!isDriver()) return null

  return (
    <div className="bg-gray-850 border-b border-gray-700 px-4 py-2 flex items-center gap-3">
      <span className="text-gray-400 text-sm">📁</span>
      <span className="text-gray-300 font-mono text-sm flex-1 truncate">{projectPath}</span>
      <button
        onClick={() => emitAgentStop()}
        className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1 rounded transition-colors"
      >
        重新啟動
      </button>
      <button
        onClick={() => emitAgentStop()}
        className="text-xs bg-red-900 hover:bg-red-800 text-red-300 px-3 py-1 rounded transition-colors"
      >
        停止
      </button>
    </div>
  )
}
```

- [ ] **Step 3: commit**

```bash
git add src/client/components/Header.tsx src/client/components/AgentControlBar.tsx
git commit -m "feat(client): add Header and AgentControlBar components"
```

---

## Task 14: TerminalPanel

**Files:**
- Create: `src/client/components/TerminalPanel.tsx`

- [ ] **Step 1: 建立 src/client/components/TerminalPanel.tsx**

```tsx
import { useEffect, useRef } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import { getSocket, emitTerminalResize } from '../socket'

export default function TerminalPanel() {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const term = new Terminal({
      scrollback: 1000,
      disableStdin: true,
      theme: {
        background: '#0d1117',
        foreground: '#c9d1d9',
      },
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    })
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(containerRef.current)
    fitAddon.fit()

    termRef.current = term
    fitAddonRef.current = fitAddon

    // 訂閱 terminal output
    const socket = getSocket()
    const handler = ({ data }: { data: string }) => term.write(data)
    socket.on('terminal:output', handler)

    // ResizeObserver → sync PTY size
    const ro = new ResizeObserver(() => {
      fitAddon.fit()
      const { cols, rows } = term
      emitTerminalResize(cols, rows)
    })
    ro.observe(containerRef.current)

    return () => {
      socket.off('terminal:output', handler)
      ro.disconnect()
      term.dispose()
    }
  }, [])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="bg-gray-800 border-b border-gray-700 px-3 py-1 text-gray-500 text-xs">
        Agent Output
      </div>
      <div ref={containerRef} className="flex-1 min-h-0 p-2 bg-[#0d1117]" />
    </div>
  )
}
```

- [ ] **Step 2: commit**

```bash
git add src/client/components/TerminalPanel.tsx
git commit -m "feat(client): add TerminalPanel with xterm.js and dynamic resize"
```

---

## Task 15: ChatPanel 骨架

**Files:**
- Create: `src/client/components/ChatPanel.tsx`

- [ ] **Step 1: 建立 src/client/components/ChatPanel.tsx**

```tsx
import { useState } from 'react'
import { useStore } from '../store'

export default function ChatPanel() {
  const [input, setInput] = useState('')
  const { isDriver } = useStore()

  const placeholder = isDriver()
    ? 'Send command to agent or /task, /pass, /git...'
    : 'Message teammates (you\'re observing)'

  return (
    <div className="flex flex-col h-full border-l border-gray-700">
      <div className="bg-gray-800 border-b border-gray-700 px-3 py-1 text-gray-500 text-xs">
        Team Chat
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {/* Week 2 實作聊天訊息列表 */}
        <p className="text-gray-600 text-xs text-center">聊天功能將於 Week 2 實作</p>
      </div>
      <div className="border-t border-gray-700 p-2 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-gray-800 text-white border border-gray-600 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
        />
        <button
          disabled
          className="bg-gray-700 text-gray-500 px-3 py-1.5 rounded text-sm"
        >
          Send
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: commit**

```bash
git add src/client/components/ChatPanel.tsx
git commit -m "feat(client): add ChatPanel skeleton (Week 2 placeholder)"
```

---

## Task 16: MainScreen

**Files:**
- Create: `src/client/screens/MainScreen.tsx`

- [ ] **Step 1: 建立 src/client/screens/MainScreen.tsx**

```tsx
import Header from '../components/Header'
import AgentControlBar from '../components/AgentControlBar'
import TerminalPanel from '../components/TerminalPanel'
import ChatPanel from '../components/ChatPanel'

export default function MainScreen() {
  return (
    <div className="h-screen flex flex-col bg-gray-950 text-white overflow-hidden">
      <Header />
      <AgentControlBar />
      <div className="flex flex-1 min-h-0">
        <div className="flex flex-col flex-1 min-h-0">
          <TerminalPanel />
        </div>
        <div className="w-80 flex flex-col">
          <ChatPanel />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: commit**

```bash
git add src/client/screens/MainScreen.tsx
git commit -m "feat(client): add MainScreen layout"
```

---

## Task 17: 整合測試與驗收

- [ ] **Step 1: 啟動完整開發環境**

```bash
npm run dev
```

預期：
- Server 啟動在 port 3000，印出 `Paird server running on http://localhost:3000`
- Vite 啟動在 port 5173，印出 `Local: http://localhost:5173/`

- [ ] **Step 2: 驗收條件 1 — 兩個視窗加入**

開啟兩個瀏覽器視窗，分別瀏覽 `http://localhost:5173`。
- 視窗 A 輸入名字「Alice」→ 加入
- 視窗 B 輸入名字「Bob」→ 加入

預期：
- Alice 看到 ProjectSetupScreen（第一位加入，自動為 driver）
- Bob 看到 WaitingScreen，顯示「Driver：Alice」

- [ ] **Step 3: 驗收條件 2 — 啟動 Agent**

在 Alice 的視窗輸入一個有效的本機目錄路徑（例如任何存在的資料夾），確認驗證結果顯示正確。
按「啟動 Agent」。

預期：
- 兩個視窗都進入 MainScreen
- Header 顯示 project 名稱與「Alice」「Bob」使用者標籤
- Alice 看到 AgentControlBar，Bob 不顯示

- [ ] **Step 4: 驗收條件 3 — Terminal 同步輸出**

Agent 啟動後，Terminal 應開始顯示 claude 的輸出（若 claude CLI 有安裝）。
兩個視窗的 terminal 內容應同步。

- [ ] **Step 5: 驗收條件 4 — Terminal Resize**

拖曳瀏覽器視窗大小，terminal 應自動調整。

- [ ] **Step 6: 驗收條件 5 — Driver 轉移**

關閉 Alice 的瀏覽器視窗。
預期：Bob 自動成為 driver，看到 AgentControlBar 出現。

- [ ] **Step 7: 最終 commit**

```bash
git add -A
git commit -m "feat: Week 1 complete — observable terminal with multi-user support"
```

---

## 自我審查筆記

**Spec 涵蓋度：**
- ✅ 專案骨架（Task 1）
- ✅ fsValidator（Task 3）
- ✅ connectionInfo + 內網 IP（Task 4）
- ✅ PtyBridge（Task 5）
- ✅ SessionManager（Task 6）
- ✅ HTTP endpoints + Socket 事件（Task 7）
- ✅ Zustand store（Task 8）
- ✅ Socket.io client 事件訂閱（Task 9）
- ✅ JoinScreen（Task 10）
- ✅ ProjectSetupScreen + 路徑驗證 + 最近路徑（Task 11）
- ✅ WaitingScreen（Task 12）
- ✅ Header + AgentControlBar（Task 13）
- ✅ TerminalPanel + xterm.js + resize（Task 14）
- ✅ ChatPanel 骨架（Task 15）
- ✅ MainScreen（Task 16）
- ✅ 整合驗收（Task 17）

**型別一致性確認：**
- `AgentStatus` 在 `types.ts` 定義，`store.ts`、`sessionManager.ts`、`index.ts` 全部 import 使用
- `ValidatePathResult` 在 `types.ts` 定義，`fsValidator.ts` 回傳，`ProjectSetupScreen.tsx` 使用
- `emitAgentStop` 在 `socket.ts` 定義，`AgentControlBar.tsx` 使用
- `emitTerminalResize` 在 `socket.ts` 定義，`TerminalPanel.tsx` 使用
