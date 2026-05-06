# Agent Todo Task Panel — Design Spec

**Date:** 2026-05-04
**Status:** Approved

## Goal

Replace the manual `/task` system with automatic parsing of Claude Code's `TodoWrite` terminal output. The TaskPanel will reflect the Agent's own todo list in real time, with no manual input required.

## Background

Claude Code outputs todo items as plain-text lines prefixed with `☐`, `✓`, or `✗` symbols. Each `TodoWrite` call emits a complete replacement of the list — not a diff. There are no wrapper markers around the block; the lines appear directly in the PTY stream.

## Architecture

```
PTY output chunk
  → todoParser.feed(chunk)     // server-side, new module
  → debounce 200ms
  → io.emit('task:synced', todos)
  → client Zustand store (replaces tasks array)
```

### New module: `src/server/todoParser.ts`

Scans PTY output chunks line by line. Lines matching `/^[\s]*[☐✓✗]\s+(.+)/` are accumulated into a pending batch. After 200ms of silence (debounce), the batch is emitted as a complete replacement list.

Symbols map to status:
- `☐` → `pending`
- `✓` → `done`
- `✗` → `failed`

### New socket event: `task:synced`

Direction: server → all clients

Payload:
```ts
{ todos: Array<{ text: string; status: 'pending' | 'done' | 'failed' }> }
```

Replaces the existing `task:updated` event entirely.

### Agent lifecycle

- When the Agent starts, the todo list is cleared.
- When the Agent stops (idle/stopped), the last list is preserved for review.

## Changes Required

### Server

- Add `src/server/todoParser.ts` — debounced parser, emits `task:synced`
- Wire `todoParser.feed(data)` into the PTY `onOutput` handler in `src/server/index.ts`
- Clear todo list on agent start
- Remove: `task:update` socket event handler
- Remove: `sessionManager` Task CRUD methods (`addTask`, `updateTaskStatus`, `getTasks`, `getRunningTasks`)
- Remove: `TASK_DONE_PATTERNS` auto-complete logic in `index.ts`

### Shared types (`src/shared/types.ts`)

- Remove: `Task`, `TaskStatus` types
- Add: `AgentTodo` type
  ```ts
  export interface AgentTodo {
    text: string;
    status: 'pending' | 'done' | 'failed';
  }
  ```
- Update `SessionState.tasks` → `SessionState.todos: AgentTodo[]`

### Client

- `src/client/socket.ts`: listen to `task:synced`, replace store todos
- `src/client/store.ts`: change `tasks: Task[]` → `todos: AgentTodo[]`
- `src/client/components/TaskPanel.tsx`: render `todos`, remove status-update buttons
- Remove: `emitTaskUpdate` from `src/client/socket.ts`

### Chat command router (`src/server/chatCommandRouter.ts`)

- Remove: `/task` command parsing and handling

### Tests

- Add unit tests for `todoParser.ts` (various chunk splits, mixed lines, debounce behaviour)
- Update `TaskPanel` tests to use `todos` instead of `tasks`
- Update `sessionManager` tests to remove task-related cases

## TaskPanel UI

- Each todo rendered as a single row: symbol + text
- `✓` items: green symbol, strikethrough text
- `✗` items: red symbol, muted text
- `☐` items: grey symbol, normal text
- No action buttons (read-only, driven by Agent)
- Footer label: "由 Agent 自動更新"
- Empty state: "Agent 尚未建立任何 todo"

## What Is Removed

| Item | Location |
|------|----------|
| `/task <desc>` chat command | `chatCommandRouter.ts` |
| `task:update` socket event | `index.ts` |
| `task:updated` socket event | `index.ts` |
| `emitTaskUpdate()` | `socket.ts` |
| Task CRUD in sessionManager | `sessionManager.ts` |
| Mark running / done / failed buttons | `TaskPanel.tsx` |
| `TASK_DONE_PATTERNS` auto-complete | `index.ts` |
