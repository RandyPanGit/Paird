import { describe, expect, it, vi } from 'vitest'
import { buildGitHistoryItem } from './gitHistory'

describe('buildGitHistoryItem', () => {
  it('builds a log history item with the first non-empty lines as summary', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-30T08:15:00.000Z'))

    const item = buildGitHistoryItem({
      command: 'log',
      output: '\nabc123 Add workspace tabs\nfed456 Move git log output\n\n',
    })

    expect(item).toEqual({
      id: expect.any(String),
      kind: 'log',
      command: 'git log --oneline -10',
      summary: 'abc123 Add workspace tabs\nfed456 Move git log output',
      content: '\nabc123 Add workspace tabs\nfed456 Move git log output\n\n',
      createdAt: '2026-04-30T08:15:00.000Z',
    })

    vi.useRealTimers()
  })

  it('falls back to No output when the git command returns only blank lines', () => {
    const item = buildGitHistoryItem({
      command: 'log',
      output: '\n\n',
    })

    expect(item.summary).toBe('No output')
    expect(item.command).toBe('git log --oneline -10')
  })
})
