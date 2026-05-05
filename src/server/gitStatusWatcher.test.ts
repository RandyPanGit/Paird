import { describe, expect, it } from 'vitest'
import { hasGitStatusChanged, toGitStatusSnapshot } from './gitStatusWatcher'

describe('gitStatusWatcher', () => {
  it('maps simple-git status data into the shared GitStatus shape', () => {
    const snapshot = toGitStatusSnapshot(
      {
        current: 'develop',
        modified: ['src/server/index.ts'],
        created: ['src/client/components/GitPanel.tsx'],
        deleted: ['old-file.ts'],
      },
      new Date('2026-04-30T10:00:00.000Z'),
    )

    expect(snapshot).toEqual({
      branch: 'develop',
      modified: ['src/server/index.ts'],
      added: ['src/client/components/GitPanel.tsx'],
      deleted: ['old-file.ts'],
      lastUpdated: new Date('2026-04-30T10:00:00.000Z'),
    })
  })

  it('detects when grouped file lists change', () => {
    expect(
      hasGitStatusChanged(
        {
          branch: 'develop',
          modified: ['a.ts'],
          added: [],
          deleted: [],
          lastUpdated: new Date('2026-04-30T10:00:00.000Z'),
        },
        {
          branch: 'develop',
          modified: ['b.ts'],
          added: [],
          deleted: [],
          lastUpdated: new Date('2026-04-30T10:01:00.000Z'),
        },
      ),
    ).toBe(true)
  })
})
