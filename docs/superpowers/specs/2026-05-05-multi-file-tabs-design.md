# Multi-File Tabs Design

**Date:** 2026-05-05

## Overview

Replace the single static "File View" tab with dynamic per-file tabs. Each opened file becomes its own tab, displayed after the fixed tabs. Tabs show the filename and include a close button.

## Behaviour

- Tab order: `Agent Output | Git History | [file1] | [file2] | ...`
- Clicking a file in FileTreePanel opens a new tab for that file, or switches to its existing tab if already open
- Each file tab label shows the filename only (e.g. `WorkspaceTabs.tsx`, not the full path)
- Each file tab has an `×` button on its right side; clicking it closes that tab
- Closing a file tab switches focus to the tab immediately to its left
  - e.g. closing the rightmost file tab → switches to the tab to its left (could be another file tab or `Git History`)
- If the active tab is closed, the tab to its left becomes active

## State Changes (`store.ts`)

| Before | After |
|--------|-------|
| `openFile: { path, content } \| null` | `openFiles: { path: string; content: string }[]` |
| `setOpenFile(file)` | `openFileTab(file)` — add if new, switch if exists |
| — | `closeFileTab(path)` — remove and activate left neighbour |

`activeWorkspaceTab` type widens from `'agent-output' | 'git-history' | 'file-view'` to `'agent-output' | 'git-history' | string`, where file tabs use their `path` as the tab id.

`WorkspaceTab` type in `shared/types.ts` needs updating accordingly.

## Component Changes

### `WorkspaceTabs.tsx`
- Fixed tabs: `Agent Output`, `Git History` (unchanged)
- Dynamic tabs: rendered from `openFiles` array
- Tab label: `file.path.split('/').pop()`
- `×` button inside each file tab; calls `closeFileTab(path)` with `e.stopPropagation()`

### `FileViewPanel.tsx`
- Was: reads `openFile` from store
- Now: receives active file via `openFiles.find(f => f.path === activeWorkspaceTab)` (can be passed as prop or read from store)

### `FileTreePanel.tsx`
- Was: calls `setOpenFile(file)`
- Now: calls `openFileTab(file)`

## Files to Change

1. `src/shared/types.ts` — update `WorkspaceTab` type
2. `src/client/store.ts` — replace `openFile`/`setOpenFile` with `openFiles`/`openFileTab`/`closeFileTab`
3. `src/client/components/WorkspaceTabs.tsx` — render dynamic file tabs
4. `src/client/components/FileViewPanel.tsx` — read active file from `openFiles`
5. `src/client/components/FileTreePanel.tsx` — call `openFileTab` instead of `setOpenFile`

## Out of Scope

- Syntax highlighting
- Unsaved changes indicators
- Reordering tabs by drag
