# Theme Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 🌙/☀️ icon button in the Header that toggles between dark and light theme, stored as session-only React/Zustand state.

**Architecture:** Enable Tailwind `darkMode: 'class'`, add `theme` + `toggleTheme` to Zustand store, sync `document.documentElement.classList` on toggle, and migrate all component colour classes to light-first with `dark:` fallbacks.

**Tech Stack:** React, Zustand, Tailwind CSS v3, xterm.js, Vitest + Testing Library

---

## File Map

| File | Action |
|------|--------|
| `tailwind.config.js` | Modify — add `darkMode: 'class'` |
| `src/client/store.ts` | Modify — add `theme`, `toggleTheme` |
| `src/client/App.tsx` | Modify — sync `dark` class on mount |
| `src/client/components/Header.tsx` | Modify — add toggle button |
| `src/client/components/Header.test.tsx` | Modify — add toggle button test |
| `src/client/components/TerminalPanel.tsx` | Modify — dynamic xterm theme |
| `src/client/components/ChatPanel.tsx` | Modify — colour migration |
| `src/client/components/GitPanel.tsx` | Modify — colour migration |
| `src/client/components/TaskPanel.tsx` | Modify — colour migration |
| `src/client/components/WorkspaceTabs.tsx` | Modify — colour migration |
| `src/client/components/AgentControlBar.tsx` | Modify — colour migration |
| `src/client/components/GitHistoryCard.tsx` | Modify — colour migration |
| `src/client/components/GitHistoryPanel.tsx` | Modify — colour migration |
| `src/client/components/ResizeHandle.tsx` | Modify — colour migration |
| `src/client/screens/JoinScreen.tsx` | Modify — colour migration |
| `src/client/screens/ProjectSetupScreen.tsx` | Modify — colour migration |
| `src/client/screens/WaitingScreen.tsx` | Modify — colour migration |
| `src/client/screens/MainScreen.tsx` | Modify — colour migration |

---

## Task 1: Enable Tailwind dark mode + add store state

**Files:**
- Modify: `tailwind.config.js`
- Modify: `src/client/store.ts`

- [ ] **Step 1: Enable darkMode in Tailwind config**

Replace the content of `tailwind.config.js` with:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/client/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: { extend: {} },
  plugins: [],
}
```

- [ ] **Step 2: Add `theme` and `toggleTheme` to the store interface**

In `src/client/store.ts`, update the `AppStore` interface to add after `gitHistory: GitHistoryItem[]`:

```ts
  theme: 'dark' | 'light'
  toggleTheme: () => void
```

- [ ] **Step 3: Add `theme` to `initialState`**

In `src/client/store.ts`, add to the `initialState` object after `activeWorkspaceTab`:

```ts
  theme: 'dark' as const,
```

- [ ] **Step 4: Add `toggleTheme` action to the store**

In `src/client/store.ts`, add after `clearGitHistory`:

```ts
  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark'
    document.documentElement.classList.toggle('dark', next === 'dark')
    set({ theme: next })
  },
```

- [ ] **Step 5: Sync `dark` class on App mount**

Replace `src/client/App.tsx` with:

```tsx
import { useEffect } from 'react'
import { useStore } from './store'
import JoinScreen from './screens/JoinScreen'
import ProjectSetupScreen from './screens/ProjectSetupScreen'
import WaitingScreen from './screens/WaitingScreen'
import MainScreen from './screens/MainScreen'

export default function App() {
  const { isConnected, agentStatus, isDriver, theme } = useStore()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  if (!isConnected) return <JoinScreen />
  if (agentStatus === 'running') return <MainScreen />
  if (isDriver()) return <ProjectSetupScreen />
  return <WaitingScreen />
}
```

- [ ] **Step 6: Commit**

```bash
git add tailwind.config.js src/client/store.ts src/client/App.tsx
git commit -m "feat: add theme state to store and enable Tailwind dark mode"
```

---

## Task 2: Add theme toggle button to Header

**Files:**
- Modify: `src/client/components/Header.tsx`
- Modify: `src/client/components/Header.test.tsx`

- [ ] **Step 1: Write the failing test**

In `src/client/components/Header.test.tsx`, add inside the `describe('Header')` block after the existing test:

```ts
  it('shows a theme toggle button that calls toggleTheme on click', async () => {
    const toggleTheme = vi.fn()
    useStore.setState({ theme: 'dark', toggleTheme })
    const { user } = renderWithApp(<Header />)
    const btn = screen.getByRole('button', { name: /toggle theme/i })
    expect(btn).toHaveTextContent('🌙')
    await user.click(btn)
    expect(toggleTheme).toHaveBeenCalledOnce()
  })

  it('shows ☀️ when theme is light', () => {
    useStore.setState({ theme: 'light', toggleTheme: vi.fn() })
    renderWithApp(<Header />)
    expect(screen.getByRole('button', { name: /toggle theme/i })).toHaveTextContent('☀️')
  })
```

Also add `import { vi } from 'vitest'` to the imports at the top of the file.

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/client/components/Header.test.tsx
```

Expected: FAIL — "Unable to find role 'button' with name /toggle theme/i"

- [ ] **Step 3: Implement the toggle button in Header**

Replace `src/client/components/Header.tsx` with:

```tsx
import { useStore } from '../store'

export default function Header() {
  const { users, projectName, agentStatus, theme, toggleTheme } = useStore()
  const driver = users.find((user) => user.isDriver)

  return (
    <header className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="text-lg font-bold text-gray-900 dark:text-white">Paird</span>
        <span className="text-sm text-gray-400 dark:text-gray-500">/</span>
        <span className="font-mono text-sm text-green-600 dark:text-green-400">{projectName ?? 'no-project'}</span>
        <span className="rounded-full bg-gray-200 dark:bg-gray-800 px-2 py-0.5 text-xs text-gray-700 dark:text-gray-300">{agentStatus}</span>
      </div>
      <div className="flex items-center gap-2">
        {driver && <span className="rounded-full bg-yellow-100 dark:bg-yellow-700 px-2 py-0.5 text-xs text-yellow-800 dark:text-white">{driver.name} • driver</span>}
        {users.filter((user) => !user.isDriver).map((user) => (
          <span key={user.socketId} className="rounded-full bg-gray-200 dark:bg-gray-800 px-2 py-0.5 text-xs text-gray-700 dark:text-gray-300">
            {user.name}
          </span>
        ))}
        <span className="ml-1 text-xs text-gray-500">{users.length} online</span>
        <button
          aria-label="toggle theme"
          onClick={toggleTheme}
          className="rounded bg-gray-200 dark:bg-gray-800 px-2 py-0.5 text-xs text-gray-700 dark:text-gray-300"
        >
          {theme === 'dark' ? '🌙' : '☀️'}
        </button>
      </div>
    </header>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/client/components/Header.test.tsx
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/client/components/Header.tsx src/client/components/Header.test.tsx
git commit -m "feat: add theme toggle button to Header"
```

---

## Task 3: Dynamic xterm.js theme in TerminalPanel

**Files:**
- Modify: `src/client/components/TerminalPanel.tsx`

- [ ] **Step 1: Update TerminalPanel to read theme and pass dynamic xterm colours**

Replace `src/client/components/TerminalPanel.tsx` with:

```tsx
import { useEffect, useRef } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import { onTerminalOutput, emitTerminalResize, emitTerminalInput } from '../socket'
import { useStore } from '../store'

const XTERM_DARK = { background: '#0d1117', foreground: '#c9d1d9' }
const XTERM_LIGHT = { background: '#ffffff', foreground: '#1e1e1e' }

export default function TerminalPanel() {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const isDriver = useStore((s) => s.isDriver())
  const activeWorkspaceTab = useStore((s) => s.activeWorkspaceTab)
  const theme = useStore((s) => s.theme)

  useEffect(() => {
    if (!containerRef.current) return

    const term = new Terminal({
      scrollback: 1000,
      disableStdin: !isDriver,
      theme: theme === 'dark' ? XTERM_DARK : XTERM_LIGHT,
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    })
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(containerRef.current)
    fitAddon.fit()

    termRef.current = term
    fitAddonRef.current = fitAddon

    let inputDispose: { dispose: () => void } | null = null
    if (isDriver) {
      inputDispose = term.onData((data) => emitTerminalInput(data))
    }

    const unsubscribe = onTerminalOutput((data) => term.write(data))

    const ro = new ResizeObserver(() => {
      fitAddon.fit()
      const { cols, rows } = term
      emitTerminalResize(cols, rows)
    })
    ro.observe(containerRef.current)

    return () => {
      inputDispose?.dispose()
      unsubscribe()
      ro.disconnect()
      term.dispose()
    }
  }, [isDriver, theme])

  useEffect(() => {
    if (activeWorkspaceTab === 'agent-output' && fitAddonRef.current) {
      fitAddonRef.current.fit()
    }
  }, [activeWorkspaceTab])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="bg-gray-200 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700 px-3 py-1 text-gray-500 text-xs">
        Agent Output{isDriver && <span className="ml-2 text-yellow-600 dark:text-yellow-500">• interactive</span>}
      </div>
      <div
        ref={containerRef}
        className={`flex-1 min-h-0 p-2 ${theme === 'dark' ? 'bg-[#0d1117]' : 'bg-white'}`}
      />
    </div>
  )
}
```

- [ ] **Step 2: Run existing tests**

```bash
npx vitest run src/client/
```

Expected: PASS — no TerminalPanel unit tests, so just make sure nothing regresses.

- [ ] **Step 3: Commit**

```bash
git add src/client/components/TerminalPanel.tsx
git commit -m "feat: dynamic xterm theme based on store theme state"
```

---

## Task 4: Migrate remaining components — colours

**Files:**
- Modify: `src/client/components/ChatPanel.tsx`
- Modify: `src/client/components/GitPanel.tsx`
- Modify: `src/client/components/TaskPanel.tsx`
- Modify: `src/client/components/WorkspaceTabs.tsx`
- Modify: `src/client/components/AgentControlBar.tsx`
- Modify: `src/client/components/GitHistoryCard.tsx`
- Modify: `src/client/components/GitHistoryPanel.tsx`
- Modify: `src/client/components/ResizeHandle.tsx`

- [ ] **Step 1: Migrate ChatPanel**

Replace `src/client/components/ChatPanel.tsx` with:

```tsx
import { useState } from 'react'
import { useStore } from '../store'
import { emitChatSend } from '../socket'

export default function ChatPanel() {
  const [input, setInput] = useState('')
  const { isDriver, chatMessages } = useStore()

  const placeholder = isDriver()
    ? 'Send command to agent...'
    : 'Message teammates'

  function handleSend() {
    const content = input.trim()
    if (!content) return
    emitChatSend(content)
    setInput('')
  }

  return (
    <div className="flex h-full flex-col border-l border-gray-300 dark:border-gray-700">
      <div className="border-b border-gray-300 dark:border-gray-700 bg-gray-200 dark:bg-gray-800 px-3 py-1 text-xs text-gray-500">
        Team Chat
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {chatMessages.map((message) => (
          <div
            key={message.id}
            className={
              message.type === 'system'
                ? 'text-center text-xs text-gray-500'
                : 'rounded border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 p-2 text-sm'
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
                <p className={message.type === 'command' ? 'text-blue-500 dark:text-blue-300' : 'text-gray-900 dark:text-gray-100'}>
                  {message.content}
                </p>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2 border-t border-gray-300 dark:border-gray-700 p-2">
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
              event.preventDefault()
              handleSend()
            }
          }}
          placeholder={placeholder}
          className="flex-1 rounded border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none"
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

- [ ] **Step 2: Migrate GitPanel**

Replace `src/client/components/GitPanel.tsx` with:

```tsx
import { useState } from 'react'
import { emitGitAction } from '../socket'
import { useStore } from '../store'

export default function GitPanel() {
  const { gitStatus, isDriver } = useStore()
  const [commitMessage, setCommitMessage] = useState('')

  return (
    <section className="flex min-h-0 flex-col rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-900">
      <div className="border-b border-gray-200 dark:border-gray-800 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white">Git Status</div>
      <div className="space-y-3 p-3">
        {!gitStatus ? (
          <p className="text-sm text-gray-500">No git snapshot yet.</p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm text-green-600 dark:text-green-400">{gitStatus.branch}</span>
              <span className="text-xs text-gray-500">{gitStatus.modified.length + gitStatus.added.length + gitStatus.deleted.length} files</span>
            </div>
            <div className="space-y-2 text-xs text-gray-700 dark:text-gray-300">
              {gitStatus.modified.map((file) => <p key={`m-${file}`}>{file}</p>)}
              {gitStatus.added.map((file) => <p key={`a-${file}`}>{file}</p>)}
              {gitStatus.deleted.map((file) => <p key={`d-${file}`}>{file}</p>)}
            </div>
          </>
        )}
        <div className="flex gap-2">
          <button disabled={!isDriver()} onClick={() => emitGitAction('diff')} className="rounded bg-gray-200 dark:bg-gray-800 px-3 py-1 text-xs text-gray-700 dark:text-gray-200 disabled:cursor-not-allowed disabled:opacity-40">Diff</button>
          <button disabled={!isDriver()} onClick={() => emitGitAction('log')} className="rounded bg-gray-200 dark:bg-gray-800 px-3 py-1 text-xs text-gray-700 dark:text-gray-200 disabled:cursor-not-allowed disabled:opacity-40">Log</button>
        </div>
        <div className="flex gap-2">
          <input
            value={commitMessage}
            onChange={(event) => setCommitMessage(event.target.value)}
            placeholder="Commit message"
            className="flex-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-2 py-1 text-xs text-gray-900 dark:text-white"
          />
          <button
            disabled={!isDriver() || !commitMessage.trim()}
            onClick={() => emitGitAction('commit', commitMessage.trim())}
            className="rounded bg-blue-800 px-3 py-1 text-xs text-blue-100 disabled:opacity-40"
          >
            Commit
          </button>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Migrate TaskPanel**

Replace `src/client/components/TaskPanel.tsx` with:

```tsx
import { useStore } from '../store'
import { emitTaskUpdate } from '../socket'

const STATUS_ORDER = ['running', 'queued', 'failed', 'done'] as const

export default function TaskPanel() {
  const { tasks, isDriver } = useStore()

  const orderedTasks = [...tasks].sort((left, right) => {
    const statusDelta = STATUS_ORDER.indexOf(left.status) - STATUS_ORDER.indexOf(right.status)
    if (statusDelta !== 0) return statusDelta
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  })

  return (
    <section className="flex min-h-0 flex-col rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-900">
      <div className="border-b border-gray-200 dark:border-gray-800 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white">Tasks</div>
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {orderedTasks.length === 0 ? (
          <p className="text-sm text-gray-500">No tasks yet. Use /task &lt;description&gt; to add one.</p>
        ) : (
          orderedTasks.map((task) => (
            <article key={task.id} className="rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-sm text-gray-900 dark:text-gray-100">{task.description}</h3>
                <span className="rounded-full bg-gray-200 dark:bg-gray-800 px-2 py-0.5 text-xs text-gray-700 dark:text-gray-300">{task.status}</span>
              </div>
              <p className="text-xs text-gray-500">By {task.createdBy}</p>
              {isDriver() && task.status !== 'done' && (
                <div className="mt-3 flex gap-2">
                  <button onClick={() => emitTaskUpdate(task.id, 'running')} className="rounded bg-gray-200 dark:bg-gray-800 px-2 py-1 text-xs text-gray-700 dark:text-gray-200">
                    Mark running
                  </button>
                  <button onClick={() => emitTaskUpdate(task.id, 'done')} className="rounded bg-green-100 dark:bg-green-900 px-2 py-1 text-xs text-green-800 dark:text-green-200">
                    Mark done
                  </button>
                  <button onClick={() => emitTaskUpdate(task.id, 'failed')} className="rounded bg-red-100 dark:bg-red-900 px-2 py-1 text-xs text-red-800 dark:text-red-200">
                    Mark failed
                  </button>
                </div>
              )}
            </article>
          ))
        )}
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Migrate WorkspaceTabs**

Replace `src/client/components/WorkspaceTabs.tsx` with:

```tsx
import TerminalPanel from './TerminalPanel'
import GitHistoryPanel from './GitHistoryPanel'
import { useStore } from '../store'

const TABS = [
  { id: 'agent-output', label: 'Agent Output' },
  { id: 'git-history', label: 'Git History' },
] as const

export default function WorkspaceTabs() {
  const activeWorkspaceTab = useStore((state) => state.activeWorkspaceTab)
  const setActiveWorkspaceTab = useStore((state) => state.setActiveWorkspaceTab)

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-900">
      <div className="flex border-b border-gray-200 dark:border-gray-800">
        {TABS.map((tab) => {
          const active = tab.id === activeWorkspaceTab
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveWorkspaceTab(tab.id)}
              className={active
                ? 'border-b border-blue-500 bg-white dark:bg-gray-950 px-4 py-2 text-sm text-gray-900 dark:text-white'
                : 'px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      <div className={activeWorkspaceTab === 'agent-output' ? 'flex flex-col flex-1 min-h-0' : 'hidden'}><TerminalPanel /></div>
      <div className={activeWorkspaceTab === 'git-history' ? 'flex flex-col flex-1 min-h-0' : 'hidden'}><GitHistoryPanel /></div>
    </div>
  )
}
```

- [ ] **Step 5: Migrate AgentControlBar**

Replace `src/client/components/AgentControlBar.tsx` with:

```tsx
import { useStore } from '../store'
import { emitAgentStop } from '../socket'

export default function AgentControlBar() {
  const { projectPath, isDriver } = useStore()

  if (!isDriver()) return null

  return (
    <div className="bg-gray-100 dark:bg-gray-900 border-b border-gray-300 dark:border-gray-700 px-4 py-2 flex items-center gap-3">
      <span className="text-gray-500 dark:text-gray-400 text-sm">📁</span>
      <span className="text-gray-700 dark:text-gray-300 font-mono text-sm flex-1 truncate">{projectPath}</span>
      <button
        onClick={() => emitAgentStop()}
        className="text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-3 py-1 rounded transition-colors"
      >
        重新啟動
      </button>
      <button
        onClick={() => emitAgentStop()}
        className="text-xs bg-red-100 dark:bg-red-900 hover:bg-red-200 dark:hover:bg-red-800 text-red-700 dark:text-red-300 px-3 py-1 rounded transition-colors"
      >
        停止
      </button>
    </div>
  )
}
```

- [ ] **Step 6: Migrate GitHistoryCard**

Replace `src/client/components/GitHistoryCard.tsx` with:

```tsx
import type { GitHistoryItem } from '../../shared/types'

interface GitHistoryCardProps {
  item: GitHistoryItem
  expanded: boolean
  onToggle: () => void
}

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
}

export default function GitHistoryCard({ item, expanded, onToggle }: GitHistoryCardProps) {
  const timestamp = formatTimestamp(item.createdAt)

  return (
    <article className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={`Show details for ${item.command} from ${timestamp}`}
        className="flex w-full flex-col gap-2 px-4 py-3 text-left"
      >
        <div className="flex items-center justify-between gap-3 text-xs text-gray-500">
          <span>{timestamp}</span>
          <span className="rounded-full bg-gray-200 dark:bg-gray-800 px-2 py-0.5 uppercase tracking-wide text-gray-700 dark:text-gray-300">
            {item.kind}
          </span>
        </div>
        <p className="font-mono text-sm text-blue-600 dark:text-blue-300">{item.command}</p>
      </button>
      {expanded && (
        <pre className="overflow-x-auto border-t border-gray-200 dark:border-gray-800 px-4 py-3 text-xs text-gray-700 dark:text-gray-300">
          {item.content}
        </pre>
      )}
    </article>
  )
}
```

- [ ] **Step 7: Migrate GitHistoryPanel**

Replace `src/client/components/GitHistoryPanel.tsx` with:

```tsx
import { useEffect, useState } from 'react'
import GitHistoryCard from './GitHistoryCard'
import { useStore } from '../store'

export default function GitHistoryPanel() {
  const gitHistory = useStore((state) => state.gitHistory)
  const theme = useStore((state) => state.theme)
  const [expandedIds, setExpandedIds] = useState<string[]>(() =>
    gitHistory.length > 0 ? [gitHistory[0].id] : [],
  )

  useEffect(() => {
    if (gitHistory.length === 0) {
      setExpandedIds([])
      return
    }

    const newestId = gitHistory[0].id
    setExpandedIds((current) => (current.includes(newestId) ? current : [newestId, ...current]))
  }, [gitHistory])

  function toggleExpanded(id: string): void {
    setExpandedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    )
  }

  const bgClass = theme === 'dark' ? 'bg-[#0d1117]' : 'bg-gray-50'

  if (gitHistory.length === 0) {
    return (
      <div className={`flex flex-1 items-center justify-center rounded-b-lg ${bgClass} p-6 text-sm text-gray-500`}>
        Run Git Log to view commit history here.
      </div>
    )
  }

  return (
    <div className={`flex flex-1 flex-col gap-3 overflow-y-auto rounded-b-lg ${bgClass} p-3`}>
      {gitHistory.map((item) => (
        <GitHistoryCard
          key={item.id}
          item={item}
          expanded={expandedIds.includes(item.id)}
          onToggle={() => toggleExpanded(item.id)}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 8: Migrate ResizeHandle**

Replace `src/client/components/ResizeHandle.tsx` with:

```tsx
import { PanelResizeHandle } from 'react-resizable-panels'

export default function ResizeHandle() {
  return (
    <PanelResizeHandle className="group flex w-2 items-center justify-center bg-gray-100 dark:bg-gray-900 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors cursor-col-resize">
      <div className="flex flex-col gap-1">
        <div className="h-1 w-1 rounded-full bg-gray-400 dark:bg-gray-600 group-hover:bg-gray-600 dark:group-hover:bg-gray-400 transition-colors" />
        <div className="h-1 w-1 rounded-full bg-gray-400 dark:bg-gray-600 group-hover:bg-gray-600 dark:group-hover:bg-gray-400 transition-colors" />
        <div className="h-1 w-1 rounded-full bg-gray-400 dark:bg-gray-600 group-hover:bg-gray-600 dark:group-hover:bg-gray-400 transition-colors" />
      </div>
    </PanelResizeHandle>
  )
}
```

- [ ] **Step 9: Run all client tests**

```bash
npx vitest run src/client/
```

Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add src/client/components/ChatPanel.tsx src/client/components/GitPanel.tsx src/client/components/TaskPanel.tsx src/client/components/WorkspaceTabs.tsx src/client/components/AgentControlBar.tsx src/client/components/GitHistoryCard.tsx src/client/components/GitHistoryPanel.tsx src/client/components/ResizeHandle.tsx
git commit -m "feat: migrate components to dark: colour classes"
```

---

## Task 5: Migrate screens

**Files:**
- Modify: `src/client/screens/JoinScreen.tsx`
- Modify: `src/client/screens/ProjectSetupScreen.tsx`
- Modify: `src/client/screens/WaitingScreen.tsx`
- Modify: `src/client/screens/MainScreen.tsx`

- [ ] **Step 1: Migrate JoinScreen**

Replace `src/client/screens/JoinScreen.tsx` with:

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-8 w-full max-w-sm space-y-5">
        <h1 className="text-gray-900 dark:text-white text-2xl font-bold">🔗 Paird</h1>

        <div className="space-y-1">
          <label className="text-gray-500 dark:text-gray-400 text-sm">你的名字</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            placeholder="Alice"
            className="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="space-y-1">
          <label className="text-gray-500 dark:text-gray-400 text-sm">連線位址</label>
          <input
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="http://192.168.x.x:3000"
            className="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
          />
        </div>

        <button
          onClick={handleJoin}
          disabled={!name.trim() || !address.trim() || loading}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-400 dark:disabled:text-gray-500 text-white font-medium py-2 rounded transition-colors"
        >
          {loading ? '連線中...' : '加入 Session'}
        </button>

        <p className="text-gray-400 dark:text-gray-600 text-xs text-center">ℹ️ 內網模式，無需驗證</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Migrate ProjectSetupScreen**

Replace `src/client/screens/ProjectSetupScreen.tsx` with:

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
    if (validating) return <span className="text-gray-500 text-sm">驗證中...</span>
    if (!validation) return null
    if (!validation.exists) return <span className="text-red-500 text-sm">✗ 路徑不存在</span>
    if (!validation.isDirectory) return <span className="text-red-500 text-sm">✗ 不是目錄</span>
    if (!validation.isGitRepo) return <span className="text-yellow-500 text-sm">⚠ 非 git repo，可繼續但 git 面板無法使用</span>
    return <span className="text-green-600 dark:text-green-400 text-sm">✓ 有效的 git repo：{validation.projectName}</span>
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-8 w-full max-w-md space-y-5">
        <h1 className="text-gray-900 dark:text-white text-2xl font-bold">Paird — 設定 Project</h1>

        <div className="space-y-1">
          <label className="text-gray-500 dark:text-gray-400 text-sm">Project 路徑</label>
          <input
            type="text"
            value={pathInput}
            onChange={e => handlePathChange(e.target.value)}
            onBlur={() => pathInput.trim() && validate(pathInput.trim())}
            placeholder="/Users/alice/projects/my-app"
            className="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
          />
          <div className="min-h-5">{validationMessage()}</div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>

        <button
          onClick={handleStart}
          disabled={!canStart}
          className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-400 dark:disabled:text-gray-500 text-white font-medium py-2 rounded transition-colors"
        >
          啟動 Agent
        </button>

        {recentPaths.length > 0 && (
          <div className="space-y-2">
            <p className="text-gray-400 dark:text-gray-500 text-xs">最近使用的路徑</p>
            {recentPaths.map(p => (
              <button
                key={p}
                onClick={() => handlePathChange(p)}
                className="block w-full text-left text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm truncate"
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

- [ ] **Step 3: Migrate WaitingScreen**

Replace `src/client/screens/WaitingScreen.tsx` with:

```tsx
import { useStore } from '../store'

export default function WaitingScreen() {
  const { users, driverId } = useStore()
  const driver = users.find(u => u.socketId === driverId)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-8 w-full max-w-sm space-y-5 text-center">
        <div className="text-4xl animate-pulse">⏳</div>
        <p className="text-gray-900 dark:text-white text-lg">等待 driver 設定 project...</p>
        {driver && (
          <p className="text-gray-500 dark:text-gray-400 text-sm">Driver：{driver.name}</p>
        )}
        <div className="space-y-1">
          <p className="text-gray-400 dark:text-gray-500 text-xs">線上使用者</p>
          {users.map(u => (
            <div key={u.socketId} className="flex items-center justify-center gap-2 text-sm">
              <span className={u.isDriver ? 'text-yellow-500 dark:text-yellow-400' : 'text-gray-700 dark:text-gray-300'}>{u.name}</span>
              {u.isDriver && <span className="text-yellow-500 dark:text-yellow-400 text-xs">(driver)</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Migrate MainScreen layout wrappers**

Replace `src/client/screens/MainScreen.tsx` with:

```tsx
import { useRef, useState } from 'react'
import { Panel, PanelGroup } from 'react-resizable-panels'
import Header from '../components/Header'
import AgentControlBar from '../components/AgentControlBar'
import WorkspaceTabs from '../components/WorkspaceTabs'
import ChatPanel from '../components/ChatPanel'
import TaskPanel from '../components/TaskPanel'
import GitPanel from '../components/GitPanel'
import ResizeHandle from '../components/ResizeHandle'
import type { ImperativePanelHandle } from 'react-resizable-panels'

export default function MainScreen() {
  const leftPanelRef = useRef<ImperativePanelHandle>(null)
  const rightPanelRef = useRef<ImperativePanelHandle>(null)
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white">
      <Header />
      <AgentControlBar />
      <div className="flex flex-1 min-h-0">
        <PanelGroup direction="horizontal">
          {leftCollapsed && (
            <button
              onClick={() => leftPanelRef.current?.expand()}
              className="flex w-5 items-center justify-center bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
              aria-label="展開左側面板"
            >
              ›
            </button>
          )}

          <Panel
            ref={leftPanelRef}
            defaultSize={20}
            minSize={15}
            collapsible
            onCollapse={() => setLeftCollapsed(true)}
            onExpand={() => setLeftCollapsed(false)}
          >
            <aside className="flex h-full flex-col gap-4 p-4 overflow-hidden">
              <div className="flex justify-end">
                <button
                  onClick={() => leftPanelRef.current?.collapse()}
                  className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white px-1"
                  aria-label="收合左側面板"
                >
                  ‹
                </button>
              </div>
              <TaskPanel />
              <GitPanel />
            </aside>
          </Panel>

          <ResizeHandle />

          <Panel minSize={30}>
            <main className="flex h-full flex-col">
              <WorkspaceTabs />
            </main>
          </Panel>

          <ResizeHandle />

          <Panel
            ref={rightPanelRef}
            defaultSize={25}
            minSize={15}
            collapsible
            onCollapse={() => setRightCollapsed(true)}
            onExpand={() => setRightCollapsed(false)}
          >
            <aside className="flex h-full flex-col p-4 overflow-hidden">
              <div className="flex justify-start">
                <button
                  onClick={() => rightPanelRef.current?.collapse()}
                  className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white px-1"
                  aria-label="收合右側面板"
                >
                  ›
                </button>
              </div>
              <ChatPanel />
            </aside>
          </Panel>

          {rightCollapsed && (
            <button
              onClick={() => rightPanelRef.current?.expand()}
              className="flex w-5 items-center justify-center bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
              aria-label="展開右側面板"
            >
              ‹
            </button>
          )}
        </PanelGroup>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run all client tests**

```bash
npx vitest run src/client/
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/client/screens/JoinScreen.tsx src/client/screens/ProjectSetupScreen.tsx src/client/screens/WaitingScreen.tsx src/client/screens/MainScreen.tsx
git commit -m "feat: migrate screens to dark: colour classes"
```

---

## Task 6: Manual smoke test

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Open browser at http://localhost:5173**

Verify JoinScreen renders in **dark** mode (dark background, light text).

- [ ] **Step 3: Click 🌙 button in Header**

Expected: entire UI switches to light mode (white backgrounds, dark text, xterm gets white background).

- [ ] **Step 4: Click ☀️ button**

Expected: UI switches back to dark mode.

- [ ] **Step 5: Run full test suite**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 6: Commit if any lint/type fixes were needed**

```bash
npm run build
```

Expected: no TypeScript errors.
