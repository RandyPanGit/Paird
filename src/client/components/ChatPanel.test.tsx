import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import ChatPanel from './ChatPanel'
import { renderWithApp } from '../test-utils'
import { useStore } from '../store'
import { emitChatSend } from '../socket'

vi.mock('../socket', () => ({
  emitChatSend: vi.fn(),
}))

beforeEach(() => {
  // Mock scrollIntoView which is not available in jsdom
  Element.prototype.scrollIntoView = vi.fn()
})

describe('ChatPanel', () => {
  beforeEach(() => {
    useStore.setState({
      isConnected: true,
      mySocketId: 'socket-1',
      myName: 'Alice',
      users: [
        { socketId: 'socket-1', name: 'Alice', joinedAt: new Date(), isDriver: true },
        { socketId: 'socket-2', name: 'Bob', joinedAt: new Date(), isDriver: false },
      ],
      driverId: 'socket-1',
      projectPath: '/tmp/project',
      projectName: 'project',
      agentStatus: 'running',
      chatMessages: [
        {
          id: 'm1',
          senderId: 'socket-2',
          senderName: 'Bob',
          content: 'hello team',
          timestamp: new Date('2026-04-30T00:00:00.000Z'),
          type: 'user',
        },
        {
          id: 'm2',
          senderId: null,
          senderName: 'System',
          content: 'Alice passed driver to Bob',
          timestamp: new Date('2026-04-30T00:01:00.000Z'),
          type: 'system',
        },
      ],
    })
  })

  it('renders chat messages and system messages', () => {
    renderWithApp(<ChatPanel />)
    expect(screen.getByText('hello team')).toBeInTheDocument()
    expect(screen.getByText('Alice passed driver to Bob')).toBeInTheDocument()
  })

  it('shows the driver placeholder', () => {
    renderWithApp(<ChatPanel />)
    expect(screen.getByPlaceholderText('Send command to agent...')).toBeInTheDocument()
  })

  it('shows the navigator placeholder for non-drivers', () => {
    useStore.setState({ mySocketId: 'socket-2', driverId: 'socket-1' })
    renderWithApp(<ChatPanel />)
    expect(screen.getByPlaceholderText('Message teammates')).toBeInTheDocument()
  })

  it('sends trimmed content and clears the input', () => {
    renderWithApp(<ChatPanel />)
    const input = screen.getByRole('textbox')

    fireEvent.change(input, { target: { value: '  hello paird  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(emitChatSend).toHaveBeenCalledWith('hello paird')
    expect(input).toHaveValue('')
  })

  it('keeps the team chat heading visible when there are no messages', () => {
    useStore.setState({ chatMessages: [] })
    renderWithApp(<ChatPanel />)
    expect(screen.getByText('Team Chat')).toBeInTheDocument()
  })

  it('renders avatar initials for each online user', () => {
    renderWithApp(<ChatPanel />)
    expect(screen.getByTitle('Alice (Driver)')).toBeInTheDocument()
    expect(screen.getByTitle('Bob')).toBeInTheDocument()
  })

  it('shows blue avatar for driver and gray for navigator', () => {
    renderWithApp(<ChatPanel />)
    const driverAvatar = screen.getByTitle('Alice (Driver)')
    const navAvatar = screen.getByTitle('Bob')
    expect(driverAvatar).toHaveClass('bg-blue-600')
    expect(navAvatar).toHaveClass('bg-gray-500')
  })

  it('shows ring on own avatar', () => {
    renderWithApp(<ChatPanel />)
    const ownAvatar = screen.getByTitle('Alice (Driver)')
    expect(ownAvatar).toHaveClass('ring-2')
  })

  it('aligns own messages to the right', () => {
    useStore.setState({
      chatMessages: [
        {
          id: 'm3',
          senderId: 'socket-1',
          senderName: 'Alice',
          content: 'my own message',
          timestamp: new Date(),
          type: 'user',
        },
      ],
    })
    renderWithApp(<ChatPanel />)
    const bubble = screen.getByText('my own message').closest('[data-testid="message-bubble"]')
    expect(bubble).toHaveClass('items-end')
  })

  it('aligns other messages to the left', () => {
    renderWithApp(<ChatPanel />)
    const bubble = screen.getByText('hello team').closest('[data-testid="message-bubble"]')
    expect(bubble).toHaveClass('items-start')
  })
})
