import { useStore } from '../store'
import { emitAgentStop } from '../socket'

export default function AgentControlBar() {
  const { projectPath, isDriver } = useStore()

  if (!isDriver()) return null

  return (
    <div className="bg-gray-100 dark:bg-gray-900 border-b border-gray-300 dark:border-gray-700 px-4 py-2 flex items-center gap-3">
      <span className="text-gray-500 dark:text-gray-400 text-sm">📁</span>
      <span className="text-gray-700 dark:text-gray-300 font-mono text-sm flex-1 truncate">{projectPath}</span>
      <button
        onClick={() => emitAgentStop()}
        className="text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-3 py-1 rounded transition-colors"
      >
        重新啟動
      </button>
      <button
        onClick={() => emitAgentStop()}
        className="text-xs bg-red-100 dark:bg-red-900 hover:bg-red-200 dark:hover:bg-red-800 text-red-700 dark:text-red-300 px-3 py-1 rounded transition-colors"
      >
        停止
      </button>
    </div>
  )
}
