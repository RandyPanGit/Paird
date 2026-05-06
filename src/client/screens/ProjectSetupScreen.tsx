import { useState, useEffect, useRef } from 'react'
import { emitAgentStart, getSocket } from '../socket'
import type { ValidatePathResult } from '../../shared/types'

const STORAGE_KEY = 'paird:recentPaths'
const MAX_RECENT = 5

function getRecentPaths(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function saveRecentPath(p: string): void {
  const paths = [p, ...getRecentPaths().filter(x => x !== p)].slice(0, MAX_RECENT)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(paths))
}

export default function ProjectSetupScreen() {
  const [pathInput, setPathInput] = useState('')
  const [validation, setValidation] = useState<ValidatePathResult | null>(null)
  const [validating, setValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recentPaths] = useState<string[]>(getRecentPaths)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const socket = getSocket()
    const handler = ({ message }: { message: string }) => setError(message)
    socket.on('agent:error', handler)
    return () => { socket.off('agent:error', handler) }
  }, [])

  function handlePathChange(value: string) {
    setPathInput(value)
    setValidation(null)
    setError(null)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value.trim()) return
    debounceRef.current = setTimeout(() => validate(value.trim()), 500)
  }

  async function validate(p: string) {
    setValidating(true)
    try {
      const res = await fetch(`/api/fs/validate?path=${encodeURIComponent(p)}`)
      const data: ValidatePathResult = await res.json()
      setValidation(data)
    } catch {
      setError('驗證失敗，請檢查網路連線')
    } finally {
      setValidating(false)
    }
  }

  function handleStart() {
    if (!canStart) return
    saveRecentPath(pathInput.trim())
    emitAgentStart(pathInput.trim())
  }

  const canStart = validation?.exists && validation?.isDirectory && !validating && !error

  function validationMessage() {
    if (validating) return <span className="text-gray-500 text-sm">驗證中...</span>
    if (!validation) return null
    if (!validation.exists) return <span className="text-red-500 text-sm">✗ 路徑不存在</span>
    if (!validation.isDirectory) return <span className="text-red-500 text-sm">✗ 不是目錄</span>
    if (!validation.isGitRepo) return <span className="text-yellow-500 text-sm">⚠ 非 git repo，可繼續但 git 面板無法使用</span>
    return <span className="text-green-600 dark:text-green-400 text-sm">✓ 有效的 git repo：{validation.projectName}</span>
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-8 w-full max-w-md space-y-5">
        <h1 className="text-gray-900 dark:text-white text-2xl font-bold">Paird — 設定 Project</h1>

        <div className="space-y-1">
          <label className="text-gray-500 dark:text-gray-400 text-sm">Project 路徑</label>
          <input
            type="text"
            value={pathInput}
            onChange={e => handlePathChange(e.target.value)}
            onBlur={() => pathInput.trim() && validate(pathInput.trim())}
            placeholder="/Users/alice/projects/my-app"
            className="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
          />
          <div className="min-h-5">{validationMessage()}</div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>

        <button
          onClick={handleStart}
          disabled={!canStart}
          className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-400 dark:disabled:text-gray-500 text-white font-medium py-2 rounded transition-colors"
        >
          啟動 Agent
        </button>

        {recentPaths.length > 0 && (
          <div className="space-y-2">
            <p className="text-gray-400 dark:text-gray-500 text-xs">最近使用的路徑</p>
            {recentPaths.map(p => (
              <button
                key={p}
                onClick={() => handlePathChange(p)}
                className="block w-full text-left text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm truncate"
              >
                · {p}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
