import { describe, it, expect, vi } from 'vitest'
import { renderWithApp } from '../test-utils'
import { screen } from '@testing-library/react'
import { useStore } from '../store'
import FileViewPanel from './FileViewPanel'

vi.mock('./CodeEditor', () => ({
  default: ({ path }: { path: string }) => <div data-testid="markdown-editor">{path}</div>,
}))

describe('FileViewPanel', () => {
  it('renders CodeEditor for .md files', () => {
    useStore.setState({
      openFiles: [{ path: '/project/README.md', content: '# Hello' }],
      activeWorkspaceTab: '/project/README.md',
    })
    renderWithApp(<FileViewPanel />)
    expect(screen.getByTestId('markdown-editor')).toBeInTheDocument()
  })

  it('renders CodeEditor for supported code files', () => {
    useStore.setState({
      openFiles: [{ path: '/project/index.ts', content: 'const x = 1' }],
      activeWorkspaceTab: '/project/index.ts',
    })
    renderWithApp(<FileViewPanel />)
    expect(screen.getByTestId('markdown-editor')).toBeInTheDocument()
  })

  it('renders pre for unsupported file types', () => {
    useStore.setState({
      openFiles: [{ path: '/project/data.csv', content: 'a,b,c' }],
      activeWorkspaceTab: '/project/data.csv',
    })
    renderWithApp(<FileViewPanel />)
    expect(screen.queryByTestId('markdown-editor')).not.toBeInTheDocument()
    expect(screen.getByText('a,b,c')).toBeInTheDocument()
  })

  it('renders empty state when no file is open', () => {
    useStore.setState({ openFiles: [], activeWorkspaceTab: 'agent-output' })
    renderWithApp(<FileViewPanel />)
    expect(screen.getByText('Select a file to view its contents.')).toBeInTheDocument()
  })
})
