import { spawn } from 'node:child_process'

export type GitActionCommand = 'diff' | 'log' | 'commit'

export interface GitActionRequest {
  command: GitActionCommand
  message: string | null
  projectPath: string
}

export interface GitCommandResult {
  ok: boolean
  output: string
}

export function getGitCommandLabel(command: GitActionCommand, message?: string | null): string {
  if (command === 'diff') return 'git diff --stat'
  if (command === 'log') return 'git log --oneline -10'
  const commitMessage = message ?? ''
  return `git commit -m "${commitMessage}"`
}

export async function runGitCommand(
  projectPathOrRequest: string | GitActionRequest,
  command?: 'diff' | 'log' | 'commit',
  message?: string | null,
): Promise<GitCommandResult> {
  let projectPath: string
  let cmd: 'diff' | 'log' | 'commit'
  let msg: string | null

  if (typeof projectPathOrRequest === 'object') {
    projectPath = projectPathOrRequest.projectPath
    cmd = projectPathOrRequest.command
    msg = projectPathOrRequest.message
  } else {
    projectPath = projectPathOrRequest
    cmd = command!
    msg = message ?? null
  }

  return runGitCommandInternal(projectPath, cmd, msg)
}

async function runGitCommandInternal(
  projectPath: string,
  command: 'diff' | 'log' | 'commit',
  message: string | null,
): Promise<GitCommandResult> {
  const args =
    command === 'diff'
      ? ['diff', '--stat']
      : command === 'log'
        ? ['log', '--oneline', '-10']
        : ['commit', '-m', message ?? '']

  if (command !== 'commit') {
    return await spawnGit(projectPath, 'git', args)
  }

  const addResult = await spawnGit(projectPath, 'git', ['add', '-A'])
  if (!addResult.ok) return addResult

  return await spawnGit(projectPath, 'git', args)
}

export async function runGitAction(request: GitActionRequest): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await runGitCommand(request)
  if (result.ok) return { ok: true }
  return { ok: false, error: result.output }
}

function spawnGit(cwd: string, command: string, args: string[]): Promise<GitCommandResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd })
    let output = ''

    child.stdout.on('data', (chunk) => {
      output += chunk.toString()
    })

    child.stderr.on('data', (chunk) => {
      output += chunk.toString()
    })

    child.on('close', (code) => {
      resolve({ ok: code === 0, output })
    })
  })
}
