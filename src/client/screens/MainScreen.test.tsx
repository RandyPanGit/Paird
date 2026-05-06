import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { fireEvent, screen } from '@testing-library/react'
import MainScreen from './MainScreen'
import { renderWithApp } from '../test-utils'
import { useStore, getAppStoreInitialState } from '../store'

vi.mock('../components/TerminalPanel', () => ({
  default: () => <div>Agent Output Body</div>,
}))

vi.mock('../components/GitHistoryPanel', () => ({
  default: () => <div>Git History Body</div>,
}))

vi.mock('../socket', () => ({
  getSocket: vi.fn(() => ({ emit: vi.fn() })),
  emitTaskUpdate: vi.fn(),
  emitGitAction: vi.fn(),
  emitChatSend: vi.fn(),
  onTerminalOutput: vi.fn(() => () => {}),
}))

beforeEach(() => {
  // Mock scrollIntoView which is not available in jsdom
  Element.prototype.scrollIntoView = vi.fn()
})

describe('MainScreen', () => {
  beforeEach(() => {
    useStore.setState({
      ...getAppStoreInitialState(),
      mySocketId: 'socket-1',
      driverId: 'socket-1',
      users: [{ socketId: 'socket-1', name: 'Alice', joinedAt: new Date(), isDriver: true }],
      projectName: 'paird',
      projectPath: '/tmp/paird',
      agentStatus: 'running',
    })
  })

  it('renders workspace tabs alongside git status, and team chat', () => {
    renderWithApp(<MainScreen />)
    expect(screen.getByRole('button', { name: 'Git Status' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Agent Output' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Git History' })).toBeInTheDocument()
    expect(screen.getByText('Team Chat')).toBeInTheDocument()
    expect(screen.getByText('Agent Output Body')).toBeInTheDocument()
  })

  it('switches to the Git History tab when clicked', () => {
    renderWithApp(<MainScreen />)
    fireEvent.click(screen.getByRole('button', { name: 'Git History' }))
    expect(screen.getByText('Git History Body')).toBeInTheDocument()
  })
})
