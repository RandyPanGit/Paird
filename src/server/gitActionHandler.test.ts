import { describe, expect, it, vi } from 'vitest'
import type { GitCommandResult, GitActionCommand } from './gitCommandRunner'
import type { GitHistoryItem } from '../shared/types'
import { emitGitActionResult } from './index'

describe('emitGitActionResult', () => {
  it('emits git history items for successful log commands', () => {
    const terminalEmit = vi.fn()
    const historyEmit = vi.fn()
    const errorEmit = vi.fn()

    const result: GitCommandResult = {
      ok: true,
      output: 'abc123 Add workspace tabs',
    }

    const historyItem: GitHistoryItem = {
      id: 'history-1',
      kind: 'log',
      command: 'git log --oneline -10',
      summary: 'abc123 Add workspace tabs',
      content: 'abc123 Add workspace tabs',
      createdAt: '2026-04-30T00:00:00.000Z',
    }

    emitGitActionResult({
      command: 'log',
      result,
      historyItem,
      emitTerminalOutput: terminalEmit,
      emitGitHistory: historyEmit,
      emitError: errorEmit,
    })

    expect(historyEmit).toHaveBeenCalledWith(historyItem)
    expect(terminalEmit).not.toHaveBeenCalled()
    expect(errorEmit).not.toHaveBeenCalled()
  })

  it('keeps terminal output for successful diff commands', () => {
    const terminalEmit = vi.fn()
    const historyEmit = vi.fn()
    const errorEmit = vi.fn()

    emitGitActionResult({
      command: 'diff',
      result: { ok: true, output: '1 file changed' },
      historyItem: null,
      emitTerminalOutput: terminalEmit,
      emitGitHistory: historyEmit,
      emitError: errorEmit,
    })

    expect(terminalEmit).toHaveBeenCalledWith('1 file changed\n')
    expect(historyEmit).not.toHaveBeenCalled()
    expect(errorEmit).not.toHaveBeenCalled()
  })

  it('emits an error and no history item when log fails', () => {
    const terminalEmit = vi.fn()
    const historyEmit = vi.fn()
    const errorEmit = vi.fn()

    emitGitActionResult({
      command: 'log',
      result: { ok: false, output: 'fatal: not a git repository' },
      historyItem: null,
      emitTerminalOutput: terminalEmit,
      emitGitHistory: historyEmit,
      emitError: errorEmit,
    })

    expect(errorEmit).toHaveBeenCalledWith('GIT_COMMAND_FAILED', 'Git log failed.')
    expect(terminalEmit).not.toHaveBeenCalled()
    expect(historyEmit).not.toHaveBeenCalled()
  })
})
