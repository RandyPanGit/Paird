import TerminalPanel from './TerminalPanel'
import FileViewPanel from './FileViewPanel'
import GitPanel from './GitPanel'
import GitHistoryPanel from './GitHistoryPanel'
import { useStore } from '../store'

const FIXED_TABS = [
  { id: 'agent-output', label: 'Agent Output' },
  { id: 'git-status', label: 'Git Status' },
  { id: 'git-history', label: 'Git History' },
] as const

export default function WorkspaceTabs() {
  const activeWorkspaceTab = useStore((state) => state.activeWorkspaceTab)
  const setActiveWorkspaceTab = useStore((state) => state.setActiveWorkspaceTab)
  const openFiles = useStore((state) => state.openFiles)
  const closeFileTab = useStore((state) => state.closeFileTab)

  const isFileTab = !FIXED_TABS.some(t => t.id === activeWorkspaceTab)

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-900">
      <div className="flex border-b border-gray-200 dark:border-gray-800">
        {FIXED_TABS.map((tab) => {
          const active = tab.id === activeWorkspaceTab
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveWorkspaceTab(tab.id)}
              className={active
                ? 'border-b border-blue-500 bg-white dark:bg-gray-950 px-4 py-2 text-sm text-gray-900 dark:text-white'
                : 'px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}
            >
              {tab.label}
            </button>
          )
        })}

        {openFiles.map((file) => {
          const active = file.path === activeWorkspaceTab
          const filename = file.path.split('/').pop() ?? file.path
          return (
            <div
              key={file.path}
              className={`flex items-center ${active
                ? 'border-b border-blue-500 bg-white dark:bg-gray-950 text-gray-900 dark:text-white'
                : 'text-gray-500'}`}
            >
              <button
                type="button"
                onClick={() => setActiveWorkspaceTab(file.path)}
                className="px-3 py-2 text-sm"
              >
                {filename}
              </button>
              <button
                type="button"
                aria-label={`Close ${filename}`}
                onClick={(e) => {
                  e.stopPropagation()
                  closeFileTab(file.path)
                }}
                className="pr-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xs leading-none"
              >
                ×
              </button>
            </div>
          )
        })}
      </div>

      <div className={activeWorkspaceTab === 'agent-output' ? 'flex flex-col flex-1 min-h-0' : 'hidden'}><TerminalPanel /></div>
      <div className={activeWorkspaceTab === 'git-status' ? 'flex flex-col flex-1 min-h-0 overflow-y-auto p-3' : 'hidden'}><GitPanel /></div>
      <div className={activeWorkspaceTab === 'git-history' ? 'flex flex-col flex-1 min-h-0' : 'hidden'}><GitHistoryPanel /></div>
      <div className={isFileTab ? 'flex flex-col flex-1 min-h-0' : 'hidden'}><FileViewPanel /></div>
    </div>
  )
}
