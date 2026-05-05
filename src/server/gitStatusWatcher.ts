import simpleGit, { type StatusResult } from 'simple-git'
import type { GitStatus } from '../shared/types'

export function toGitStatusSnapshot(status: Pick<StatusResult, 'current' | 'modified' | 'created' | 'deleted'>, now = new Date()): GitStatus {
  return {
    branch: status.current ?? '(detached)',
    modified: [...status.modified],
    added: [...status.created],
    deleted: [...status.deleted],
    lastUpdated: now,
  }
}

export function hasGitStatusChanged(previous: GitStatus | null, next: GitStatus | null): boolean {
  if (!previous || !next) return previous !== next

  return (
    previous.branch !== next.branch ||
    previous.modified.join('\n') !== next.modified.join('\n') ||
    previous.added.join('\n') !== next.added.join('\n') ||
    previous.deleted.join('\n') !== next.deleted.join('\n')
  )
}

export async function readGitStatus(projectPath: string): Promise<GitStatus> {
  const status = await simpleGit(projectPath).status()
  return toGitStatusSnapshot(status, new Date())
}
