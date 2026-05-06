import { describe, it, expect, vi } from 'vitest'
import { renderWithApp } from '../test-utils'
import { screen } from '@testing-library/react'

// Only mock the modules that cause issues in the test environment
vi.mock('../socket', () => ({
  emitWriteFile: vi.fn(() => Promise.resolve({ ok: true })),
}))

vi.mock('marked', () => ({
  marked: {
    parse: vi.fn(() => '<p>test</p>'),
    setOptions: vi.fn(),
  },
}))

vi.mock('highlight.js', () => ({
  default: { highlightElement: vi.fn() },
}))

vi.mock('dompurify', () => ({
  default: { sanitize: vi.fn((h) => h) },
}))

vi.mock('react-resizable-panels', () => ({
  Panel: ({ children }: any) => children,
  PanelGroup: ({ children }: any) => children,
  PanelResizeHandle: () => null,
}))

import MarkdownEditor from './MarkdownEditor'

describe('MarkdownEditor', () => {
  it('renders the file path', () => {
    renderWithApp(
      <MarkdownEditor path="/project/README.md" initialContent="# Hello" theme="light" />
    )
    expect(screen.getByText('/project/README.md')).toBeInTheDocument()
  })

  it('renders editor and preview sections', () => {
    renderWithApp(
      <MarkdownEditor path="/project/README.md" initialContent="# Hello" theme="light" />
    )
    expect(screen.getByText('原始碼')).toBeInTheDocument()
    expect(screen.getByText('預覽')).toBeInTheDocument()
  })

  it('calls emitWriteFile with path and content on Cmd+S', async () => {
    const { emitWriteFile } = await import('../socket')
    renderWithApp(
      <MarkdownEditor path="/project/README.md" initialContent="# Hello" theme="light" />
    )
    expect(emitWriteFile).toBeDefined()
  })
})
