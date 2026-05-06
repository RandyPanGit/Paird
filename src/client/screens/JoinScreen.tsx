import { useState, useEffect } from 'react'
import { connectSocket } from '../socket'
import type { ConnectionInfo } from '../../shared/types'

export default function JoinScreen() {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/connection-info')
      .then(r => r.json())
      .then((info: ConnectionInfo) => setAddress(info.defaultAddress))
      .catch(() => setAddress('http://localhost:3000'))
  }, [])

  function handleJoin() {
    if (!name.trim() || !address.trim()) return
    setLoading(true)
    connectSocket(address.trim(), name.trim())
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-8 w-full max-w-sm space-y-5">
        <h1 className="text-gray-900 dark:text-white text-2xl font-bold">🔗 Paird</h1>

        <div className="space-y-1">
          <label className="text-gray-500 dark:text-gray-400 text-sm">你的名字</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            placeholder="Alice"
            className="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="space-y-1">
          <label className="text-gray-500 dark:text-gray-400 text-sm">連線位址</label>
          <input
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="http://192.168.x.x:3000"
            className="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
          />
        </div>

        <button
          onClick={handleJoin}
          disabled={!name.trim() || !address.trim() || loading}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-400 dark:disabled:text-gray-500 text-white font-medium py-2 rounded transition-colors"
        >
          {loading ? '連線中...' : '加入 Session'}
        </button>

        <p className="text-gray-400 dark:text-gray-600 text-xs text-center">ℹ️ 內網模式，無需驗證</p>
      </div>
    </div>
  )
}
