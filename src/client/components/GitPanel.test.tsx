import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { fireEvent, screen } from '@testing-library/react'
import GitPanel from './GitPanel'
import { renderWithApp } from '../test-utils'
import { useStore } from '../store'
import { emitGitAction } from '../socket'

vi.mock('../socket', () => ({
  emitGitAction: vi.fn(),
}))

describe('GitPanel', () => {
  beforeEach(() => {
    useStore.setState({
      mySocketId: 'socket-1',
      driverId: 'socket-1',
      gitStatus: {
        branch: 'develop',
        modified: ['src/server/index.ts'],
        added: ['src/client/components/GitPanel.tsx'],
        deleted: [],
        lastUpdated: new Date('2026-04-30T00:00:00.000Z'),
      },
    })
  })

  it('renders branch and grouped file lists', () => {
    renderWithApp(<GitPanel />)
    expect(screen.getByText('develop')).toBeInTheDocument()
    expect(screen.getByText('src/server/index.ts')).toBeInTheDocument()
    expect(screen.getByText('src/client/components/GitPanel.tsx')).toBeInTheDocument()
  })

  it('lets the driver trigger a diff action', () => {
    renderWithApp(<GitPanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Diff' }))
    expect(emitGitAction).toHaveBeenCalledWith('diff')
  })

  it('disables git actions for navigators', () => {
    useStore.setState({ mySocketId: 'socket-2', driverId: 'socket-1' })
    renderWithApp(<GitPanel />)
    expect(screen.getByRole('button', { name: 'Diff' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Log' })).toBeDisabled()
  })

  it('lets the driver trigger a log action', () => {
    renderWithApp(<GitPanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Log' }))
    expect(emitGitAction).toHaveBeenCalledWith('log')
  })
})
