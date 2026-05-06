import { beforeEach, describe, expect, it } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import GitHistoryPanel from './GitHistoryPanel'
import { useStore, getAppStoreInitialState } from '../store'

describe('GitHistoryPanel', () => {
  beforeEach(() => {
    useStore.setState(getAppStoreInitialState())
  })

  it('renders an empty state before any git log query runs', () => {
    render(<GitHistoryPanel />)
    expect(screen.getByText('Run Git Log to view commit history here.')).toBeInTheDocument()
  })

  it('renders the newest history item first and expands its content by default', () => {
    useStore.setState({
      gitHistory: [
        {
          id: 'history-2',
          kind: 'log',
          command: 'git log --oneline -10',
          summary: 'def456 Add history panel',
          content: 'def456 Add history panel\nabc123 Add tabs',
          createdAt: '2026-04-30T00:01:00.000Z',
        },
        {
          id: 'history-1',
          kind: 'log',
          command: 'git log --oneline -10',
          summary: 'abc123 Add tabs',
          content: 'abc123 Add tabs',
          createdAt: '2026-04-30T00:00:00.000Z',
        },
      ],
    })

    render(<GitHistoryPanel />)

    expect(screen.getAllByText('git log --oneline -10')[0]).toBeInTheDocument()
    expect(screen.getByText('def456 Add history panel\nabc123 Add tabs', { normalizer: (text) => text })).toBeInTheDocument()
  })

  it('toggles older history items open and closed', () => {
    useStore.setState({
      gitHistory: [
        {
          id: 'history-2',
          kind: 'log',
          command: 'git log --oneline -10',
          summary: 'def456 Add history panel',
          content: 'def456 Add history panel',
          createdAt: '2026-04-30T00:01:00.000Z',
        },
        {
          id: 'history-1',
          kind: 'log',
          command: 'git log --oneline -10',
          summary: 'abc123 Add tabs',
          content: 'abc123 Add tabs',
          createdAt: '2026-04-30T00:00:00.000Z',
        },
      ],
    })

    render(<GitHistoryPanel />)

    fireEvent.click(screen.getByRole('button', { name: 'Show details for git log --oneline -10 from 12:00 AM' }))
    expect(screen.getByText('abc123 Add tabs')).toBeInTheDocument()
  })

  it('keeps older history items after a new item is prepended', () => {
    useStore.setState({
      gitHistory: [
        {
          id: 'history-1',
          kind: 'log',
          command: 'git log --oneline -10',
          summary: 'abc123 Add tabs',
          content: 'abc123 Add tabs',
          createdAt: '2026-04-30T00:00:00.000Z',
        },
      ],
    })

    useStore.getState().appendGitHistory({
      id: 'history-2',
      kind: 'log',
      command: 'git log --oneline -10',
      summary: 'def456 Add history panel',
      content: 'def456 Add history panel',
      createdAt: '2026-04-30T00:01:00.000Z',
    })

    render(<GitHistoryPanel />)

    expect(screen.getByText('def456 Add history panel')).toBeInTheDocument()
    expect(screen.getAllByText('git log --oneline -10')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Show details for git log --oneline -10 from 12:00 AM' }))
    expect(screen.getByText('abc123 Add tabs')).toBeInTheDocument()
  })
})
