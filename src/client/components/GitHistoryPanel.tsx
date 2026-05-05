import { useEffect, useState } from 'react'
import GitHistoryCard from './GitHistoryCard'
import { useStore } from '../store'

export default function GitHistoryPanel() {
  const gitHistory = useStore((state) => state.gitHistory)
  const theme = useStore((state) => state.theme)
  const [expandedIds, setExpandedIds] = useState<string[]>(() =>
    gitHistory.length > 0 ? [gitHistory[0].id] : [],
  )

  useEffect(() => {
    if (gitHistory.length === 0) {
      setExpandedIds([])
      return
    }

    const newestId = gitHistory[0].id
    setExpandedIds((current) => (current.includes(newestId) ? current : [newestId, ...current]))
  }, [gitHistory])

  function toggleExpanded(id: string): void {
    setExpandedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    )
  }

  const bgClass = theme === 'dark' ? 'bg-[#0d1117]' : 'bg-gray-50'

  if (gitHistory.length === 0) {
    return (
      <div className={`flex flex-1 items-center justify-center rounded-b-lg ${bgClass} p-6 text-sm text-gray-500`}>
        Run Git Log to view commit history here.
      </div>
    )
  }

  return (
    <div className={`flex flex-1 flex-col gap-3 overflow-y-auto rounded-b-lg ${bgClass} p-3`}>
      {gitHistory.map((item) => (
        <GitHistoryCard
          key={item.id}
          item={item}
          expanded={expandedIds.includes(item.id)}
          onToggle={() => toggleExpanded(item.id)}
        />
      ))}
    </div>
  )
}
