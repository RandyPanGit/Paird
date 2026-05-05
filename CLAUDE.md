# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (server + client concurrently)
npm run dev

# Server only (tsx watch)
npm run dev:server

# Client only (Vite, port 5173)
npm run dev:client

# Build (Vite → public/, tsc → dist/server/)
npm run build

# Run production server
npm start

# Tests (single run)
npm test

# Tests (watch mode)
npm run test:watch

# Run a single test file
npx vitest run src/server/gitHistory.test.ts
```

## Architecture

Paird is a real-time pair programming tool where two developers share a single Claude Code terminal session. One user is the **Driver** (controls the terminal); others are **Navigators** (can send chat messages and `/` commands).

### Process model

```
Browser (React) ──socket.io── Express server ──node-pty── Claude Code process
```

- `src/server/index.ts` — HTTP + Socket.io entry point; owns PTY lifecycle and all socket event routing
- `src/server/ptyBridge.ts` — wraps `node-pty`; spawns Claude Code in the project directory
- `src/server/sessionManager.ts` — in-memory session state (users, driver, tasks, terminal buffer, git status)
- `src/server/gitStatusWatcher.ts` — reads `simple-git` status; polled every 15 s while agent is running
- `src/server/gitHistory.ts` — builds `GitHistoryItem` records from `git log` output
- `src/server/gitCommandRunner.ts` — runs `diff | log | commit` via `simple-git`
- `src/server/chatCommandRouter.ts` — parses `/` chat commands and returns typed result objects
- `src/shared/types.ts` — **all shared types** between server and client; start here

### Client state

- `src/client/store.ts` — single Zustand store; source of truth for all UI state
- `src/client/socket.ts` — connects to socket.io, maps every server event to store mutations; also owns `terminalOutputListeners` (bypasses Zustand for performance)
- `src/client/App.tsx` — routes between `JoinScreen → ProjectSetupScreen / WaitingScreen → MainScreen`

### Socket event flow

| Direction | Event | Purpose |
|-----------|-------|---------|
| client→server | `user:join` | register name, receive `session:state` |
| client→server | `agent:start` | driver starts Claude Code in a project path |
| client→server | `terminal:input` | driver keystrokes → PTY |
| client→server | `chat:send` | text or `/command` |
| client→server | `git:action` | `diff / log / commit` |
| server→client | `terminal:output` | PTY stdout broadcast |
| server→client | `git:status` | updated `GitStatus` |
| server→client | `git:history:added` | new `GitHistoryItem` |
| server→client | `driver:changed` | driver handoff via `/pass <name>` |

### Chat commands (parsed in `chatCommandRouter.ts`)

| Command | Access | Effect |
|---------|--------|--------|
| `> <text>` | driver only | sends text directly to PTY |
| `/task <desc>` | all | adds a task to the queue |
| `/pass <name>` | driver only | transfers driver role |
| `/git diff` | driver only | runs git diff |
| `/git log` | driver only | runs git log → GitHistoryPanel |
| `/git commit -m "msg"` | driver only | commits |

### Testing

- Server tests: `node` environment (default vitest)
- Client tests: `jsdom` environment (matched by `src/client/**/*.test.tsx?`)
- Test utilities: `src/client/test-utils.tsx` wraps `@testing-library/react` with a pre-wired store; use `createTestStore(overrides)` to set up store state in component tests
- `src/client/setupTests.ts` imports `@testing-library/jest-dom` matchers

### Build outputs

- Client → `public/` (served as static files by Express in production)
- Server → `dist/server/`
- Both tsconfigs extend `tsconfig.base.json`
