# Multi-File Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single static "File View" tab with dynamic per-file tabs that open on file click, display the filename, and can be closed individually.

**Architecture:** `WorkspaceTab` type is widened to `string`; file tabs use their `path` as the tab id. The store gains `openFiles` array and `openFileTab`/`closeFileTab` actions. `WorkspaceTabs` renders fixed tabs + dynamic file tabs. `FileViewPanel` looks up the active file from `openFiles`.

**Tech Stack:** React, Zustand, TypeScript, Vitest + Testing Library

---

## File Map

| File | Change |
|------|--------|
| `src/shared/types.ts` | Widen `WorkspaceTab` type |
| `src/client/store.ts` | Replace `openFile`/`setOpenFile` with `openFiles`/`openFileTab`/`closeFileTab` |
| `src/client/components/WorkspaceTabs.tsx` | Render dynamic file tabs with close buttons |
| `src/client/components/FileViewPanel.tsx` | Read active file from `openFiles` instead of `openFile` |
| `src/client/components/FileTreePanel.tsx` | Call `openFileTab` instead of `setOpenFile` |
| `src/client/screens/MainScreen.test.tsx` | Update assertions for removed "File View" static tab |

---

### Task 1: Widen `WorkspaceTab` type in shared types

**Files:**
- Modify: `src/shared/types.ts`

- [ ] **Step 1: Update the type**

Replace the current `WorkspaceTab` type:

```ts
// Before
export type WorkspaceTab = 'agent-output' | 'git-history' | 'file-view';

// After
export type WorkspaceTab = 'agent-output' | 'git-history' | string;
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors (or only pre-existing errors unrelated to this change).

- [ ] **Step 3: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: widen WorkspaceTab type to support dynamic file tabs"
```

---

### Task 2: Update store — replace `openFile` with `openFiles`

**Files:**
- Modify: `src/client/store.ts`

- [ ] **Step 1: Update the `AppStore` interface**

In `src/client/store.ts`, replace:

```ts
openFile: { path: string; content: string } | null
setOpenFile: (file: { path: string; content: string } | null) => void
```

With:

```ts
openFiles: { path: string; content: string }[]
openFileTab: (file: { path: string; content: string }) => void
closeFileTab: (path: string) => void
```

- [ ] **Step 2: Update `initialState`**

Replace:

```ts
openFile: null as { path: string; content: string } | null,
```

With:

```ts
openFiles: [] as { path: string; content: string }[],
```

- [ ] **Step 3: Update the store implementation**

Remove `setOpenFile` and add `openFileTab` and `closeFileTab`:

```ts
openFileTab: (file) => set((state) => {
  const exists = state.openFiles.some(f => f.path === file.path)
  if (exists) {
    return { activeWorkspaceTab: file.path }
  }
  return {
    openFiles: [...state.openFiles, file],
    activeWorkspaceTab: file.path,
  }
}),

closeFileTab: (path) => set((state) => {
  const index = state.openFiles.findIndex(f => f.path === path)
  if (index === -1) return {}
  const newOpenFiles = state.openFiles.filter(f => f.path !== path)
  let newActiveTab = state.activeWorkspaceTab
  if (state.activeWorkspaceTab === path) {
    // fixed tabs in order: agent-output, git-history, then file paths
    const allTabs = ['agent-output', 'git-history', ...state.openFiles.map(f => f.path)]
    const currentIndex = allTabs.indexOf(path)
    newActiveTab = allTabs[currentIndex - 1] ?? 'agent-output'
  }
  return { openFiles: newOpenFiles, activeWorkspaceTab: newActiveTab }
}),
```

Also update the store's `initialState` spread — remove `openFile`, add `openFiles`:

```ts
const initialState = {
  // ... existing fields ...
  openFiles: [] as { path: string; content: string }[],
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: errors only for components that still reference `openFile`/`setOpenFile` — those are fixed in later tasks.

- [ ] **Step 5: Commit**

```bash
git add src/client/store.ts
git commit -m "feat: replace openFile with openFiles array and openFileTab/closeFileTab actions"
```

---

### Task 3: Update `FileTreePanel` to call `openFileTab`

**Files:**
- Modify: `src/client/components/FileTreePanel.tsx`

- [ ] **Step 1: Update the store selector**

In `FileTreePanel.tsx`, replace:

```ts
const setOpenFile = useStore((state) => state.setOpenFile)
```

With:

```ts
const openFileTab = useStore((state) => state.openFileTab)
```

- [ ] **Step 2: Update `handleFileClick`**

Replace:

```ts
function handleFileClick(node: TreeNode): void {
  getSocket().emit('fs:read-file', { path: node.path }, (result: { content: string } | { error: string }) => {
    if ('error' in result) return
    setOpenFile({ path: node.path, content: result.content })
  })
}
```

With:

```ts
function handleFileClick(node: TreeNode): void {
  getSocket().emit('fs:read-file', { path: node.path }, (result: { content: string } | { error: string }) => {
    if ('error' in result) return
    openFileTab({ path: node.path, content: result.content })
  })
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors related to `FileTreePanel`.

- [ ] **Step 4: Commit**

```bash
git add src/client/components/FileTreePanel.tsx
git commit -m "feat: call openFileTab instead of setOpenFile in FileTreePanel"
```

---

### Task 4: Update `FileViewPanel` to read from `openFiles`

**Files:**
- Modify: `src/client/components/FileViewPanel.tsx`

- [ ] **Step 1: Update the component**

Replace the entire file content with:

```tsx
import { useStore } from '../store'

export default function FileViewPanel() {
  const openFiles = useStore((state) => state.openFiles)
  const activeWorkspaceTab = useStore((state) => state.activeWorkspaceTab)
  const theme = useStore((state) => state.theme)

  const openFile = openFiles.find(f => f.path === activeWorkspaceTab) ?? null

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

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors related to `FileViewPanel`.

- [ ] **Step 3: Commit**

```bash
git add src/client/components/FileViewPanel.tsx
git commit -m "feat: update FileViewPanel to read active file from openFiles"
```

---

### Task 5: Update `WorkspaceTabs` with dynamic file tabs and close buttons

**Files:**
- Modify: `src/client/components/WorkspaceTabs.tsx`

- [ ] **Step 1: Rewrite the component**

Replace the entire file with:

```tsx
import TerminalPanel from './TerminalPanel'
import GitHistoryPanel from './GitHistoryPanel'
import FileViewPanel from './FileViewPanel'
import { useStore } from '../store'

const FIXED_TABS = [
  { id: 'agent-output', label: 'Agent Output' },
  { id: 'git-history', label: 'Git History' },
] as const

export default function WorkspaceTabs() {
  const activeWorkspaceTab = useStore((state) => state.activeWorkspaceTab)
  const setActiveWorkspaceTab = useStore((state) => state.setActiveWorkspaceTab)
  const openFiles = useStore((state) => state.openFiles)
  const closeFileTab = useStore((state) => state.closeFileTab)

  const isFileTab = !FIXED_TABS.some(t => t.id === activeWorkspaceTab)

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-900">
      <div className="flex border-b border-gray-200 dark:border-gray-800">
        {FIXED_TABS.map((tab) => {
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

        {openFiles.map((file) => {
          const active = file.path === activeWorkspaceTab
          const filename = file.path.split('/').pop() ?? file.path
          return (
            <div
              key={file.path}
              className={`flex items-center ${active
                ? 'border-b border-blue-500 bg-white dark:bg-gray-950 text-gray-900 dark:text-white'
                : 'text-gray-500'}`}
            >
              <button
                type="button"
                onClick={() => setActiveWorkspaceTab(file.path)}
                className="px-3 py-2 text-sm"
              >
                {filename}
              </button>
              <button
                type="button"
                aria-label={`Close ${filename}`}
                onClick={(e) => {
                  e.stopPropagation()
                  closeFileTab(file.path)
                }}
                className="pr-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xs leading-none"
              >
                ×
              </button>
            </div>
          )
        })}
      </div>

      <div className={activeWorkspaceTab === 'agent-output' ? 'flex flex-col flex-1 min-h-0' : 'hidden'}><TerminalPanel /></div>
      <div className={activeWorkspaceTab === 'git-history' ? 'flex flex-col flex-1 min-h-0' : 'hidden'}><GitHistoryPanel /></div>
      <div className={isFileTab ? 'flex flex-col flex-1 min-h-0' : 'hidden'}><FileViewPanel /></div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/client/components/WorkspaceTabs.tsx
git commit -m "feat: render dynamic file tabs with close buttons in WorkspaceTabs"
```

---

### Task 6: Fix tests

**Files:**
- Modify: `src/client/screens/MainScreen.test.tsx`

- [ ] **Step 1: Run existing tests to see current failures**

```bash
npx vitest run src/client/screens/MainScreen.test.tsx
```

Expected: failure on any assertion referencing "File View" tab.

- [ ] **Step 2: Update the test**

In `src/client/screens/MainScreen.test.tsx`, find the assertion:

```ts
expect(screen.getByRole('button', { name: 'Agent Output' })).toBeInTheDocument()
expect(screen.getByRole('button', { name: 'Git History' })).toBeInTheDocument()
```

Verify there is no assertion checking for a static "File View" button. If one exists, remove it. The static "File View" tab no longer exists — file tabs are dynamic and only appear when files are opened.

- [ ] **Step 3: Run all client tests**

```bash
npx vitest run src/client
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/client/screens/MainScreen.test.tsx
git commit -m "test: remove static file-view tab assertion from MainScreen tests"
```

---

### Task 7: Manual smoke test

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Open `http://localhost:5173` in a browser.

- [ ] **Step 2: Verify initial state**

Only two tabs visible: `Agent Output` and `Git History`. No "File View" tab.

- [ ] **Step 3: Open a file**

Click any file in the left file tree. Verify:
- A new tab appears with the filename (not full path)
- The new tab is active and shows the file content
- A `×` button is visible on the tab

- [ ] **Step 4: Open a second file**

Click a different file. Verify:
- A second file tab appears to the right
- The second file tab is now active

- [ ] **Step 5: Close the second file tab**

Click `×` on the second file tab. Verify:
- The second tab disappears
- Focus switches to the first file tab

- [ ] **Step 6: Close the last file tab while viewing it**

Click `×` on the remaining file tab. Verify:
- The file tab disappears
- Focus switches to `Git History`

- [ ] **Step 7: Re-open same file**

Click the same file again in the tree. Verify only one tab is created (no duplicates).

- [ ] **Step 8: Final commit (if any cleanup needed)**

```bash
git add -p
git commit -m "chore: post-smoke-test cleanup"
```
