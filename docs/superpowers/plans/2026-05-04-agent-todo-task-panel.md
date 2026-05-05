# Agent Todo Task Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the manual `/task` system with automatic parsing of Claude Code `TodoWrite` terminal output, making TaskPanel read-only and Agent-driven.

**Architecture:** A new `todoParser.ts` server module feeds PTY output chunks through a debounced line-scanner, emitting `task:synced` to all clients whenever a complete todo batch is detected. The client Zustand store and TaskPanel are updated to consume `AgentTodo[]` instead of the old `Task[]`.

**Tech Stack:** TypeScript, Node.js, Socket.io, Zustand, React, Vitest

---

## File Map

| Action | File | What changes |
|--------|------|--------------|
| **Create** | `src/server/todoParser.ts` | Debounced PTY todo line parser |
| **Create** | `src/server/todoParser.test.ts` | Unit tests for parser |
| **Modify** | `src/shared/types.ts` | Add `AgentTodo`, remove `Task`/`TaskStatus`, update `SessionState` |
| **Modify** | `src/server/sessionManager.ts` | Remove Task CRUD, add `todos: AgentTodo[]` |
| **Modify** | `src/server/sessionManager.test.ts` | Remove task-related test cases |
| **Modify** | `src/server/index.ts` | Wire `todoParser`, remove `task:update` handler, remove `TASK_DONE_PATTERNS` |
| **Modify** | `src/client/store.ts` | `tasks → todos: AgentTodo[]`, remove `setTasks` |
| **Modify** | `src/client/socket.ts` | Listen `task:synced`, remove `emitTaskUpdate`, remove `task:updated` |
| **Modify** | `src/client/components/TaskPanel.tsx` | Render `AgentTodo[]`, remove action buttons |
| **Modify** | `src/client/components/TaskPanel.test.tsx` | Rewrite tests for new UI |

---

## Task 1: Add `AgentTodo` type and update `SessionState`

**Files:**
- Modify: `src/shared/types.ts`

- [ ] **Step 1: Edit `src/shared/types.ts`**

Remove `TaskStatus` and `Task`. Add `AgentTodo`. Change `SessionState.tasks` to `todos`.

```ts
// REMOVE these:
// export type TaskStatus = 'queued' | 'running' | 'done' | 'failed';
// export interface Task { ... }

// ADD this:
export interface AgentTodo {
  text: string;
  status: 'pending' | 'done' | 'failed';
}
```

In `SessionState`, change:
```ts
// BEFORE:
tasks: Task[];

// AFTER:
todos: AgentTodo[];
```

- [ ] **Step 2: Verify TypeScript errors appear where expected**

```bash
npx tsc --noEmit 2>&1 | grep -E "error TS" | head -20
```

Expected: errors in `sessionManager.ts`, `index.ts`, `store.ts`, `socket.ts`, `TaskPanel.tsx` — these will be fixed in later tasks. Zero errors outside those files.

---

## Task 2: Create `todoParser.ts` with tests (TDD)

**Files:**
- Create: `src/server/todoParser.test.ts`
- Create: `src/server/todoParser.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/server/todoParser.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TodoParser } from './todoParser'

describe('TodoParser', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('emits todos after debounce when chunk contains todo lines', async () => {
    const onSync = vi.fn()
    const parser = new TodoParser(onSync, 200)

    parser.feed('☐ 實作登入頁面\n✓ 設計資料庫 schema\n✗ 寫測試\n')
    expect(onSync).not.toHaveBeenCalled()

    vi.advanceTimersByTime(200)
    expect(onSync).toHaveBeenCalledOnce()
    expect(onSync).toHaveBeenCalledWith([
      { text: '實作登入頁面', status: 'pending' },
      { text: '設計資料庫 schema', status: 'done' },
      { text: '寫測試', status: 'failed' },
    ])
  })

  it('does not emit when chunk has no todo lines', () => {
    const onSync = vi.fn()
    const parser = new TodoParser(onSync, 200)

    parser.feed('Some normal terminal output\n')
    vi.advanceTimersByTime(200)
    expect(onSync).not.toHaveBeenCalled()
  })

  it('accumulates todos across multiple chunks before debounce fires', () => {
    const onSync = vi.fn()
    const parser = new TodoParser(onSync, 200)

    parser.feed('☐ 第一項\n')
    vi.advanceTimersByTime(100)
    parser.feed('✓ 第二項\n')
    vi.advanceTimersByTime(200)

    expect(onSync).toHaveBeenCalledOnce()
    expect(onSync).toHaveBeenCalledWith([
      { text: '第一項', status: 'pending' },
      { text: '第二項', status: 'done' },
    ])
  })

  it('ignores mixed non-todo lines within a chunk', () => {
    const onSync = vi.fn()
    const parser = new TodoParser(onSync, 200)

    parser.feed('Running task...\n☐ 項目一\nSome output\n✓ 項目二\n')
    vi.advanceTimersByTime(200)

    expect(onSync).toHaveBeenCalledWith([
      { text: '項目一', status: 'pending' },
      { text: '項目二', status: 'done' },
    ])
  })

  it('handles chunk with leading whitespace before todo symbol', () => {
    const onSync = vi.fn()
    const parser = new TodoParser(onSync, 200)

    parser.feed('  ☐ 有縮排的項目\n')
    vi.advanceTimersByTime(200)

    expect(onSync).toHaveBeenCalledWith([
      { text: '有縮排的項目', status: 'pending' },
    ])
  })

  it('resets batch on each new todo group', () => {
    const onSync = vi.fn()
    const parser = new TodoParser(onSync, 200)

    parser.feed('☐ 第一批\n')
    vi.advanceTimersByTime(200)

    parser.feed('✓ 第二批\n')
    vi.advanceTimersByTime(200)

    expect(onSync).toHaveBeenCalledTimes(2)
    expect(onSync).toHaveBeenNthCalledWith(2, [
      { text: '第二批', status: 'done' },
    ])
  })

  it('clear() resets pending batch and cancels debounce', () => {
    const onSync = vi.fn()
    const parser = new TodoParser(onSync, 200)

    parser.feed('☐ 將被清除\n')
    parser.clear()
    vi.advanceTimersByTime(200)

    expect(onSync).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/server/todoParser.test.ts
```

Expected: FAIL — `Cannot find module './todoParser'`

- [ ] **Step 3: Implement `src/server/todoParser.ts`**

```ts
import type { AgentTodo } from '../shared/types'

const TODO_LINE_RE = /^[ \t]*([☐✓✗])\s+(.+)/

function parseStatus(symbol: string): AgentTodo['status'] {
  if (symbol === '✓') return 'done'
  if (symbol === '✗') return 'failed'
  return 'pending'
}

export class TodoParser {
  private pending: AgentTodo[] = []
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(
    private readonly onSync: (todos: AgentTodo[]) => void,
    private readonly debounceMs: number = 200,
  ) {}

  feed(chunk: string): void {
    const lines = chunk.split('\n')
    for (const line of lines) {
      const match = TODO_LINE_RE.exec(line)
      if (match) {
        this.pending.push({ text: match[2].trim(), status: parseStatus(match[1]) })
      }
    }

    if (this.pending.length === 0) return

    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.timer = null
      const todos = this.pending
      this.pending = []
      this.onSync(todos)
    }, this.debounceMs)
  }

  clear(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.pending = []
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/server/todoParser.test.ts
```

Expected: all 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/todoParser.ts src/server/todoParser.test.ts
git commit -m "feat(server): add TodoParser — debounced PTY todo line scanner"
```

---

## Task 3: Update `sessionManager.ts` — swap Task CRUD for AgentTodo

**Files:**
- Modify: `src/server/sessionManager.ts`
- Modify: `src/server/sessionManager.test.ts`

- [ ] **Step 1: Rewrite `sessionManager.ts`**

Replace the import line at the top:
```ts
// BEFORE:
import type { User, SessionState, AgentStatus, ChatMessage, Task, TaskStatus, GitStatus } from '../shared/types'

// AFTER:
import type { User, SessionState, AgentStatus, AgentTodo, ChatMessage, GitStatus } from '../shared/types'
```

Replace the `private tasks: Task[] = []` field with:
```ts
private todos: AgentTodo[] = []
```

Remove these methods entirely:
- `addTask(task: Task): void`
- `getTasks(): Task[]`
- `updateTaskStatus(taskId: string, status: TaskStatus): Task | null`
- `getRunningTasks(): Task[]`

Add these two methods:
```ts
setTodos(todos: AgentTodo[]): void {
  this.todos = todos
}

getTodos(): AgentTodo[] {
  return [...this.todos]
}
```

In `getFullState()`, change:
```ts
// BEFORE:
tasks: this.getTasks(),

// AFTER:
todos: this.getTodos(),
```

- [ ] **Step 2: Update `sessionManager.test.ts`**

Remove the import of `Task` from shared types:
```ts
// BEFORE:
import type { ChatMessage, Task } from '../shared/types'

// AFTER:
import type { ChatMessage } from '../shared/types'
```

Remove these test cases entirely:
- `'stores tasks in session state'`
- `'updates task status and keeps updated tasks in session state'`
- `'returns null when updating a missing task'`
- `'returns only running tasks for weak auto-complete selection'`
- The `makeTask` helper function

- [ ] **Step 3: Run tests to verify sessionManager tests pass**

```bash
npx vitest run src/server/sessionManager.test.ts
```

Expected: all remaining tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/server/sessionManager.ts src/server/sessionManager.test.ts
git commit -m "refactor(server): replace Task CRUD with AgentTodo in SessionManager"
```

---

## Task 4: Wire `todoParser` into `index.ts`, remove old task logic

**Files:**
- Modify: `src/server/index.ts`

- [ ] **Step 1: Update imports in `index.ts`**

```ts
// BEFORE:
import type { AppErrorPayload, ChatMessage, GitHistoryItem, Task, TaskStatus } from '../shared/types'

// AFTER:
import type { AppErrorPayload, ChatMessage, GitHistoryItem } from '../shared/types'
```

Add the import for `TodoParser`:
```ts
import { TodoParser } from './todoParser'
```

- [ ] **Step 2: Create `todoParser` instance after `sessionManager` and `ptyBridge`**

After this line:
```ts
const ptyBridge = new PtyBridge()
```

Add:
```ts
const todoParser = new TodoParser((todos) => {
  sessionManager.setTodos(todos)
  io.emit('task:synced', { todos })
})
```

- [ ] **Step 3: Replace the PTY output handler**

Replace the entire block from `const TASK_DONE_PATTERNS` through the closing `})` of `ptyBridge.onOutput`:

```ts
// REMOVE:
const TASK_DONE_PATTERNS = [
  /\bdone\b/i,
  /\bcompleted\b/i,
  /\bfinished\b/i,
  /\bimplemented\b/i,
]

ptyBridge.onOutput((data) => {
  sessionManager.appendTerminalOutput(data)
  io.emit('terminal:output', { data })

  const runningTasks = sessionManager.getRunningTasks()
  if (runningTasks.length !== 1) return
  if (!TASK_DONE_PATTERNS.some((pattern) => pattern.test(data))) return

  const currentTask = runningTasks[0]
  if (currentTask.status === 'failed') return

  sessionManager.updateTaskStatus(currentTask.id, 'done')
  io.emit('task:updated', sessionManager.getTasks())
})

// REPLACE WITH:
ptyBridge.onOutput((data) => {
  sessionManager.appendTerminalOutput(data)
  io.emit('terminal:output', { data })
  todoParser.feed(data)
})
```

- [ ] **Step 4: Clear todos on agent start**

Find the `agent:start` socket handler. After `ptyBridge.spawn(projectPath)`, add:
```ts
todoParser.clear()
sessionManager.setTodos([])
```

- [ ] **Step 5: Remove `task:update` socket handler**

Remove this entire block (lines ~251–264 in original):
```ts
socket.on('task:update', ({ id, status }: { id: string; status: TaskStatus }) => {
  if (!sessionManager.isDriver(socket.id)) {
    emitError(socket.id, { code: 'NOT_DRIVER', message: 'Only the driver can run this command.' })
    return
  }

  const updatedTask = sessionManager.updateTaskStatus(id, status)
  if (!updatedTask) {
    emitError(socket.id, { code: 'INVALID_COMMAND', message: 'Task not found.' })
    return
  }

  io.emit('task:updated', sessionManager.getTasks())
})
```

- [ ] **Step 6: Update `session:state` emit to use `todos`**

Find where `session:state` is emitted (on `user:join`). It calls `sessionManager.getFullState()` which now returns `todos` — no change needed here since `getFullState()` was already updated in Task 3.

- [ ] **Step 7: Run full test suite**

```bash
npm test
```

Expected: all tests PASS

- [ ] **Step 8: Commit**

```bash
git add src/server/index.ts
git commit -m "feat(server): wire TodoParser to PTY output, remove manual task events"
```

---

## Task 5: Update client store and socket

**Files:**
- Modify: `src/client/store.ts`
- Modify: `src/client/socket.ts`

- [ ] **Step 1: Update `store.ts`**

Replace the import:
```ts
// BEFORE:
import type {
  User,
  AgentStatus,
  ChatMessage,
  Task,
  GitStatus,
  GitHistoryItem,
  WorkspaceTab,
} from '../shared/types'

// AFTER:
import type {
  User,
  AgentStatus,
  AgentTodo,
  ChatMessage,
  GitStatus,
  GitHistoryItem,
  WorkspaceTab,
} from '../shared/types'
```

In `AppStore` interface, change:
```ts
// BEFORE:
tasks: Task[]
// ...
setTasks: (tasks: Task[]) => void

// AFTER:
todos: AgentTodo[]
// ...
setTodos: (todos: AgentTodo[]) => void
```

In `initialState`, change:
```ts
// BEFORE:
tasks: [],

// AFTER:
todos: [],
```

In the store implementation, change:
```ts
// BEFORE:
setTasks: (tasks) => set({ tasks }),

// AFTER:
setTodos: (todos) => set({ todos }),
```

- [ ] **Step 2: Update `socket.ts`**

Replace the import line:
```ts
// BEFORE:
import type {
  User,
  SessionState,
  ChatMessage,
  Task,
  GitStatus,
  GitHistoryItem,
} from '../shared/types'

// AFTER:
import type {
  User,
  SessionState,
  AgentTodo,
  ChatMessage,
  GitStatus,
  GitHistoryItem,
} from '../shared/types'
```

In `connectSocket`, in the `session:state` handler, change:
```ts
// BEFORE:
store.setTasks(state.tasks)

// AFTER:
store.setTodos(state.todos)
```

Replace the `task:updated` listener with `task:synced`:
```ts
// REMOVE:
newSocket.on('task:updated', (tasks: Task[]) => {
  store.setTasks(tasks)
})

// ADD:
newSocket.on('task:synced', ({ todos }: { todos: AgentTodo[] }) => {
  store.setTodos(todos)
})
```

Remove the `emitTaskUpdate` export function entirely:
```ts
// REMOVE:
export function emitTaskUpdate(id: string, status: 'queued' | 'running' | 'done' | 'failed'): void {
  getSocket().emit('task:update', { id, status })
}
```

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "error TS" | head -20
```

Expected: errors only in `TaskPanel.tsx` and `TaskPanel.test.tsx` — will be fixed in Task 6.

- [ ] **Step 4: Commit**

```bash
git add src/client/store.ts src/client/socket.ts
git commit -m "refactor(client): replace Task[] with AgentTodo[] in store and socket"
```

---

## Task 6: Rewrite `TaskPanel.tsx` and its tests

**Files:**
- Modify: `src/client/components/TaskPanel.tsx`
- Modify: `src/client/components/TaskPanel.test.tsx`

- [ ] **Step 1: Rewrite `TaskPanel.test.tsx` first (TDD)**

```tsx
import { describe, it, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { screen } from '@testing-library/react'
import TaskPanel from './TaskPanel'
import { renderWithApp } from '../test-utils'
import { useStore } from '../store'

describe('TaskPanel', () => {
  it('shows empty state when no todos', () => {
    useStore.setState({ todos: [] })
    renderWithApp(<TaskPanel />)
    expect(screen.getByText('Agent 尚未建立任何 todo')).toBeInTheDocument()
  })

  it('renders pending todo with ☐ symbol', () => {
    useStore.setState({
      todos: [{ text: '實作登入頁面', status: 'pending' }],
    })
    renderWithApp(<TaskPanel />)
    expect(screen.getByText('☐')).toBeInTheDocument()
    expect(screen.getByText('實作登入頁面')).toBeInTheDocument()
  })

  it('renders done todo with ✓ symbol and strikethrough', () => {
    useStore.setState({
      todos: [{ text: '設計資料庫', status: 'done' }],
    })
    renderWithApp(<TaskPanel />)
    const text = screen.getByText('設計資料庫')
    expect(text).toHaveClass('line-through')
    expect(screen.getByText('✓')).toBeInTheDocument()
  })

  it('renders failed todo with ✗ symbol', () => {
    useStore.setState({
      todos: [{ text: '寫測試', status: 'failed' }],
    })
    renderWithApp(<TaskPanel />)
    expect(screen.getByText('✗')).toBeInTheDocument()
    expect(screen.getByText('寫測試')).toBeInTheDocument()
  })

  it('shows no action buttons', () => {
    useStore.setState({
      todos: [{ text: '某個任務', status: 'pending' }],
    })
    renderWithApp(<TaskPanel />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows footer label', () => {
    useStore.setState({ todos: [{ text: 'x', status: 'pending' }] })
    renderWithApp(<TaskPanel />)
    expect(screen.getByText('由 Agent 自動更新')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/client/components/TaskPanel.test.tsx
```

Expected: FAIL — type errors and missing behaviour

- [ ] **Step 3: Rewrite `TaskPanel.tsx`**

```tsx
import { useStore } from '../store'
import type { AgentTodo } from '../../shared/types'

function todoSymbol(status: AgentTodo['status']): string {
  if (status === 'done') return '✓'
  if (status === 'failed') return '✗'
  return '☐'
}

function symbolColor(status: AgentTodo['status']): string {
  if (status === 'done') return 'text-green-500'
  if (status === 'failed') return 'text-red-500'
  return 'text-gray-400 dark:text-gray-500'
}

export default function TaskPanel() {
  const todos = useStore((s) => s.todos)

  return (
    <section className="flex min-h-0 flex-col rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-900">
      <div className="border-b border-gray-200 dark:border-gray-800 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white">
        Tasks
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {todos.length === 0 ? (
          <p className="text-sm text-gray-500">Agent 尚未建立任何 todo</p>
        ) : (
          <ul className="space-y-2">
            {todos.map((todo, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className={`mt-0.5 shrink-0 font-mono ${symbolColor(todo.status)}`}>
                  {todoSymbol(todo.status)}
                </span>
                <span
                  className={
                    todo.status === 'done'
                      ? 'line-through text-gray-400 dark:text-gray-600'
                      : todo.status === 'failed'
                        ? 'text-gray-400 dark:text-gray-500'
                        : 'text-gray-900 dark:text-gray-100'
                  }
                >
                  {todo.text}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {todos.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-800 px-3 py-1.5 text-xs text-gray-400 dark:text-gray-600">
          由 Agent 自動更新
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/client/components/TaskPanel.test.tsx
```

Expected: all 6 tests PASS

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: all tests PASS, zero TypeScript errors

- [ ] **Step 6: Commit**

```bash
git add src/client/components/TaskPanel.tsx src/client/components/TaskPanel.test.tsx
git commit -m "feat(ui): rewrite TaskPanel to render AgentTodo from TodoWrite output"
```

---

## Task 7: Final verification

- [ ] **Step 1: TypeScript clean check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 2: Full test suite**

```bash
npm test
```

Expected: all tests PASS

- [ ] **Step 3: Manual smoke test**

```bash
npm run dev
```

1. 開啟 http://localhost:5173
2. 加入 session，啟動 Agent
3. 讓 Agent 執行一個多步驟任務（例如寫個簡單功能）
4. 確認 TaskPanel 自動出現 todo 項目
5. 確認 `✓` 項目有刪除線、`✗` 項目呈灰色
6. 確認沒有任何 "Mark running / done / failed" 按鈕

- [ ] **Step 4: Final commit if any cleanup needed, otherwise done**
