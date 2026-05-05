# Paird Week 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an operational Week 2 chat workflow where a single chat input powers team chat, driver-to-agent commands, `/task`, `/pass`, and `/git` commands with synced client state and visible error handling.

**Architecture:** Keep the existing Week 1 screen layout and add two focused server-side units: `chatCommandRouter.ts` for parsing and routing `chat:send`, and `gitCommandRunner.ts` for repo-local git command execution that writes back into the terminal stream. Extend shared types, session state, client store, and socket bindings so chat/task/error state is synchronized without introducing TaskPanel or GitPanel UI.

**Tech Stack:** TypeScript, React 18, Zustand, Socket.io, Express, node-pty, simple-git, Vitest, Testing Library

---

## File Structure

**Create:**
- `src/server/chatCommandRouter.ts` — Parse `chat:send` input and return typed routing decisions
- `src/server/gitCommandRunner.ts` — Run `git diff`, `git log`, and `git commit` in the active project path
- `src/server/chatCommandRouter.test.ts` — Unit tests for command parsing and validation rules
- `src/server/sessionManager.test.ts` — Unit tests for chat/task retention and driver handoff helpers
- `src/client/components/ChatPanel.test.tsx` — UI tests for message rendering, placeholders, and input behavior
- `src/client/test-utils.tsx` — Shared test render helper for client component tests
- `vitest.config.ts` — Vitest configuration for jsdom + Node test files

**Modify:**
- `package.json` — Add test scripts and dev dependencies
- `src/shared/types.ts` — Add `Task`, `ChatMessage`, `TaskStatus`, `ChatMessageType`, `AppErrorPayload`
- `src/server/sessionManager.ts` — Persist `chatHistory` and `tasks`, add helper methods
- `src/server/index.ts` — Wire `chat:send`, route command results, emit chat/task/error events
- `src/client/store.ts` — Store chat messages, tasks, and error state
- `src/client/socket.ts` — Hydrate and subscribe to Week 2 socket events
- `src/client/components/ChatPanel.tsx` — Replace placeholder with functional message list and send form
- `src/client/components/Header.tsx` — Ensure driver chip updates cleanly after handoff

---

### Task 1: Add Test Infrastructure And Shared Week 2 Types

**Files:**
- Modify: `package.json`
- Modify: `src/shared/types.ts`
- Create: `vitest.config.ts`

- [ ] **Step 1: Write the failing shared-types test by adding a typecheck-oriented server test scaffold**

Create `src/server/chatCommandRouter.test.ts` with this initial content:

```ts
import { describe, expect, it } from 'vitest'
import type { ChatMessage, Task, AppErrorPayload } from '../shared/types'

describe('week2 shared types', () => {
  it('supports chat messages, tasks, and app errors', () => {
    const message: ChatMessage = {
      id: 'm1',
      senderId: 'socket-1',
      senderName: 'Alice',
      content: 'hello',
      timestamp: new Date('2026-04-30T00:00:00.000Z'),
      type: 'user',
    }

    const task: Task = {
      id: 't1',
      description: 'ship week 2',
      status: 'queued',
      createdAt: new Date('2026-04-30T00:00:00.000Z'),
      updatedAt: new Date('2026-04-30T00:00:00.000Z'),
      createdBy: 'Alice',
    }

    const error: AppErrorPayload = {
      code: 'NOT_DRIVER',
      message: 'Only the driver can run this command.',
    }

    expect(message.type).toBe('user')
    expect(task.status).toBe('queued')
    expect(error.code).toBe('NOT_DRIVER')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails on missing exports**

Run: `npx vitest run src/server/chatCommandRouter.test.ts`

Expected: FAIL with TypeScript errors that `ChatMessage`, `Task`, or `AppErrorPayload` are not exported from `src/shared/types.ts`.

- [ ] **Step 3: Add Week 2 test tooling**

Update `package.json`:

```json
{
  "scripts": {
    "dev": "concurrently \"npm:dev:server\" \"npm:dev:client\"",
    "dev:server": "tsx watch src/server/index.ts",
    "dev:client": "vite",
    "build": "vite build && tsc -p src/server/tsconfig.json --outDir dist/server",
    "start": "node dist/server/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.2",
    "@testing-library/react": "^15.0.7",
    "@testing-library/user-event": "^14.5.2",
    "@vitejs/plugin-react": "^4.2.0",
    "@types/express": "^4.17.0",
    "@types/node": "^20.0.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "autoprefixer": "^10.4.0",
    "concurrently": "^8.2.0",
    "jsdom": "^24.0.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "tsx": "^4.7.0",
    "typescript": "^5.3.0",
    "vite": "^5.1.0",
    "vitest": "^1.6.0"
  }
}
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environmentMatchGlobs: [
      ['src/client/**/*.test.tsx', 'jsdom'],
      ['src/client/**/*.test.ts', 'jsdom'],
    ],
    environment: 'node',
    globals: true,
  },
})
```

- [ ] **Step 4: Add Week 2 shared types**

Replace `src/shared/types.ts` with:

```ts
export interface User {
  socketId: string;
  name: string;
  joinedAt: Date;
  isDriver: boolean;
}

export type AgentStatus = 'idle' | 'running' | 'stopped';
export type TaskStatus = 'queued' | 'running' | 'done' | 'failed';
export type ChatMessageType = 'user' | 'command' | 'system';

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

export interface AppErrorPayload {
  code:
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
  message: string;
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

- [ ] **Step 5: Run the shared-types test again**

Run: `npm test -- src/server/chatCommandRouter.test.ts`

Expected: PASS with 1 test passing.

- [ ] **Step 6: Commit**

```bash
git add package.json vitest.config.ts src/shared/types.ts src/server/chatCommandRouter.test.ts
git commit -m "test: add week 2 shared types and test tooling"
```

---

### Task 2: Persist Chat And Task State In SessionManager

**Files:**
- Modify: `src/server/sessionManager.ts`
- Create: `src/server/sessionManager.test.ts`

- [ ] **Step 1: Write the failing SessionManager tests**

Create `src/server/sessionManager.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { ChatMessage, Task } from '../shared/types'
import { SessionManager } from './sessionManager'

function makeMessage(id: string, content: string): ChatMessage {
  return {
    id,
    senderId: 'socket-1',
    senderName: 'Alice',
    content,
    timestamp: new Date('2026-04-30T00:00:00.000Z'),
    type: 'user',
  }
}

function makeTask(id: string, description: string): Task {
  return {
    id,
    description,
    status: 'queued',
    createdAt: new Date('2026-04-30T00:00:00.000Z'),
    updatedAt: new Date('2026-04-30T00:00:00.000Z'),
    createdBy: 'Alice',
  }
}

describe('SessionManager', () => {
  it('stores chat history and trims to the latest 100 messages', () => {
    const session = new SessionManager()

    for (let index = 0; index < 101; index += 1) {
      session.addChatMessage(makeMessage(`m${index}`, `message ${index}`))
    }

    expect(session.getChatHistory()).toHaveLength(100)
    expect(session.getChatHistory()[0].id).toBe('m1')
    expect(session.getChatHistory()[99].id).toBe('m100')
  })

  it('stores tasks in session state', () => {
    const session = new SessionManager()
    const task = makeTask('t1', 'ship week 2')

    session.addTask(task)

    expect(session.getTasks()).toEqual([task])
    expect(session.getFullState().tasks).toEqual([task])
  })

  it('passes driver to another socket id', () => {
    const session = new SessionManager()
    session.addUser('socket-1', 'Alice')
    session.addUser('socket-2', 'Bob')
    session.setDriver('socket-1')

    session.passDriverTo('socket-2')

    expect(session.getDriver()?.name).toBe('Bob')
    expect(session.getFullState().users.find(user => user.socketId === 'socket-1')?.isDriver).toBe(false)
  })

  it('finds users by exact name', () => {
    const session = new SessionManager()
    session.addUser('socket-1', 'Alice')
    session.addUser('socket-2', 'Bob')

    expect(session.findUsersByName('Bob').map(user => user.socketId)).toEqual(['socket-2'])
    expect(session.findUsersByName('alice')).toEqual([])
  })
})
```

- [ ] **Step 2: Run the SessionManager tests to verify they fail**

Run: `npm test -- src/server/sessionManager.test.ts`

Expected: FAIL because `addChatMessage`, `getChatHistory`, `addTask`, `getTasks`, `findUsersByName`, or `passDriverTo` do not exist yet.

- [ ] **Step 3: Implement the minimal SessionManager changes**

Replace `src/server/sessionManager.ts` with:

```ts
import type { User, SessionState, AgentStatus, ChatMessage, Task } from '../shared/types'

export class SessionManager {
  private users: Map<string, User> = new Map()
  private driverId: string | null = null
  private projectPath: string | null = null
  private projectName: string | null = null
  private agentStatus: AgentStatus = 'idle'
  private chatHistory: ChatMessage[] = []
  private tasks: Task[] = []

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
      const previousDriver = this.users.get(this.driverId)
      if (previousDriver) previousDriver.isDriver = false
    }

    this.driverId = socketId
    const nextDriver = this.users.get(socketId)
    if (nextDriver) nextDriver.isDriver = true
  }

  passDriverTo(socketId: string): void {
    this.setDriver(socketId)
  }

  findUsersByName(name: string): User[] {
    return Array.from(this.users.values()).filter(user => user.name === name)
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

  addChatMessage(message: ChatMessage): void {
    this.chatHistory.push(message)
    if (this.chatHistory.length > 100) {
      this.chatHistory = this.chatHistory.slice(-100)
    }
  }

  getChatHistory(): ChatMessage[] {
    return [...this.chatHistory]
  }

  addTask(task: Task): void {
    this.tasks.push(task)
  }

  getTasks(): Task[] {
    return [...this.tasks]
  }

  getFullState(): SessionState {
    return {
      driverId: this.driverId,
      users: Array.from(this.users.values()),
      projectPath: this.projectPath,
      projectName: this.projectName,
      agentStatus: this.agentStatus,
      tasks: this.getTasks(),
      chatHistory: this.getChatHistory(),
      gitStatus: null,
    }
  }
}
```

- [ ] **Step 4: Run the SessionManager tests again**

Run: `npm test -- src/server/sessionManager.test.ts`

Expected: PASS with 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/server/sessionManager.ts src/server/sessionManager.test.ts
git commit -m "feat(server): persist chat and task session state"
```

---

### Task 3: Build And Test The Chat Command Router

**Files:**
- Create: `src/server/chatCommandRouter.ts`
- Modify: `src/server/chatCommandRouter.test.ts`

- [ ] **Step 1: Replace the placeholder test with real command-router tests**

Replace `src/server/chatCommandRouter.test.ts` with:

```ts
import { describe, expect, it } from 'vitest'
import type { User } from '../shared/types'
import { parseChatCommand } from './chatCommandRouter'

const driver: User = {
  socketId: 'socket-1',
  name: 'Alice',
  joinedAt: new Date('2026-04-30T00:00:00.000Z'),
  isDriver: true,
}

const observer: User = {
  socketId: 'socket-2',
  name: 'Bob',
  joinedAt: new Date('2026-04-30T00:00:00.000Z'),
  isDriver: false,
}

describe('parseChatCommand', () => {
  it('treats observer free text as team chat', () => {
    expect(
      parseChatCommand({
        content: 'hello team',
        sender: observer,
        isDriver: false,
        agentRunning: true,
      }),
    ).toEqual({
      kind: 'team-chat',
      content: 'hello team',
    })
  })

  it('treats driver free text as agent command when the agent is running', () => {
    expect(
      parseChatCommand({
        content: 'run the tests',
        sender: driver,
        isDriver: true,
        agentRunning: true,
      }),
    ).toEqual({
      kind: 'agent-command',
      content: 'run the tests',
    })
  })

  it('rejects driver free text when the agent is not running', () => {
    expect(
      parseChatCommand({
        content: 'run the tests',
        sender: driver,
        isDriver: true,
        agentRunning: false,
      }),
    ).toEqual({
      kind: 'error',
      error: {
        code: 'AGENT_NOT_RUNNING',
        message: 'Start the agent before sending commands.',
      },
    })
  })

  it('parses /task for drivers', () => {
    expect(
      parseChatCommand({
        content: '/task fix reconnect bug',
        sender: driver,
        isDriver: true,
        agentRunning: true,
      }),
    ).toEqual({
      kind: 'task-add',
      description: 'fix reconnect bug',
    })
  })

  it('rejects blank /task descriptions', () => {
    expect(
      parseChatCommand({
        content: '/task   ',
        sender: driver,
        isDriver: true,
        agentRunning: true,
      }),
    ).toEqual({
      kind: 'error',
      error: {
        code: 'TASK_DESCRIPTION_REQUIRED',
        message: 'Provide a task description after /task.',
      },
    })
  })

  it('parses /pass for drivers', () => {
    expect(
      parseChatCommand({
        content: '/pass Bob',
        sender: driver,
        isDriver: true,
        agentRunning: true,
      }),
    ).toEqual({
      kind: 'driver-pass',
      targetName: 'Bob',
    })
  })

  it('rejects observer /pass commands', () => {
    expect(
      parseChatCommand({
        content: '/pass Alice',
        sender: observer,
        isDriver: false,
        agentRunning: true,
      }),
    ).toEqual({
      kind: 'error',
      error: {
        code: 'NOT_DRIVER',
        message: 'Only the driver can run this command.',
      },
    })
  })

  it('parses /git diff', () => {
    expect(
      parseChatCommand({
        content: '/git diff',
        sender: driver,
        isDriver: true,
        agentRunning: true,
      }),
    ).toEqual({
      kind: 'git',
      command: 'diff',
      message: null,
    })
  })

  it('parses /git commit with a message', () => {
    expect(
      parseChatCommand({
        content: '/git commit ship week2',
        sender: driver,
        isDriver: true,
        agentRunning: true,
      }),
    ).toEqual({
      kind: 'git',
      command: 'commit',
      message: 'ship week2',
    })
  })

  it('rejects /git commit without a message', () => {
    expect(
      parseChatCommand({
        content: '/git commit',
        sender: driver,
        isDriver: true,
        agentRunning: true,
      }),
    ).toEqual({
      kind: 'error',
      error: {
        code: 'COMMIT_MESSAGE_REQUIRED',
        message: 'Provide a commit message after /git commit.',
      },
    })
  })

  it('rejects unknown slash commands', () => {
    expect(
      parseChatCommand({
        content: '/dance',
        sender: driver,
        isDriver: true,
        agentRunning: true,
      }),
    ).toEqual({
      kind: 'error',
      error: {
        code: 'UNKNOWN_COMMAND',
        message: 'Unsupported command: /dance',
      },
    })
  })
})
```

- [ ] **Step 2: Run the router tests to verify they fail**

Run: `npm test -- src/server/chatCommandRouter.test.ts`

Expected: FAIL because `parseChatCommand` does not exist yet.

- [ ] **Step 3: Implement the minimal command router**

Create `src/server/chatCommandRouter.ts`:

```ts
import type { AppErrorPayload, User } from '../shared/types'

export type ChatCommandResult =
  | { kind: 'team-chat'; content: string }
  | { kind: 'agent-command'; content: string }
  | { kind: 'task-add'; description: string }
  | { kind: 'driver-pass'; targetName: string }
  | { kind: 'git'; command: 'diff' | 'log' | 'commit'; message: string | null }
  | { kind: 'error'; error: AppErrorPayload }
  | { kind: 'ignore' }

interface ParseChatCommandInput {
  content: string
  sender: User
  isDriver: boolean
  agentRunning: boolean
}

function notDriverError(): ChatCommandResult {
  return {
    kind: 'error',
    error: {
      code: 'NOT_DRIVER',
      message: 'Only the driver can run this command.',
    },
  }
}

export function parseChatCommand(input: ParseChatCommandInput): ChatCommandResult {
  const content = input.content.trim()

  if (!content) {
    return { kind: 'ignore' }
  }

  if (!content.startsWith('/')) {
    if (!input.isDriver) {
      return { kind: 'team-chat', content }
    }

    if (!input.agentRunning) {
      return {
        kind: 'error',
        error: {
          code: 'AGENT_NOT_RUNNING',
          message: 'Start the agent before sending commands.',
        },
      }
    }

    return { kind: 'agent-command', content }
  }

  if (content.startsWith('/task')) {
    if (!input.isDriver) return notDriverError()
    const description = content.slice('/task'.length).trim()
    if (!description) {
      return {
        kind: 'error',
        error: {
          code: 'TASK_DESCRIPTION_REQUIRED',
          message: 'Provide a task description after /task.',
        },
      }
    }
    return { kind: 'task-add', description }
  }

  if (content.startsWith('/pass')) {
    if (!input.isDriver) return notDriverError()
    const targetName = content.slice('/pass'.length).trim()
    if (!targetName) {
      return {
        kind: 'error',
        error: {
          code: 'INVALID_COMMAND',
          message: 'Provide a teammate name after /pass.',
        },
      }
    }
    return { kind: 'driver-pass', targetName }
  }

  if (content.startsWith('/git')) {
    if (!input.isDriver) return notDriverError()

    const gitArgs = content.slice('/git'.length).trim()

    if (gitArgs === 'diff') return { kind: 'git', command: 'diff', message: null }
    if (gitArgs === 'log') return { kind: 'git', command: 'log', message: null }

    if (gitArgs.startsWith('commit')) {
      const message = gitArgs.slice('commit'.length).trim()
      if (!message) {
        return {
          kind: 'error',
          error: {
            code: 'COMMIT_MESSAGE_REQUIRED',
            message: 'Provide a commit message after /git commit.',
          },
        }
      }
      return { kind: 'git', command: 'commit', message }
    }

    return {
      kind: 'error',
      error: {
        code: 'INVALID_COMMAND',
        message: 'Supported /git commands are diff, log, and commit.',
      },
    }
  }

  return {
    kind: 'error',
    error: {
      code: 'UNKNOWN_COMMAND',
      message: `Unsupported command: ${content}`,
    },
  }
}
```

- [ ] **Step 4: Run the router tests again**

Run: `npm test -- src/server/chatCommandRouter.test.ts`

Expected: PASS with 11 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/server/chatCommandRouter.ts src/server/chatCommandRouter.test.ts
git commit -m "feat(server): add week 2 chat command router"
```

---

### Task 4: Execute Git Commands And Wire `chat:send` On The Server

**Files:**
- Create: `src/server/gitCommandRunner.ts`
- Modify: `src/server/index.ts`

- [ ] **Step 1: Write the failing git runner test inline in the command-router test file**

Append this test block to `src/server/chatCommandRouter.test.ts`:

```ts
it('rejects /git commit without a message', () => {
  expect(
    parseChatCommand({
      content: '/git commit',
      sender: driver,
      isDriver: true,
      agentRunning: true,
    }),
  ).toEqual({
    kind: 'error',
    error: {
      code: 'COMMIT_MESSAGE_REQUIRED',
      message: 'Provide a commit message after /git commit.',
    },
  })
})
```

Run: `npm test -- src/server/chatCommandRouter.test.ts`

Expected: PASS. This step is a guardrail confirming parser behavior stays stable before `index.ts` wiring work starts.

- [ ] **Step 2: Implement git command execution helper**

Create `src/server/gitCommandRunner.ts`:

```ts
import { spawn } from 'node:child_process'

export interface GitCommandResult {
  ok: boolean
  output: string
}

export async function runGitCommand(
  projectPath: string,
  command: 'diff' | 'log' | 'commit',
  message: string | null,
): Promise<GitCommandResult> {
  const args =
    command === 'diff'
      ? ['diff', '--stat']
      : command === 'log'
        ? ['log', '--oneline', '-10']
        : ['commit', '-m', message ?? '']

  if (command !== 'commit') {
    return await spawnGit(projectPath, 'git', args)
  }

  const addResult = await spawnGit(projectPath, 'git', ['add', '-A'])
  if (!addResult.ok) return addResult

  return await spawnGit(projectPath, 'git', args)
}

function spawnGit(cwd: string, command: string, args: string[]): Promise<GitCommandResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd })
    let output = ''

    child.stdout.on('data', (chunk) => {
      output += chunk.toString()
    })

    child.stderr.on('data', (chunk) => {
      output += chunk.toString()
    })

    child.on('close', (code) => {
      resolve({ ok: code === 0, output })
    })
  })
}
```

- [ ] **Step 3: Wire `chat:send` into `src/server/index.ts`**

Add these imports near the top of `src/server/index.ts`:

```ts
import type { AppErrorPayload, ChatMessage, Task } from '../shared/types'
import { randomUUID } from 'node:crypto'
import { parseChatCommand } from './chatCommandRouter'
import { runGitCommand } from './gitCommandRunner'
```

Add these helpers above `io.on('connection', ...)`:

```ts
function emitError(socketId: string, error: AppErrorPayload): void {
  io.to(socketId).emit('error', error)
}

function broadcastChatMessage(message: ChatMessage): void {
  sessionManager.addChatMessage(message)
  io.emit('chat:message', message)
}

function makeSystemMessage(content: string): ChatMessage {
  return {
    id: randomUUID(),
    senderId: null,
    senderName: 'System',
    content,
    timestamp: new Date(),
    type: 'system',
  }
}
```

Inside the `io.on('connection', (socket) => { ... })` block, add this handler before `socket.on('disconnect', ...)`:

```ts
  socket.on('chat:send', async ({ content }: { content: string }) => {
    const sender = sessionManager.getFullState().users.find((user) => user.socketId === socket.id)
    if (!sender) return

    const result = parseChatCommand({
      content,
      sender,
      isDriver: sessionManager.isDriver(socket.id),
      agentRunning: sessionManager.getFullState().agentStatus === 'running',
    })

    if (result.kind === 'ignore') return

    if (result.kind === 'error') {
      emitError(socket.id, result.error)
      return
    }

    if (result.kind === 'team-chat') {
      broadcastChatMessage({
        id: randomUUID(),
        senderId: sender.socketId,
        senderName: sender.name,
        content: result.content,
        timestamp: new Date(),
        type: 'user',
      })
      return
    }

    if (result.kind === 'agent-command') {
      broadcastChatMessage({
        id: randomUUID(),
        senderId: sender.socketId,
        senderName: sender.name,
        content: result.content,
        timestamp: new Date(),
        type: 'command',
      })
      ptyBridge.write(`${result.content}\r`)
      return
    }

    if (result.kind === 'task-add') {
      const task: Task = {
        id: randomUUID(),
        description: result.description,
        status: 'queued',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: sender.name,
      }

      sessionManager.addTask(task)
      io.emit('task:updated', sessionManager.getTasks())
      broadcastChatMessage(makeSystemMessage(`Task added: ${result.description}`))
      return
    }

    if (result.kind === 'driver-pass') {
      const matches = sessionManager.findUsersByName(result.targetName)

      if (matches.length === 0) {
        emitError(socket.id, {
          code: 'PASS_TARGET_NOT_FOUND',
          message: `No online teammate named ${result.targetName}.`,
        })
        return
      }

      if (matches.length > 1) {
        emitError(socket.id, {
          code: 'PASS_TARGET_AMBIGUOUS',
          message: `Multiple teammates are named ${result.targetName}.`,
        })
        return
      }

      if (matches[0].socketId === socket.id) {
        emitError(socket.id, {
          code: 'PASS_TARGET_SELF',
          message: 'Choose a different teammate for /pass.',
        })
        return
      }

      sessionManager.passDriverTo(matches[0].socketId)
      io.emit('driver:changed', {
        newDriverId: matches[0].socketId,
        newDriverName: matches[0].name,
      })
      broadcastChatMessage(makeSystemMessage(`${sender.name} passed driver to ${matches[0].name}`))
      return
    }

    if (!sessionManager.getFullState().projectPath) {
      emitError(socket.id, {
        code: 'GIT_REPO_REQUIRED',
        message: 'Start the agent in a git repository before running /git commands.',
      })
      return
    }

    const gitResult = await runGitCommand(
      sessionManager.getFullState().projectPath,
      result.command,
      result.message,
    )

    if (gitResult.output) {
      io.emit('terminal:output', { data: `${gitResult.output}\n` })
    }

    if (!gitResult.ok) {
      emitError(socket.id, {
        code: 'GIT_COMMAND_FAILED',
        message: `Git ${result.command} failed.`,
      })
    }
  })
```

- [ ] **Step 4: Run the server-side tests**

Run: `npm test -- src/server/chatCommandRouter.test.ts src/server/sessionManager.test.ts`

Expected: PASS with all server tests green.

- [ ] **Step 5: Run a build check**

Run: `npm run build`

Expected: PASS with the client build and server TypeScript compile succeeding.

- [ ] **Step 6: Commit**

```bash
git add src/server/index.ts src/server/gitCommandRunner.ts
git commit -m "feat(server): wire chat send and git commands"
```

---

### Task 5: Synchronize Week 2 Client Store And Socket Events

**Files:**
- Modify: `src/client/store.ts`
- Modify: `src/client/socket.ts`

- [ ] **Step 1: Write the failing client-store test by creating the ChatPanel test harness**

Create `src/client/test-utils.tsx`:

```tsx
import { ReactNode } from 'react'
import { render } from '@testing-library/react'

export function renderWithApp(ui: ReactNode) {
  return render(<>{ui}</>)
}
```

Create `src/client/components/ChatPanel.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import ChatPanel from './ChatPanel'
import { renderWithApp } from '../test-utils'
import { useStore } from '../store'

vi.mock('../socket', () => ({
  emitChatSend: vi.fn(),
}))

describe('ChatPanel', () => {
  beforeEach(() => {
    useStore.setState({
      isConnected: true,
      mySocketId: 'socket-1',
      myName: 'Alice',
      users: [{ socketId: 'socket-1', name: 'Alice', joinedAt: new Date(), isDriver: true }],
      driverId: 'socket-1',
      projectPath: '/tmp/project',
      projectName: 'project',
      agentStatus: 'running',
      chatMessages: [],
      tasks: [],
      errorMessage: null,
    })
  })

  it('shows the driver placeholder', () => {
    renderWithApp(<ChatPanel />)
    expect(screen.getByPlaceholderText('Send command to agent or /task, /pass, /git...')).toBeInTheDocument()
  })

  it('clears the input after send', () => {
    renderWithApp(<ChatPanel />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'hello' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(input).toHaveValue('')
  })
})
```

- [ ] **Step 2: Run the ChatPanel test to verify it fails**

Run: `npm test -- src/client/components/ChatPanel.test.tsx`

Expected: FAIL because the store does not contain `chatMessages`, `tasks`, or `errorMessage`, and `ChatPanel` does not call a real send helper.

- [ ] **Step 3: Extend the client store**

Replace `src/client/store.ts` with:

```ts
import { create } from 'zustand'
import type { User, AgentStatus, ChatMessage, Task } from '../shared/types'

interface AppStore {
  isConnected: boolean
  mySocketId: string | null
  myName: string | null
  users: User[]
  driverId: string | null
  projectPath: string | null
  projectName: string | null
  agentStatus: AgentStatus
  chatMessages: ChatMessage[]
  tasks: Task[]
  errorMessage: string | null
  isDriver: () => boolean
  setConnected: (socketId: string) => void
  setDisconnected: () => void
  setMyName: (name: string) => void
  setUsers: (users: User[]) => void
  setDriverId: (id: string | null) => void
  setProject: (path: string | null, name: string | null) => void
  setAgentStatus: (status: AgentStatus) => void
  setChatMessages: (messages: ChatMessage[]) => void
  appendChatMessage: (message: ChatMessage) => void
  setTasks: (tasks: Task[]) => void
  setError: (message: string | null) => void
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
  chatMessages: [],
  tasks: [],
  errorMessage: null,

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
  setChatMessages: (messages) => set({ chatMessages: messages }),
  appendChatMessage: (message) => set((state) => ({ chatMessages: [...state.chatMessages, message] })),
  setTasks: (tasks) => set({ tasks }),
  setError: (message) => set({ errorMessage: message }),
}))
```

- [ ] **Step 4: Extend socket bindings**

Update `src/client/socket.ts` with these additions:

```ts
import type { User, SessionState, ChatMessage, Task, AppErrorPayload } from '../shared/types'
```

In the `session:state` handler, add:

```ts
    store.setChatMessages(state.chatHistory)
    store.setTasks(state.tasks)
```

Add these listeners before `newSocket.connect()`:

```ts
  newSocket.on('chat:message', (message: ChatMessage) => {
    store.appendChatMessage(message)
  })

  newSocket.on('task:updated', (tasks: Task[]) => {
    store.setTasks(tasks)
  })

  newSocket.on('error', (error: AppErrorPayload) => {
    store.setError(error.message)
  })
```

Add this exported helper:

```ts
export function emitChatSend(content: string): void {
  getSocket().emit('chat:send', { content })
}
```

- [ ] **Step 5: Run the ChatPanel test again**

Run: `npm test -- src/client/components/ChatPanel.test.tsx`

Expected: FAIL only on the current ChatPanel implementation, with store shape errors resolved.

- [ ] **Step 6: Commit**

```bash
git add src/client/store.ts src/client/socket.ts src/client/test-utils.tsx src/client/components/ChatPanel.test.tsx
git commit -m "feat(client): sync week 2 chat and task state"
```

---

### Task 6: Implement The ChatPanel UI And Verify End-To-End Build Health

**Files:**
- Modify: `src/client/components/ChatPanel.tsx`
- Modify: `src/client/components/Header.tsx`
- Modify: `src/client/components/ChatPanel.test.tsx`

- [ ] **Step 1: Expand the ChatPanel tests to cover rendering and errors**

Replace `src/client/components/ChatPanel.test.tsx` with:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import ChatPanel from './ChatPanel'
import { renderWithApp } from '../test-utils'
import { useStore } from '../store'
import { emitChatSend } from '../socket'

vi.mock('../socket', () => ({
  emitChatSend: vi.fn(),
}))

describe('ChatPanel', () => {
  beforeEach(() => {
    useStore.setState({
      isConnected: true,
      mySocketId: 'socket-1',
      myName: 'Alice',
      users: [{ socketId: 'socket-1', name: 'Alice', joinedAt: new Date(), isDriver: true }],
      driverId: 'socket-1',
      projectPath: '/tmp/project',
      projectName: 'project',
      agentStatus: 'running',
      chatMessages: [
        {
          id: 'm1',
          senderId: 'socket-2',
          senderName: 'Bob',
          content: 'observer message',
          timestamp: new Date('2026-04-30T00:00:00.000Z'),
          type: 'user',
        },
        {
          id: 'm2',
          senderId: null,
          senderName: 'System',
          content: 'Alice passed driver to Bob',
          timestamp: new Date('2026-04-30T00:01:00.000Z'),
          type: 'system',
        },
      ],
      tasks: [],
      errorMessage: 'Only the driver can run this command.',
    })
  })

  it('renders chat messages and system messages', () => {
    renderWithApp(<ChatPanel />)
    expect(screen.getByText('observer message')).toBeInTheDocument()
    expect(screen.getByText('Alice passed driver to Bob')).toBeInTheDocument()
  })

  it('shows the driver placeholder', () => {
    renderWithApp(<ChatPanel />)
    expect(screen.getByPlaceholderText('Send command to agent or /task, /pass, /git...')).toBeInTheDocument()
  })

  it('shows the latest error message', () => {
    renderWithApp(<ChatPanel />)
    expect(screen.getByText('Only the driver can run this command.')).toBeInTheDocument()
  })

  it('sends trimmed content and clears the input', () => {
    renderWithApp(<ChatPanel />)
    const input = screen.getByRole('textbox')

    fireEvent.change(input, { target: { value: '  hello paird  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(emitChatSend).toHaveBeenCalledWith('hello paird')
    expect(input).toHaveValue('')
  })
})
```

- [ ] **Step 2: Run the ChatPanel test to verify it fails**

Run: `npm test -- src/client/components/ChatPanel.test.tsx`

Expected: FAIL because the current component still renders the Week 1 placeholder UI.

- [ ] **Step 3: Implement the minimal ChatPanel UI**

Replace `src/client/components/ChatPanel.tsx` with:

```tsx
import { useState } from 'react'
import { useStore } from '../store'
import { emitChatSend } from '../socket'

export default function ChatPanel() {
  const [input, setInput] = useState('')
  const { isDriver, chatMessages, errorMessage } = useStore()

  const placeholder = isDriver()
    ? 'Send command to agent or /task, /pass, /git...'
    : "Message teammates (you're observing)"

  function handleSend() {
    const content = input.trim()
    if (!content) return
    emitChatSend(content)
    setInput('')
  }

  return (
    <div className="flex h-full flex-col border-l border-gray-700">
      <div className="border-b border-gray-700 bg-gray-800 px-3 py-1 text-xs text-gray-500">
        Team Chat
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {chatMessages.map((message) => (
          <div
            key={message.id}
            className={
              message.type === 'system'
                ? 'text-center text-xs text-gray-500'
                : 'rounded border border-gray-700 bg-gray-900 p-2 text-sm'
            }
          >
            {message.type === 'system' ? (
              <p>{message.content}</p>
            ) : (
              <>
                <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
                  <span>{message.senderName}</span>
                  <span>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p className={message.type === 'command' ? 'text-blue-300' : 'text-gray-100'}>
                  {message.content}
                </p>
              </>
            )}
          </div>
        ))}
      </div>

      {errorMessage && (
        <div className="border-t border-red-900 bg-red-950 px-3 py-2 text-xs text-red-200">
          {errorMessage}
        </div>
      )}

      <div className="flex gap-2 border-t border-gray-700 p-2">
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') handleSend()
          }}
          placeholder={placeholder}
          className="flex-1 rounded border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
        />
        <button
          onClick={handleSend}
          className="rounded bg-blue-700 px-3 py-1.5 text-sm text-white hover:bg-blue-600"
        >
          Send
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Keep Header behavior explicit after driver handoff**

Update `src/client/components/Header.tsx` to derive the driver chip label inline:

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
        {users.map((user) => (
          <span
            key={user.socketId}
            className={`text-xs px-2 py-0.5 rounded-full ${user.isDriver ? 'bg-yellow-600 text-white' : 'bg-gray-700 text-gray-300'}`}
            title={user.isDriver ? `${user.name} (driver)` : user.name}
          >
            {user.isDriver ? `${user.name} • driver` : user.name}
          </span>
        ))}
        <span className="text-gray-500 text-xs ml-1">{users.length} online</span>
      </div>
    </header>
  )
}
```

- [ ] **Step 5: Run the client test suite**

Run: `npm test -- src/client/components/ChatPanel.test.tsx`

Expected: PASS with 4 tests passing.

- [ ] **Step 6: Run full verification**

Run: `npm test`

Expected: PASS with server and client Week 2 tests passing.

Run: `npm run build`

Expected: PASS with Vite build and server TypeScript compile succeeding.

- [ ] **Step 7: Commit**

```bash
git add src/client/components/ChatPanel.tsx src/client/components/ChatPanel.test.tsx src/client/components/Header.tsx
git commit -m "feat(client): ship week 2 chat panel"
```

---

## Self-Review

**Spec coverage:**
- Unified `chat:send` flow: Task 3 and Task 4
- `chatHistory` / `tasks` state: Task 2 and Task 5
- `/task`, `/pass`, `/git diff|log|commit`: Task 3 and Task 4
- Driver handoff UI/state: Task 2, Task 4, and Task 6
- Error handling visibility: Task 3, Task 4, Task 5, and Task 6
- Functional `ChatPanel`: Task 5 and Task 6

**Placeholder scan:**
- No `TODO`, `TBD`, or “implement later” placeholders remain.
- Every code-edit step includes exact file paths and concrete code.

**Type consistency:**
- `ChatMessage`, `Task`, `AppErrorPayload`, `parseChatCommand`, `runGitCommand`, `chatMessages`, `tasks`, and `errorMessage` use consistent names across tasks.

---

Plan complete and saved to `docs/superpowers/plans/2026-04-30-week2-implementation.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
