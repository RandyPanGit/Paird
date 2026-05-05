# Remove Slash Commands from Chat Panel

**Date:** 2026-05-03  
**Status:** Approved

## Context

Chat panel previously supported `/task`, `/pass`, and `/git` slash commands. These are now superseded by dedicated UI panels (GitPanel, TaskPanel) and keyboard-controlled agent output panel. The slash command layer adds complexity without adding value.

## Decision

Remove the slash command system entirely (Method A).

## Changes

### Deleted

- `src/server/chatCommandRouter.ts` — entire file removed
- `src/server/chatCommandRouter.test.ts` — entire file removed

### Modified: `src/server/index.ts`

`chat:send` handler simplified to two branches:

- **Driver** → broadcast `type: 'command'` message + write content to PTY
- **Navigator** → broadcast `type: 'user'` message (team chat only)

No more `parseChatCommand` call. No more error dispatch for unknown commands.

### Modified: `src/client/components/ChatPanel.tsx`

- Driver placeholder: `'Send command to agent...'`
- Navigator placeholder: `"Message teammates"`
- Remove `errorMessage` display block

### Modified: `src/client/store.ts`

- Remove `errorMessage` field if it is only used for slash command errors

### Modified: `src/client/components/ChatPanel.test.tsx`

- Remove `errorMessage` related test cases
- Update placeholder assertion to match new driver placeholder text

## Out of Scope

- Driver handoff (`/pass`) is removed with no replacement for now
- No new UI entry point for task creation beyond TaskPanel
