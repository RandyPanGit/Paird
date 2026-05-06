# Vim Mode in CodeEditor — Design Spec

**Date:** 2026-05-06
**Scope:** `src/client/components/CodeEditor.tsx`

## Summary

Add vim keybindings to the CodeMirror 6 editor using `@replit/codemirror-vim`. Vim mode is always on (no toggle). The `:w` command is wired to the existing `emitWriteFile` save logic.

## Constraints

- Browser-based vim emulation only — `~/.vimrc` and system vim plugins are NOT applied.
- No UI toggle needed; vim mode is the only editing mode.

## Architecture

### Package

```
npm install @replit/codemirror-vim
```

### Extension setup (`CodeEditor.tsx`)

Add `vim()` as the first extension in the extensions array so it takes precedence over default keymaps.

```ts
import { vim, Vim } from '@replit/codemirror-vim'

const extensions = [
  vim(),
  history(),
  ...
]
```

### Wiring `:w` to save

Call `Vim.defineEx` after the EditorView is created so `:w` triggers `emitWriteFile`:

```ts
Vim.defineEx('write', 'w', () => {
  const content = view.state.doc.toString()
  emitWriteFile(path, content).then((result) => {
    if ('ok' in result) isDirtyRef.current = false
  })
})
```

### Status bar

`@replit/codemirror-vim` automatically injects a vim mode status bar (NORMAL / INSERT / VISUAL) into the editor DOM. No additional UI work required.

## What Does NOT Change

- Save shortcut `Mod-s` remains as-is alongside `:w`.
- Markdown preview panel is unaffected.
- Language detection (`getLanguageExtension`) is unaffected.
- All existing tests remain valid.
