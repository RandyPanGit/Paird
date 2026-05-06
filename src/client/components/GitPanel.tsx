import { useState } from 'react'
import { emitGitAction } from '../socket'
import { useStore } from '../store'

export default function GitPanel() {
  const { gitStatus, isDriver } = useStore()
  const [commitMessage, setCommitMessage] = useState('')

  return (
    <section className="flex min-h-0 flex-col rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-900">
      <div className="border-b border-gray-200 dark:border-gray-800 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white">Git Status</div>
      <div className="space-y-3 p-3">
        {!gitStatus ? (
          <p className="text-sm text-gray-500">No git snapshot yet.</p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm text-green-600 dark:text-green-400">{gitStatus.branch}</span>
              <span className="text-xs text-gray-500">{gitStatus.modified.length + gitStatus.added.length + gitStatus.deleted.length} files</span>
            </div>
            <div className="space-y-2 text-xs text-gray-700 dark:text-gray-300">
              {gitStatus.modified.map((file) => <p key={`m-${file}`}>{file}</p>)}
              {gitStatus.added.map((file) => <p key={`a-${file}`}>{file}</p>)}
              {gitStatus.deleted.map((file) => <p key={`d-${file}`}>{file}</p>)}
            </div>
          </>
        )}
        <div className="flex gap-2">
          <button disabled={!isDriver()} onClick={() => emitGitAction('diff')} className="rounded bg-gray-200 dark:bg-gray-800 px-3 py-1 text-xs text-gray-700 dark:text-gray-200 disabled:cursor-not-allowed disabled:opacity-40">Diff</button>
          <button disabled={!isDriver()} onClick={() => emitGitAction('log')} className="rounded bg-gray-200 dark:bg-gray-800 px-3 py-1 text-xs text-gray-700 dark:text-gray-200 disabled:cursor-not-allowed disabled:opacity-40">Log</button>
        </div>
        <div className="flex gap-2">
          <input
            value={commitMessage}
            onChange={(event) => setCommitMessage(event.target.value)}
            placeholder="Commit message"
            className="flex-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-2 py-1 text-xs text-gray-900 dark:text-white"
          />
          <button
            disabled={!isDriver() || !commitMessage.trim()}
            onClick={() => emitGitAction('commit', commitMessage.trim())}
            className="rounded bg-blue-800 px-3 py-1 text-xs text-blue-100 disabled:opacity-40"
          >
            Commit
          </button>
        </div>
      </div>
    </section>
  )
}
