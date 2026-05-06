import { useEffect, useRef, useCallback } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { EditorView, lineNumbers, keymap } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { javascript } from '@codemirror/lang-javascript'
import { java } from '@codemirror/lang-java'
import { oneDark, oneDarkHighlightStyle } from '@codemirror/theme-one-dark'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { emitWriteFile } from '../socket'
import { marked } from 'marked'
import hljs from 'highlight.js'
import DOMPurify from 'dompurify'

marked.setOptions({
  async: false,
})

interface Props {
  path: string
  initialContent: string
  theme: 'dark' | 'light'
}

function getLanguageExtension(path: string) {
  const ext = path.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'js':
    case 'jsx':
      return javascript({ jsx: true })
    case 'ts':
    case 'tsx':
      return javascript({ jsx: true, typescript: true })
    case 'java':
      return java()
    default:
      return markdown()
  }
}

export default function CodeEditor({ path, initialContent, theme }: Props) {
  const editorContainerRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const isDirtyRef = useRef(false)

  const updatePreview = useCallback((content: string) => {
    if (!previewRef.current) return
    const rawHtml = marked.parse(content) as string
    const clean = DOMPurify.sanitize(rawHtml)
    previewRef.current.innerHTML = clean
    previewRef.current.querySelectorAll<HTMLElement>('pre code').forEach((block) => {
      hljs.highlightElement(block)
    })
  }, [])

  useEffect(() => {
    if (!editorContainerRef.current) return

    const saveKeymap = keymap.of([{
      key: 'Mod-s',
      run: (view) => {
        const content = view.state.doc.toString()
        emitWriteFile(path, content).then((result) => {
          if ('ok' in result) {
            isDirtyRef.current = false
          }
        })
        return true
      },
    }])

    const extensions = [
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      saveKeymap,
      getLanguageExtension(path),
      lineNumbers(),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          isDirtyRef.current = true
          updatePreview(update.state.doc.toString())
        }
      }),
      EditorView.theme({
        '&': { height: '100%' },
        '.cm-scroller': { overflow: 'auto', fontFamily: 'monospace', fontSize: '12px' },
      }),
      ...(theme === 'dark'
        ? [oneDark, syntaxHighlighting(oneDarkHighlightStyle)]
        : [syntaxHighlighting(defaultHighlightStyle)]),
    ]

    const state = EditorState.create({ doc: initialContent, extensions })
    const view = new EditorView({ state, parent: editorContainerRef.current })
    viewRef.current = view
    updatePreview(initialContent)

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [path, initialContent, theme, updatePreview])

  const bgClass = theme === 'dark' ? 'bg-[#0d1117] text-gray-200' : 'bg-gray-50 text-gray-800'
  const borderClass = theme === 'dark' ? 'border-gray-800' : 'border-gray-200'

  return (
    <div className={`flex flex-1 flex-col min-h-0 rounded-b-lg ${bgClass}`}>
      <div className={`px-4 py-2 border-b ${borderClass} text-xs text-gray-500 font-mono truncate`}>
        {path}
      </div>
      <PanelGroup direction="horizontal" className="flex-1 min-h-0">
        <Panel defaultSize={50} minSize={20}>
          <div className={`h-full flex flex-col border-r ${borderClass}`}>
            <div className={`px-3 py-1 text-xs text-gray-500 border-b ${borderClass}`}>原始碼</div>
            <div ref={editorContainerRef} className="flex-1 min-h-0 overflow-hidden" />
          </div>
        </Panel>
        <PanelResizeHandle className={`w-1 cursor-col-resize ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-500' : 'bg-gray-300 hover:bg-gray-400'} transition-colors`} />
        <Panel defaultSize={50} minSize={20}>
          <div className="h-full flex flex-col">
            <div className={`px-3 py-1 text-xs text-gray-500 border-b ${borderClass}`}>預覽</div>
            <div
              ref={previewRef}
              className={`flex-1 overflow-auto p-4 prose prose-sm max-w-none ${theme === 'dark' ? 'prose-invert' : ''}`}
            />
          </div>
        </Panel>
      </PanelGroup>
    </div>
  )
}
