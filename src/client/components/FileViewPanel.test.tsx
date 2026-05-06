import { describe, it, expect, vi } from 'vitest'
import { renderWithApp } from '../test-utils'
import { screen } from '@testing-library/react'
import { useStore } from '../store'
import FileViewPanel from './FileViewPanel'

vi.mock('./MarkdownEditor', () => ({
  default: ({ path }: { path: string }) => <div data-testid="markdown-editor">{path}</div>,
}))

describe('FileViewPanel', () => {
  it('renders MarkdownEditor for .md files', () => {
    useStore.setState({
      openFiles: [{ path: '/project/README.md', content: '# Hello' }],
      activeWorkspaceTab: '/project/README.md',
    })
    renderWithApp(<FileViewPanel />)
    expect(screen.getByTestId('markdown-editor')).toBeInTheDocument()
  })

  it('renders pre for non-.md files', () => {
    useStore.setState({
      openFiles: [{ path: '/project/index.ts', content: 'const x = 1' }],
      activeWorkspaceTab: '/project/index.ts',
    })
    renderWithApp(<FileViewPanel />)
    expect(screen.queryByTestId('markdown-editor')).not.toBeInTheDocument()
    expect(screen.getByText('const x = 1')).toBeInTheDocument()
  })

  it('renders empty state when no file is open', () => {
    useStore.setState({ openFiles: [], activeWorkspaceTab: 'agent-output' })
    renderWithApp(<FileViewPanel />)
    expect(screen.getByText('Select a file to view its contents.')).toBeInTheDocument()
  })
})
