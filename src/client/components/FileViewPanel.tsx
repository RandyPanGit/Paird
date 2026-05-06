import { useStore } from '../store'
import MarkdownEditor from './MarkdownEditor'

export default function FileViewPanel() {
  const openFiles = useStore((state) => state.openFiles)
  const activeWorkspaceTab = useStore((state) => state.activeWorkspaceTab)
  const theme = useStore((state) => state.theme)

  const openFile = openFiles.find(f => f.path === activeWorkspaceTab) ?? null

  const bgClass = theme === 'dark' ? 'bg-[#0d1117]' : 'bg-gray-50'

  if (!openFile) {
    return (
      <div className={`flex flex-1 items-center justify-center rounded-b-lg ${bgClass} p-6 text-sm text-gray-500`}>
        Select a file to view its contents.
      </div>
    )
  }

  if (openFile.path.endsWith('.md')) {
    return (
      <MarkdownEditor
        path={openFile.path}
        initialContent={openFile.content}
        theme={theme}
      />
    )
  }

  return (
    <div className={`flex flex-1 flex-col min-h-0 rounded-b-lg ${bgClass}`}>
      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-800 text-xs text-gray-500 font-mono truncate">
        {openFile.path}
      </div>
      <pre className="flex-1 overflow-auto p-4 text-xs font-mono text-gray-800 dark:text-gray-200 whitespace-pre">
        {openFile.content}
      </pre>
    </div>
  )
}
