# File Browser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在左側 Panel 加入 FileTreePanel（目錄樹），點選檔案後在中間 WorkspaceTabs 以 FileViewPanel 唯讀顯示檔案內容。

**Architecture:** Server 新增兩個 socket acknowledgement handler（`fs:read-dir`、`fs:read-file`），並限制路徑在 projectPath 內。Client 用 Zustand store 管理 `openFile` 狀態，FileTreePanel lazy load 子目錄，FileViewPanel 顯示選中的檔案內容。

**Tech Stack:** Node.js `fs/promises`、Socket.io acknowledgement pattern、React、Zustand、Tailwind CSS

---

## File Map

| 檔案 | 動作 | 負責的事 |
|------|------|---------|
| `src/shared/types.ts` | 修改 | 新增 `FsNode` 型別；`WorkspaceTab` 加 `'file-view'` |
| `src/server/index.ts` | 修改 | 新增 `fs:read-dir`、`fs:read-file` socket handler |
| `src/client/store.ts` | 修改 | 新增 `openFile` 狀態與 `setOpenFile` |
| `src/client/components/FileViewPanel.tsx` | 新增 | 唯讀顯示選中的檔案內容 |
| `src/client/components/FileTreePanel.tsx` | 新增 | 可摺疊的目錄樹，lazy load 子目錄 |
| `src/client/components/WorkspaceTabs.tsx` | 修改 | 加入 `'file-view'` tab，渲染 FileViewPanel |
| `src/client/screens/MainScreen.tsx` | 修改 | 左側 aside 加入 FileTreePanel |

---

### Task 1: 新增共用型別

**Files:**
- Modify: `src/shared/types.ts`

- [ ] **Step 1: 在 `types.ts` 加入 `FsNode` 並擴充 `WorkspaceTab`**

開啟 `src/shared/types.ts`，將：
```ts
export type WorkspaceTab = 'agent-output' | 'git-history';
```
改為：
```ts
export interface FsNode {
  name: string
  path: string
  type: 'file' | 'dir'
}

export type WorkspaceTab = 'agent-output' | 'git-history' | 'file-view';
```

- [ ] **Step 2: 確認 TypeScript 無錯誤**

```bash
npx tsc --noEmit
```
預期：無錯誤輸出。

- [ ] **Step 3: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat(types): add FsNode and file-view WorkspaceTab"
```

---

### Task 2: Server — fs socket handlers

**Files:**
- Modify: `src/server/index.ts`

- [ ] **Step 1: 在 `src/server/index.ts` 頂部加入 fs import**

找到檔案頂部的 import 區塊，加入：
```ts
import fs from 'node:fs/promises'
```

- [ ] **Step 2: 在 `io.on('connection', ...)` 區塊內加入兩個 handler**

找到 `src/server/index.ts` 中 `io.on('connection', (socket) => {` 的區塊，在最後一個 `socket.on(...)` 之後、closing `})` 之前加入：

```ts
socket.on('fs:read-dir', async ({ path: reqPath }: { path: string }, callback: (nodes: FsNode[] | { error: string }) => void) => {
  const projectPath = sessionManager.getFullState().projectPath
  if (!projectPath) { callback({ error: 'no project loaded' }); return }

  const resolved = path.resolve(reqPath)
  if (!resolved.startsWith(path.resolve(projectPath))) {
    callback({ error: 'path outside project' }); return
  }

  try {
    const entries = await fs.readdir(resolved, { withFileTypes: true })
    const nodes: FsNode[] = entries
      .filter(e => !e.name.startsWith('.') && e.name !== 'node_modules')
      .map(e => ({
        name: e.name,
        path: path.join(resolved, e.name),
        type: e.isDirectory() ? 'dir' : 'file',
      }))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
        return a.name.localeCompare(b.name)
      })
    callback(nodes)
  } catch {
    callback({ error: 'read failed' })
  }
})

socket.on('fs:read-file', async ({ path: reqPath }: { path: string }, callback: (result: { content: string } | { error: string }) => void) => {
  const projectPath = sessionManager.getFullState().projectPath
  if (!projectPath) { callback({ error: 'no project loaded' }); return }

  const resolved = path.resolve(reqPath)
  if (!resolved.startsWith(path.resolve(projectPath))) {
    callback({ error: 'path outside project' }); return
  }

  try {
    const buf = await fs.readFile(resolved)
    if (buf.includes(0)) { callback({ content: '[binary file]' }); return }
    callback({ content: buf.toString('utf8') })
  } catch {
    callback({ error: 'read failed' })
  }
})
```

注意：`path` 在此檔案已有 import（`import path from 'path'`）。`FsNode` 需要從 shared/types 引入——在頂部 import 中加入：
```ts
import type { AppErrorPayload, ChatMessage, GitHistoryItem, FsNode } from '../shared/types'
```
（替換原有的 `import type { AppErrorPayload, ChatMessage, GitHistoryItem } from '../shared/types'`）

- [ ] **Step 3: 確認 TypeScript 無錯誤**

```bash
npx tsc --noEmit
```
預期：無錯誤輸出。

- [ ] **Step 4: Commit**

```bash
git add src/server/index.ts
git commit -m "feat(server): add fs:read-dir and fs:read-file socket handlers"
```

---

### Task 3: Client store — openFile 狀態

**Files:**
- Modify: `src/client/store.ts`

- [ ] **Step 1: 在 store 的 `AppStore` interface 加入 `openFile` 欄位**

找到 `interface AppStore {`，加入：
```ts
openFile: { path: string; content: string } | null
setOpenFile: (file: { path: string; content: string } | null) => void
```

- [ ] **Step 2: 在 `initialState` 加入初始值**

在 `const initialState = {` 區塊加入：
```ts
openFile: null as { path: string; content: string } | null,
```

- [ ] **Step 3: 在 `create(...)` 實作 `setOpenFile`**

在 `clearGitHistory` 之後加入：
```ts
setOpenFile: (file) => set({
  openFile: file,
  ...(file !== null ? { activeWorkspaceTab: 'file-view' as WorkspaceTab } : {}),
}),
```

- [ ] **Step 4: 確認 TypeScript 無錯誤**

```bash
npx tsc --noEmit
```
預期：無錯誤輸出。

- [ ] **Step 5: Commit**

```bash
git add src/client/store.ts
git commit -m "feat(store): add openFile state and setOpenFile action"
```

---

### Task 4: FileViewPanel 元件

**Files:**
- Create: `src/client/components/FileViewPanel.tsx`

- [ ] **Step 1: 建立 `FileViewPanel.tsx`**

```tsx
import { useStore } from '../store'

export default function FileViewPanel() {
  const openFile = useStore((state) => state.openFile)
  const theme = useStore((state) => state.theme)

  const bgClass = theme === 'dark' ? 'bg-[#0d1117]' : 'bg-gray-50'

  if (!openFile) {
    return (
      <div className={`flex flex-1 items-center justify-center rounded-b-lg ${bgClass} p-6 text-sm text-gray-500`}>
        Select a file to view its contents.
      </div>
    )
  }

  return (
    <div className={`flex flex-1 flex-col min-h-0 rounded-b-lg ${bgClass}`}>
      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-800 text-xs text-gray-500 font-mono truncate">
        {openFile.path}
      </div>
      <pre className="flex-1 overflow-auto p-4 text-xs font-mono text-gray-800 dark:text-gray-200 whitespace-pre">
        {openFile.content}
      </pre>
    </div>
  )
}
```

- [ ] **Step 2: 確認 TypeScript 無錯誤**

```bash
npx tsc --noEmit
```
預期：無錯誤輸出。

- [ ] **Step 3: Commit**

```bash
git add src/client/components/FileViewPanel.tsx
git commit -m "feat(ui): add FileViewPanel component"
```

---

### Task 5: WorkspaceTabs — 加入 file-view tab

**Files:**
- Modify: `src/client/components/WorkspaceTabs.tsx`

- [ ] **Step 1: 更新 TABS 常數並引入 FileViewPanel**

在 `WorkspaceTabs.tsx` 頂部加入：
```ts
import FileViewPanel from './FileViewPanel'
```

將 `const TABS = [...]` 改為：
```ts
const TABS = [
  { id: 'agent-output', label: 'Agent Output' },
  { id: 'git-history', label: 'Git History' },
  { id: 'file-view', label: 'File View' },
] as const
```

- [ ] **Step 2: 渲染 FileViewPanel**

在現有的兩個 `<div className={...}>` 之後加入：
```tsx
<div className={activeWorkspaceTab === 'file-view' ? 'flex flex-col flex-1 min-h-0' : 'hidden'}><FileViewPanel /></div>
```

- [ ] **Step 3: 確認 TypeScript 無錯誤**

```bash
npx tsc --noEmit
```
預期：無錯誤輸出。

- [ ] **Step 4: Commit**

```bash
git add src/client/components/WorkspaceTabs.tsx
git commit -m "feat(ui): add file-view tab to WorkspaceTabs"
```

---

### Task 6: FileTreePanel 元件

**Files:**
- Create: `src/client/components/FileTreePanel.tsx`

- [ ] **Step 1: 建立 `FileTreePanel.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { socket } from '../socket'
import { useStore } from '../store'
import type { FsNode } from '../../shared/types'

interface TreeNode extends FsNode {
  children?: TreeNode[]
  expanded?: boolean
}

function buildTree(nodes: FsNode[]): TreeNode[] {
  return nodes.map(n => ({ ...n }))
}

export default function FileTreePanel() {
  const projectPath = useStore((state) => state.projectPath)
  const setOpenFile = useStore((state) => state.setOpenFile)
  const [roots, setRoots] = useState<TreeNode[]>([])

  useEffect(() => {
    if (!projectPath) return
    socket.emit('fs:read-dir', { path: projectPath }, (result: FsNode[] | { error: string }) => {
      if (!Array.isArray(result)) return
      setRoots(buildTree(result))
    })
  }, [projectPath])

  function toggleDir(node: TreeNode, siblings: TreeNode[], setSiblings: (nodes: TreeNode[]) => void): void {
    if (node.expanded) {
      setSiblings(siblings.map(n => n.path === node.path ? { ...n, expanded: false, children: undefined } : n))
      return
    }
    socket.emit('fs:read-dir', { path: node.path }, (result: FsNode[] | { error: string }) => {
      if (!Array.isArray(result)) return
      setSiblings(siblings.map(n =>
        n.path === node.path ? { ...n, expanded: true, children: buildTree(result) } : n
      ))
    })
  }

  function handleFileClick(node: TreeNode): void {
    socket.emit('fs:read-file', { path: node.path }, (result: { content: string } | { error: string }) => {
      if ('error' in result) return
      setOpenFile({ path: node.path, content: result.content })
    })
  }

  function renderNodes(nodes: TreeNode[], depth: number, setSiblings: (nodes: TreeNode[]) => void): React.ReactNode {
    return nodes.map(node => (
      <div key={node.path}>
        <button
          type="button"
          className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-xs hover:bg-gray-200 dark:hover:bg-gray-800 truncate"
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
          onClick={() => {
            if (node.type === 'dir') toggleDir(node, nodes, setSiblings)
            else handleFileClick(node)
          }}
        >
          <span className="shrink-0 text-gray-400">
            {node.type === 'dir' ? (node.expanded ? '▾' : '▸') : '·'}
          </span>
          <span className="truncate text-gray-700 dark:text-gray-300">{node.name}</span>
        </button>
        {node.type === 'dir' && node.expanded && node.children && (
          renderNodes(node.children, depth + 1, (updated) => {
            setSiblings(nodes.map(n => n.path === node.path ? { ...n, children: updated } : n))
          })
        )}
      </div>
    ))
  }

  if (!projectPath) return null

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Files</p>
      <div className="overflow-y-auto max-h-64">
        {renderNodes(roots, 0, setRoots)}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 確認 TypeScript 無錯誤**

```bash
npx tsc --noEmit
```
預期：無錯誤輸出。

- [ ] **Step 3: Commit**

```bash
git add src/client/components/FileTreePanel.tsx
git commit -m "feat(ui): add FileTreePanel with lazy-load directory tree"
```

---

### Task 7: MainScreen — 加入 FileTreePanel

**Files:**
- Modify: `src/client/screens/MainScreen.tsx`

- [ ] **Step 1: 引入並加入 FileTreePanel**

在 `MainScreen.tsx` 頂部加入：
```ts
import FileTreePanel from '../components/FileTreePanel'
```

找到左側 `<aside>` 中 `<GitPanel />` 之後加入：
```tsx
<FileTreePanel />
```

- [ ] **Step 2: 確認 TypeScript 無錯誤**

```bash
npx tsc --noEmit
```
預期：無錯誤輸出。

- [ ] **Step 3: 手動驗證功能**

```bash
npm run dev
```

1. 開啟 http://localhost:5173，加入 session
2. 啟動 agent 並設定一個專案路徑
3. 左側 Panel 最下方應出現 "Files" 標題與目錄樹
4. 展開一個資料夾，確認子目錄 lazy load
5. 點選一個檔案，中間 WorkspaceTabs 應切換到 "File View" 並顯示檔案內容
6. 路徑顯示在內容上方

- [ ] **Step 4: Commit**

```bash
git add src/client/screens/MainScreen.tsx
git commit -m "feat(ui): add FileTreePanel to left panel in MainScreen"
```
