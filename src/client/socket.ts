import { io, Socket } from 'socket.io-client'
import { useStore } from './store'
import type {
  User,
  SessionState,
  ChatMessage,
  GitStatus,
  GitHistoryItem,
} from '../shared/types'

let socket: Socket | null = null
const terminalOutputListeners = new Set<(data: string) => void>()

export function getSocket(): Socket {
  if (!socket) {
    socket = io({ autoConnect: false })
  }
  return socket
}

export function onTerminalOutput(cb: (data: string) => void): () => void {
  terminalOutputListeners.add(cb)
  return () => terminalOutputListeners.delete(cb)
}

export function connectSocket(serverUrl: string, name: string): void {
  const s = getSocket()
  const store = useStore.getState()

  store.setMyName(name)

  if (s.connected) s.disconnect()

  // 重新指向新的 server URL
  socket = io(serverUrl, { autoConnect: false })
  const newSocket = socket

  newSocket.on('connect', () => {
    store.setConnected(newSocket.id!)
    newSocket.emit('user:join', { name })
  })

  newSocket.on('disconnect', () => {
    store.setDisconnected()
  })

  newSocket.on('session:state', (state: SessionState) => {
    store.setUsers(state.users)
    store.setDriverId(state.driverId)
    store.setProject(state.projectPath, state.projectName)
    store.setAgentStatus(state.agentStatus)
    store.setChatMessages(state.chatHistory)
    store.setGitStatus(state.gitStatus)
    store.clearGitHistory()
  })

  newSocket.on('git:status', (status: GitStatus) => {
    store.setGitStatus(status)
  })

  newSocket.on('git:history:added', (item: GitHistoryItem) => {
    store.appendGitHistory(item)
  })

  newSocket.on('chat:message', (message: ChatMessage) => {
    store.appendChatMessage(message)
  })

  newSocket.on('user:joined', (user: User) => {
    const users = useStore.getState().users
    if (!users.find(u => u.socketId === user.socketId)) {
      store.setUsers([...users, user])
    }
  })

  newSocket.on('user:left', ({ socketId }: { socketId: string }) => {
    store.setUsers(useStore.getState().users.filter(u => u.socketId !== socketId))
  })

  newSocket.on('driver:changed', ({ newDriverId }: { newDriverId: string }) => {
    store.setDriverId(newDriverId)
    const users = useStore.getState().users.map(u => ({
      ...u,
      isDriver: u.socketId === newDriverId,
    }))
    store.setUsers(users)
  })

  newSocket.on('agent:started', ({ projectPath, projectName }: { projectPath: string; projectName: string }) => {
    store.setProject(projectPath, projectName)
    store.setAgentStatus('running')
  })

  newSocket.on('agent:stopped', () => {
    store.setAgentStatus('stopped')
    store.setProject(null, null)
    store.setGitStatus(null)
    store.clearGitHistory()
  })

  newSocket.on('terminal:output', ({ data }: { data: string }) => {
    terminalOutputListeners.forEach(cb => cb(data))
  })

  newSocket.connect()
}

export function emitAgentStart(projectPath: string): void {
  getSocket().emit('agent:start', { projectPath })
}

export function emitAgentStop(): void {
  getSocket().emit('agent:stop')
}

export function emitTerminalResize(cols: number, rows: number): void {
  getSocket().emit('terminal:resize', { cols, rows })
}

export function emitChatSend(content: string): void {
  getSocket().emit('chat:send', { content })
}

export function emitTerminalInput(data: string): void {
  getSocket().emit('terminal:input', { data })
}

export function emitGitAction(command: 'diff' | 'log' | 'commit', message?: string): void {
  getSocket().emit('git:action', { command, message })
}

export function emitWriteFile(
  filePath: string,
  content: string
): Promise<{ ok: true } | { error: string }> {
  return new Promise((resolve) => {
    getSocket().emit('fs:write-file', { path: filePath, content }, resolve)
  })
}
