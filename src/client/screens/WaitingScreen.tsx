import { useStore } from '../store'

export default function WaitingScreen() {
  const { users, driverId } = useStore()
  const driver = users.find(u => u.socketId === driverId)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-8 w-full max-w-sm space-y-5 text-center">
        <div className="text-4xl animate-pulse">⏳</div>
        <p className="text-gray-900 dark:text-white text-lg">等待 driver 設定 project...</p>
        {driver && (
          <p className="text-gray-500 dark:text-gray-400 text-sm">Driver：{driver.name}</p>
        )}
        <div className="space-y-1">
          <p className="text-gray-400 dark:text-gray-500 text-xs">線上使用者</p>
          {users.map(u => (
            <div key={u.socketId} className="flex items-center justify-center gap-2 text-sm">
              <span className={u.isDriver ? 'text-yellow-500 dark:text-yellow-400' : 'text-gray-700 dark:text-gray-300'}>{u.name}</span>
              {u.isDriver && <span className="text-yellow-500 dark:text-yellow-400 text-xs">(driver)</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
