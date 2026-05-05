import type { User, SessionState, AgentStatus, ChatMessage, GitStatus } from '../shared/types'

export class SessionManager {
  private users: Map<string, User> = new Map()
  private driverId: string | null = null
  private projectPath: string | null = null
  private projectName: string | null = null
  private agentStatus: AgentStatus = 'idle'
  private chatHistory: ChatMessage[] = []
  private gitStatus: GitStatus | null = null
  private terminalBuffer: string = ''
  private static readonly TERMINAL_BUFFER_MAX = 50 * 1024 // 50KB

  addUser(socketId: string, name: string): User {
    const user: User = {
      socketId,
      name,
      joinedAt: new Date(),
      isDriver: false,
    }
    this.users.set(socketId, user)
    return user
  }

  removeUser(socketId: string): { removedUser: User | null; newDriverId: string | null } {
    const removedUser = this.users.get(socketId) ?? null
    this.users.delete(socketId)

    let newDriverId: string | null = null

    if (this.driverId === socketId) {
      this.driverId = null
      const next = this.users.keys().next().value
      if (next) {
        this.setDriver(next)
        newDriverId = next
      }
    }

    return { removedUser, newDriverId }
  }

  isDriver(socketId: string): boolean {
    return this.driverId === socketId
  }

  getDriver(): User | null {
    if (!this.driverId) return null
    return this.users.get(this.driverId) ?? null
  }

  setDriver(socketId: string): void {
    if (this.driverId) {
      const previousDriver = this.users.get(this.driverId)
      if (previousDriver) previousDriver.isDriver = false
    }

    this.driverId = socketId
    const nextDriver = this.users.get(socketId)
    if (nextDriver) nextDriver.isDriver = true
  }

  passDriverTo(socketId: string): void {
    this.setDriver(socketId)
  }

  findUsersByName(name: string): User[] {
    return Array.from(this.users.values()).filter(user => user.name === name)
  }

  setProject(projectPath: string, projectName: string): void {
    this.projectPath = projectPath
    this.projectName = projectName
    this.agentStatus = 'running'
  }

  clearProject(): void {
    this.projectPath = null
    this.projectName = null
    this.agentStatus = 'idle'
    this.terminalBuffer = ''
  }

  setAgentStatus(status: AgentStatus): void {
    this.agentStatus = status
  }

  addChatMessage(message: ChatMessage): void {
    this.chatHistory.push(message)
    if (this.chatHistory.length > 100) {
      this.chatHistory = this.chatHistory.slice(-100)
    }
  }

  getChatHistory(): ChatMessage[] {
    return [...this.chatHistory]
  }

  setGitStatus(status: GitStatus | null): void {
    this.gitStatus = status ? { ...status } : null
  }

  getGitStatus(): GitStatus | null {
    return this.gitStatus ? { ...this.gitStatus } : null
  }

  appendTerminalOutput(data: string): void {
    this.terminalBuffer += data
    if (this.terminalBuffer.length > SessionManager.TERMINAL_BUFFER_MAX) {
      this.terminalBuffer = this.terminalBuffer.slice(-SessionManager.TERMINAL_BUFFER_MAX)
    }
  }

  getTerminalBuffer(): string {
    return this.terminalBuffer
  }

  getFullState(): SessionState {
    return {
      driverId: this.driverId,
      users: Array.from(this.users.values()),
      projectPath: this.projectPath,
      projectName: this.projectName,
      agentStatus: this.agentStatus,
      chatHistory: this.getChatHistory(),
      gitStatus: this.getGitStatus(),
    }
  }
}
