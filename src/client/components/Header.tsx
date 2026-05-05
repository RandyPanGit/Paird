import { useStore } from '../store'

export default function Header() {
  const { users, projectName, agentStatus, theme, toggleTheme, fontSize, setFontSize } = useStore()
  const driver = users.find((user) => user.isDriver)

  return (
    <header className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="text-lg font-bold text-gray-900 dark:text-white">Paird</span>
        <span className="text-sm text-gray-400 dark:text-gray-500">/</span>
        <span className="font-mono text-sm text-green-600 dark:text-green-400">{projectName ?? 'no-project'}</span>
        <span className="rounded-full bg-gray-200 dark:bg-gray-800 px-2 py-0.5 text-xs text-gray-700 dark:text-gray-300">{agentStatus}</span>
      </div>
      <div className="flex items-center gap-2">
        {driver && <span className="rounded-full bg-yellow-100 dark:bg-yellow-700 px-2 py-0.5 text-xs text-yellow-800 dark:text-white">{driver.name} • driver</span>}
        {users.filter((user) => !user.isDriver).map((user) => (
          <span key={user.socketId} className="rounded-full bg-gray-200 dark:bg-gray-800 px-2 py-0.5 text-xs text-gray-700 dark:text-gray-300">
            {user.name}
          </span>
        ))}
        <span className="ml-1 text-xs text-gray-500">{users.length} online</span>
        <label className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          字體
          <input
            type="range"
            aria-label="font size"
            min={10}
            max={20}
            step={1}
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="w-20 accent-blue-500"
          />
          <span className="min-w-[2.5rem]">{fontSize}px</span>
        </label>
        <button
          aria-label="toggle theme"
          onClick={toggleTheme}
          className="rounded bg-gray-200 dark:bg-gray-800 px-2 py-0.5 text-xs text-gray-700 dark:text-gray-300"
        >
          {theme === 'dark' ? '🌙' : '☀️'}
        </button>
      </div>
    </header>
  )
}
