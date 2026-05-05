# File Browser Design

## Overview

Add a file browser to Paird that lets users navigate the current project directory and view file contents. The tree lives in the left panel; clicking a file opens a read-only view in the center WorkspaceTabs panel.

## User Flow

1. User opens Paird with a project loaded.
2. **FileTreePanel** appears at the bottom of the left panel, below TaskPanel and GitPanel.
3. The root directory is expanded by default; subdirectories are lazy-loaded on expand.
4. Clicking a file sends `fs:read-file` to the server, which returns the file's content.
5. The store sets `openFile` and switches `activeWorkspaceTab` to `'file-view'`.
6. **FileViewPanel** renders inside WorkspaceTabs, showing the file path and content read-only.

## Architecture

### Shared Types (`src/shared/types.ts`)

```ts
export interface FsNode {
  name: string
  path: string      // absolute path on server
  type: 'file' | 'dir'
}

export type WorkspaceTab = 'agent-output' | 'git-history' | 'file-view'
```

### Server (`src/server/index.ts`)

Two new socket handlers, both restricted to paths inside `sessionManager.projectPath`:

| Event | Payload | Response |
|-------|---------|----------|
| `fs:read-dir` | `{ path: string }` | `FsNode[]` (immediate entries, not recursive) |
| `fs:read-file` | `{ path: string }` | `{ content: string }` |

Path validation: resolve both `projectPath` and the requested path with `path.resolve`, then check `resolved.startsWith(projectPath)`. Reject with an error event if outside.

Binary files: if `fs.readFile` throws or content contains null bytes, respond with `{ content: '[binary file]' }`.

### Client Store (`src/client/store.ts`)

New state:

```ts
openFile: { path: string; content: string } | null
setOpenFile: (file: { path: string; content: string } | null) => void
```

`setOpenFile` also sets `activeWorkspaceTab` to `'file-view'` when file is non-null.

### Components

**`FileTreePanel.tsx`** (new, left panel)
- On mount, emits `fs:read-dir` with `projectPath` from store.
- Renders a tree of `FsNode[]`. Dirs show a toggle arrow; files show a file icon.
- Clicking a dir emits `fs:read-dir` for that path and appends children into local component state.
- Clicking a file emits `fs:read-file` and calls `store.setOpenFile` on response.
- Collapses dir entries when toggled closed (removes children from local state).

**`FileViewPanel.tsx`** (new, center panel)
- Reads `openFile` from store.
- Shows file path as a header and content in a `<pre>` block with monospace font and overflow scroll.
- If `openFile` is null, shows a placeholder: "Select a file to view its contents."

**`WorkspaceTabs.tsx`** (modified)
- Add `{ id: 'file-view', label: 'File View' }` as a permanent tab in TABS (always visible).
- Render `<FileViewPanel />` when `activeWorkspaceTab === 'file-view'`.

**`MainScreen.tsx`** (modified)
- Add `<FileTreePanel />` inside the left `<aside>`, after `<GitPanel />`.

### Socket (`src/client/socket.ts`)

No persistent listeners needed. `fs:read-dir` and `fs:read-file` are request/response pairs emitted from components directly via `socket.emit(..., callback)` (acknowledgement pattern).

## Security

- Server validates all paths are within `projectPath` before reading.
- Client never constructs paths from user input — only from server-returned `FsNode.path` values.

## Out of Scope

- File editing
- File creation or deletion
- Syntax highlighting
- Search within files
- Watching for file changes (live refresh)
