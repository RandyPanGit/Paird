import { create } from 'zustand'
import type {
  User,
  AgentStatus,
  ChatMessage,
  GitStatus,
  GitHistoryItem,
  WorkspaceTab,
} from '../shared/types'

interface AppStore {
  isConnected: boolean
  mySocketId: string | null
  myName: string | null
  users: User[]
  driverId: string | null
  projectPath: string | null
  projectName: string | null
  agentStatus: AgentStatus
  chatMessages: ChatMessage[]
  gitStatus: GitStatus | null
  activeWorkspaceTab: WorkspaceTab
  gitHistory: GitHistoryItem[]
  theme: 'dark' | 'light'
  toggleTheme: () => void
  fontSize: number
  setFontSize: (n: number) => void
  isDriver: () => boolean
  setConnected: (socketId: string) => void
  setDisconnected: () => void
  setMyName: (name: string) => void
  setUsers: (users: User[]) => void
  setDriverId: (id: string | null) => void
  setProject: (path: string | null, name: string | null) => void
  setAgentStatus: (status: AgentStatus) => void
  setChatMessages: (messages: ChatMessage[]) => void
  appendChatMessage: (message: ChatMessage) => void
  setGitStatus: (status: GitStatus | null) => void
  setActiveWorkspaceTab: (tab: WorkspaceTab) => void
  appendGitHistory: (item: GitHistoryItem) => void
  clearGitHistory: () => void
  openFiles: { path: string; content: string }[]
  openFileTab: (file: { path: string; content: string }) => void
  closeFileTab: (path: string) => void
}

const initialState = {
  isConnected: false,
  mySocketId: null,
  myName: null,
  users: [],
  driverId: null,
  projectPath: null,
  projectName: null,
  agentStatus: 'idle' as AgentStatus,
  chatMessages: [],
  gitStatus: null,
  gitHistory: [],
  activeWorkspaceTab: 'agent-output' as WorkspaceTab,
  theme: 'light' as const,
  fontSize: Number(localStorage.getItem('fontSize')) || 14,
  openFiles: [] as { path: string; content: string }[],
}

export const useStore = create<AppStore>((set, get) => ({
  ...initialState,

  isDriver: () => {
    const { mySocketId, driverId } = get()
    return mySocketId !== null && mySocketId === driverId
  },

  setConnected: (socketId) => set({ isConnected: true, mySocketId: socketId }),
  setDisconnected: () => set({ isConnected: false, mySocketId: null }),
  setMyName: (name) => set({ myName: name }),
  setUsers: (users) => set({ users }),
  setDriverId: (id) => set({ driverId: id }),
  setProject: (path, name) => set({ projectPath: path, projectName: name }),
  setAgentStatus: (status) => set({ agentStatus: status }),
  setChatMessages: (messages) => set({ chatMessages: messages }),
  appendChatMessage: (message) => set((state) => ({ chatMessages: [...state.chatMessages, message] })),
  setGitStatus: (status) => set({ gitStatus: status }),
  setActiveWorkspaceTab: (tab) => set({ activeWorkspaceTab: tab }),
  appendGitHistory: (item) => set((state) => ({ gitHistory: [item, ...state.gitHistory] })),
  clearGitHistory: () => set({ gitHistory: [], activeWorkspaceTab: 'agent-output' }),
  openFileTab: (file) => set((state) => {
    const exists = state.openFiles.some(f => f.path === file.path)
    if (exists) {
      return { activeWorkspaceTab: file.path }
    }
    return {
      openFiles: [...state.openFiles, file],
      activeWorkspaceTab: file.path,
    }
  }),
  closeFileTab: (path) => set((state) => {
    const index = state.openFiles.findIndex(f => f.path === path)
    if (index === -1) return {}
    const newOpenFiles = state.openFiles.filter(f => f.path !== path)
    let newActiveTab = state.activeWorkspaceTab
    if (state.activeWorkspaceTab === path) {
      // Build allTabs with the file still present to find its position
      const allTabs = ['agent-output', ...state.openFiles.map(f => f.path)]
      const currentIndex = allTabs.indexOf(path)
      newActiveTab = currentIndex > 0 ? allTabs[currentIndex - 1] : 'agent-output'
    }
    return { openFiles: newOpenFiles, activeWorkspaceTab: newActiveTab }
  }),
  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark'
    document.documentElement.classList.toggle('dark', next === 'dark')
    set({ theme: next })
  },
  setFontSize: (n) => {
    localStorage.setItem('fontSize', String(n))
    document.documentElement.style.setProperty('--font-size-base', n + 'px')
    set({ fontSize: n })
  },
}))

const persistedFontSize = Number(localStorage.getItem('fontSize')) || 14
document.documentElement.style.setProperty('--font-size-base', persistedFontSize + 'px')

export const getAppStoreInitialState = () => ({ ...initialState })
;(useStore as any).getInitialState = getAppStoreInitialState
