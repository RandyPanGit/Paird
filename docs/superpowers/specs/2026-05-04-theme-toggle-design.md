# Theme Toggle Design

**Date:** 2026-05-04
**Status:** Approved

## Overview

Add a light/dark theme toggle to Paird. The app currently uses a hardcoded dark theme via Tailwind utility classes. This feature lets each user switch between dark and light mode during their session.

## Decisions

| Question | Decision | Rationale |
|----------|----------|-----------|
| Toggle location | Header toolbar (right side) | Always visible, consistent with existing controls |
| Toggle UI | Icon button — 🌙 dark / ☀️ light | Minimal, no extra space needed |
| Persistence | Session state only (React/Zustand) | Simplest; resets to dark on reload |
| Implementation | Tailwind `dark:` class variant | Standard approach, best IDE support |

## Architecture

### State

Add to Zustand store (`src/client/store.ts`):

```ts
theme: 'dark' | 'light'   // default: 'dark'
toggleTheme: () => void
```

`toggleTheme` flips the value and synchronises `document.documentElement.classList` — adding `dark` for dark mode, removing it for light mode.

`App.tsx` calls a one-time sync on mount to align the HTML class with the initial store value.

### Tailwind config

Enable class-based dark mode in `tailwind.config.ts`:

```ts
darkMode: 'class'
```

### Header button

`Header.tsx` gains a `<button>` on the right side, next to the online users count:

- Reads `theme` from store
- Displays 🌙 when dark, ☀️ when light
- Calls `toggleTheme()` on click
- Style: `rounded bg-gray-200 dark:bg-gray-800 px-2 py-0.5 text-xs text-gray-700 dark:text-gray-300`

### Colour migration pattern

All components flip to light-first with `dark:` fallbacks:

| Before | After |
|--------|-------|
| `bg-gray-950` | `bg-white dark:bg-gray-950` |
| `bg-gray-900` | `bg-gray-100 dark:bg-gray-900` |
| `bg-gray-800` | `bg-gray-200 dark:bg-gray-800` |
| `bg-gray-700` | `bg-gray-300 dark:bg-gray-700` |
| `text-gray-100` | `text-gray-900 dark:text-gray-100` |
| `text-gray-300` | `text-gray-700 dark:text-gray-300` |
| `text-gray-500` | `text-gray-500 dark:text-gray-500` |
| `border-gray-800` | `border-gray-200 dark:border-gray-800` |
| `border-gray-700` | `border-gray-300 dark:border-gray-700` |

### xterm.js theme

`TerminalPanel.tsx` reads `theme` from the store and passes a different colour object to xterm's `theme` option:

- **Dark:** current hardcoded values (`background: '#1e1e1e'`, etc.)
- **Light:** white background, dark foreground (`background: '#ffffff'`, `foreground: '#1e1e1e'`, etc.)

The terminal instance must be recreated or `terminal.options.theme` updated when `theme` changes.

## Files to modify

| File | Change |
|------|--------|
| `tailwind.config.ts` | Add `darkMode: 'class'` |
| `src/client/store.ts` | Add `theme` state and `toggleTheme` action |
| `src/client/App.tsx` | Sync `dark` class on mount |
| `src/client/components/Header.tsx` | Add toggle button |
| `src/client/components/TerminalPanel.tsx` | Dynamic xterm theme |
| `src/client/components/ChatPanel.tsx` | Migrate colours |
| `src/client/components/GitPanel.tsx` | Migrate colours |
| `src/client/components/TaskPanel.tsx` | Migrate colours |
| `src/client/components/WorkspaceTabs.tsx` | Migrate colours |
| `src/client/components/AgentControlBar.tsx` | Migrate colours |
| `src/client/components/GitHistoryCard.tsx` | Migrate colours |
| `src/client/components/GitHistoryPanel.tsx` | Migrate colours |
| `src/client/components/ResizeHandle.tsx` | Migrate colours |
| `src/client/screens/JoinScreen.tsx` | Migrate colours |
| `src/client/screens/ProjectSetupScreen.tsx` | Migrate colours |
| `src/client/screens/WaitingScreen.tsx` | Migrate colours |
| `src/client/screens/MainScreen.tsx` | Migrate colours (layout wrappers) |

## Out of scope

- Persisting theme preference across page reloads (localStorage)
- Syncing theme across users in the same session
- System preference detection (`prefers-color-scheme`)
