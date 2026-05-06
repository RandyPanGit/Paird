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

vi.mock('@replit/codemirror-vim', () => ({
  vim: vi.fn(() => []),
  Vim: {
    defineEx: vi.fn(),
  },
}))

import CodeEditor from './CodeEditor'

describe('CodeEditor', () => {
  it('renders the file path', () => {
    renderWithApp(
      <CodeEditor path="/project/README.md" initialContent="# Hello" theme="light" />
    )
    expect(screen.getByText('/project/README.md')).toBeInTheDocument()
  })

  it('renders editor and preview sections', () => {
    renderWithApp(
      <CodeEditor path="/project/README.md" initialContent="# Hello" theme="light" />
    )
    expect(screen.getByText('原始碼')).toBeInTheDocument()
    expect(screen.getByText('預覽')).toBeInTheDocument()
  })

  it('mounts without crashing when vim mode is active', () => {
    renderWithApp(
      <CodeEditor path="/project/main.ts" initialContent="const x = 1" theme="dark" />
    )
    expect(document.querySelector('.cm-editor')).not.toBeNull()
  })
})
