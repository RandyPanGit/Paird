import { randomUUID } from 'node:crypto'
import type { GitActionCommand } from './gitCommandRunner'
import type { GitHistoryItem } from '../shared/types'
import { getGitCommandLabel } from './gitCommandRunner'

interface BuildGitHistoryItemInput {
  command: GitActionCommand
  output: string
}

function buildSummary(output: string): string {
  const lines = output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 2)

  return lines.length > 0 ? lines.join('\n') : 'No output'
}

export function buildGitHistoryItem({ command, output }: BuildGitHistoryItemInput): GitHistoryItem {
  return {
    id: randomUUID(),
    kind: 'log',
    command: getGitCommandLabel(command),
    summary: buildSummary(output),
    content: output,
    createdAt: new Date().toISOString(),
  }
}
