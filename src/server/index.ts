import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import path from 'path'
import fs from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { validatePath } from './fsValidator'
import { getConnectionInfo } from './connectionInfo'
import { PtyBridge } from './ptyBridge'
import { SessionManager } from './sessionManager'
import { runGitCommand } from './gitCommandRunner'
import type { GitActionCommand, GitCommandResult } from './gitCommandRunner'
import { hasGitStatusChanged, readGitStatus } from './gitStatusWatcher'
import { buildGitHistoryItem } from './gitHistory'
import type { AppErrorPayload, ChatMessage, GitHistoryItem, FsNode } from '../shared/types'

interface EmitGitActionResultInput {
  command: GitActionCommand
  result: GitCommandResult
  historyItem: GitHistoryItem | null
  emitTerminalOutput: (data: string) => void
  emitGitHistory: (item: GitHistoryItem) => void
  emitError: (code: 'GIT_COMMAND_FAILED', message: string) => void
}

export function emitGitActionResult({
  command,
  result,
  historyItem,
  emitTerminalOutput,
  emitGitHistory,
  emitError,
}: EmitGitActionResultInput): void {
  if (!result.ok) {
    emitError('GIT_COMMAND_FAILED', `Git ${command} failed.`)
    return
  }

  if (command === 'log') {
    if (historyItem) emitGitHistory(historyItem)
    return
  }

  if (result.output) {
    emitTerminalOutput(`${result.output}\n`)
  }
}

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, { cors: { origin: '*' } })

app.use(express.json())

const PORT = Number(process.env.PORT ?? 3000)
const sessionManager = new SessionManager()
const ptyBridge = new PtyBridge()

const startTime = Date.now()
let gitPollInterval: NodeJS.Timeout | null = null

async function refreshGitStatus(reason: 'agent-start' | 'git-action' | 'poll'): Promise<void> {
  const { projectPath } = sessionManager.getFullState()
  if (!projectPath) {
    sessionManager.setGitStatus(null)
    return
  }

  try {
    const nextStatus = await readGitStatus(projectPath)
    const previous = sessionManager.getGitStatus()

    sessionManager.setGitStatus(nextStatus)

    if (hasGitStatusChanged(previous, nextStatus) || reason !== 'poll') {
      io.emit('git:status', nextStatus)
    }
  } catch {
    sessionManager.setGitStatus(null)
  }
}

function startGitPolling(): void {
  if (gitPollInterval) clearInterval(gitPollInterval)
  gitPollInterval = setInterval(() => {
    void refreshGitStatus('poll')
  }, 15000)
}

// PTY exit → broadcast agent:stopped
ptyBridge.onExit(() => {
  sessionManager.setAgentStatus('stopped')
  io.emit('agent:stopped')
})

// PTY output → store in buffer + broadcast terminal:output
ptyBridge.onOutput((data) => {
  sessionManager.appendTerminalOutput(data)
  io.emit('terminal:output', { data })
})

// ─── HTTP Endpoints ───────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    ptyAlive: ptyBridge.isAlive(),
    projectPath: sessionManager.getFullState().projectPath,
    connectedUsers: sessionManager.getFullState().users.length,
    uptime: Math.floor((Date.now() - startTime) / 1000),
  })
})

app.get('/api/session', (_req, res) => {
  res.json(sessionManager.getFullState())
})

app.get('/api/connection-info', (_req, res) => {
  res.json(getConnectionInfo(PORT))
})

app.get('/api/fs/validate', async (req, res) => {
  const p = String(req.query.path ?? '')
  if (!p) {
    res.status(400).json({ error: 'path required' })
    return
  }
  const result = await validatePath(p)
  res.json(result)
})

app.post('/api/agent/start', async (req, res) => {
  const { projectPath } = req.body as { projectPath: string }
  const result = await validatePath(projectPath)
  if (!result.exists || !result.isDirectory) {
    res.status(400).json({ ok: false, error: `路徑不存在：${projectPath}` })
    return
  }
  if (ptyBridge.isAlive()) ptyBridge.kill()
  sessionManager.setProject(projectPath, result.projectName)
  try {
    ptyBridge.spawn(projectPath)
  } catch (err) {
    sessionManager.clearProject()
    res.status(500).json({ ok: false, error: `無法啟動 agent：${err}` })
    return
  }
  io.emit('agent:started', { projectPath, projectName: result.projectName })
  void refreshGitStatus('agent-start')
  startGitPolling()
  res.json({ ok: true, projectPath, projectName: result.projectName, isGitRepo: result.isGitRepo })
})

// Serve frontend static files in production
app.use(express.static(path.join(process.cwd(), 'public')))
app.get('*', (_req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'))
})

// ─── Socket.io Events ─────────────────────────────────────────

function emitError(socketId: string, error: AppErrorPayload): void {
  io.to(socketId).emit('error', error)
}

function broadcastChatMessage(message: ChatMessage): void {
  sessionManager.addChatMessage(message)
  io.emit('chat:message', message)
}

function makeSystemMessage(content: string): ChatMessage {
  return {
    id: randomUUID(),
    senderId: null,
    senderName: 'System',
    content,
    timestamp: new Date(),
    type: 'system',
  }
}

io.on('connection', (socket) => {
  socket.on('user:join', ({ name }: { name: string }) => {
    const user = sessionManager.addUser(socket.id, name)
    if (!sessionManager.getDriver()) {
      sessionManager.setDriver(socket.id)
    }
    socket.emit('session:state', sessionManager.getFullState())
    const buffer = sessionManager.getTerminalBuffer()
    if (buffer) {
      socket.emit('terminal:output', { data: buffer })
    }
    socket.broadcast.emit('user:joined', sessionManager.getFullState().users.find(u => u.socketId === socket.id))
  })

  socket.on('agent:start', async ({ projectPath }: { projectPath: string }) => {
    if (!sessionManager.isDriver(socket.id)) return
    const result = await validatePath(projectPath)
    if (!result.exists || !result.isDirectory) {
      socket.emit('agent:error', { message: `路徑不存在：${projectPath}` })
      return
    }
    if (ptyBridge.isAlive()) ptyBridge.kill()
    sessionManager.setProject(projectPath, result.projectName)
    try {
      ptyBridge.spawn(projectPath)
    } catch (err) {
      socket.emit('agent:error', { message: `無法啟動 agent：${err}` })
      sessionManager.clearProject()
      console.error('Agent start failed:', err)
      return
    }
    io.emit('agent:started', { projectPath, projectName: result.projectName })
    void refreshGitStatus('agent-start')
    startGitPolling()
  })

  socket.on('terminal:input', ({ data }: { data: string }) => {
    if (!sessionManager.isDriver(socket.id)) return
    ptyBridge.write(data)
  })

  socket.on('agent:stop', () => {
    if (!sessionManager.isDriver(socket.id)) return
    ptyBridge.kill()
    if (gitPollInterval) {
      clearInterval(gitPollInterval)
      gitPollInterval = null
    }
    sessionManager.setGitStatus(null)
    sessionManager.clearProject()
    io.emit('agent:stopped')
  })

  socket.on('git:action', async ({ command, message }: { command: 'diff' | 'log' | 'commit'; message?: string }) => {
    if (!sessionManager.isDriver(socket.id)) {
      emitError(socket.id, { code: 'NOT_DRIVER', message: 'Only the driver can run this command.' })
      return
    }

    const projectPath = sessionManager.getFullState().projectPath
    if (!projectPath) {
      emitError(socket.id, { code: 'GIT_REPO_REQUIRED', message: 'Start the agent in a git repository first.' })
      return
    }

    const result = await runGitCommand(projectPath, command, message ?? null)
    const historyItem = command === 'log' && result.ok
      ? buildGitHistoryItem({ command, output: result.output })
      : null

    let gitCommandFailed = false

    emitGitActionResult({
      command,
      result,
      historyItem,
      emitTerminalOutput: (data) => io.emit('terminal:output', { data }),
      emitGitHistory: (item) => io.emit('git:history:added', item),
      emitError: (code, errorMessage) => {
        gitCommandFailed = true
        emitError(socket.id, { code, message: errorMessage })
      },
    })

    if (gitCommandFailed) {
      return
    }

    await refreshGitStatus('git-action')
  })

  socket.on('terminal:resize', ({ cols, rows }: { cols: number; rows: number }) => {
    ptyBridge.resize(cols, rows)
  })

  socket.on('chat:send', ({ content }: { content: string }) => {
    const trimmed = content.trim()
    if (!trimmed) return

    const sender = sessionManager.getFullState().users.find((user) => user.socketId === socket.id)
    if (!sender) return

    broadcastChatMessage({
      id: randomUUID(),
      senderId: sender.socketId,
      senderName: sender.name,
      content: trimmed,
      timestamp: new Date(),
      type: 'user',
    })
  })

  socket.on('fs:read-dir', async ({ path: reqPath }: { path: string }, callback: (nodes: FsNode[] | { error: string }) => void) => {
    const projectPath = sessionManager.getFullState().projectPath
    if (!projectPath) { callback({ error: 'no project loaded' }); return }

    const resolved = path.resolve(reqPath)
    if (!resolved.startsWith(path.resolve(projectPath))) {
      callback({ error: 'path outside project' }); return
    }

    try {
      const entries = await fs.readdir(resolved, { withFileTypes: true })
      const nodes: FsNode[] = entries
        .filter(e => !e.name.startsWith('.') && e.name !== 'node_modules')
        .map(e => ({
          name: e.name,
          path: path.join(resolved, e.name),
          type: e.isDirectory() ? 'dir' : 'file',
        }))
        .sort((a, b) => {
          if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
          return a.name.localeCompare(b.name)
        })
      callback(nodes)
    } catch {
      callback({ error: 'read failed' })
    }
  })

  socket.on('fs:read-file', async ({ path: reqPath }: { path: string }, callback: (result: { content: string } | { error: string }) => void) => {
    const projectPath = sessionManager.getFullState().projectPath
    if (!projectPath) { callback({ error: 'no project loaded' }); return }

    const resolved = path.resolve(reqPath)
    if (!resolved.startsWith(path.resolve(projectPath))) {
      callback({ error: 'path outside project' }); return
    }

    try {
      const buf = await fs.readFile(resolved)
      if (buf.includes(0)) { callback({ content: '[binary file]' }); return }
      callback({ content: buf.toString('utf8') })
    } catch {
      callback({ error: 'read failed' })
    }
  })

  socket.on('fs:write-file', async (
    { path: reqPath, content }: { path: string; content: string },
    callback: (result: { ok: true } | { error: string }) => void
  ) => {
    const projectPath = sessionManager.getFullState().projectPath
    if (!projectPath) { callback({ error: 'no project loaded' }); return }

    const resolved = path.resolve(reqPath)
    if (!resolved.startsWith(path.resolve(projectPath))) {
      callback({ error: 'path outside project' }); return
    }

    try {
      await fs.writeFile(resolved, content, 'utf8')
      callback({ ok: true })
    } catch {
      callback({ error: 'write failed' })
    }
  })

  socket.on('disconnect', () => {
    const { removedUser, newDriverId } = sessionManager.removeUser(socket.id)
    if (removedUser) {
      io.emit('user:left', { socketId: socket.id, name: removedUser.name })
    }
    if (newDriverId) {
      io.emit('driver:changed', {
        newDriverId,
        newDriverName: sessionManager.getDriver()?.name ?? '',
      })
    }
  })
})

if (process.env.NODE_ENV !== 'test') {
  httpServer.listen(PORT,'0.0.0.0', () => {
    console.log(`Paird server running on http://localhost:${PORT}`)
  })
}
