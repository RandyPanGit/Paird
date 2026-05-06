import type { GitHistoryItem } from '../../shared/types'

interface GitHistoryCardProps {
  item: GitHistoryItem
  expanded: boolean
  onToggle: () => void
}

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
}

export default function GitHistoryCard({ item, expanded, onToggle }: GitHistoryCardProps) {
  const timestamp = formatTimestamp(item.createdAt)

  return (
    <article className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={`Show details for ${item.command} from ${timestamp}`}
        className="flex w-full flex-col gap-2 px-4 py-3 text-left"
      >
        <div className="flex items-center justify-between gap-3 text-xs text-gray-500">
          <span>{timestamp}</span>
          <span className="rounded-full bg-gray-200 dark:bg-gray-800 px-2 py-0.5 uppercase tracking-wide text-gray-700 dark:text-gray-300">
            {item.kind}
          </span>
        </div>
        <p className="font-mono text-sm text-blue-600 dark:text-blue-300">{item.command}</p>
      </button>
      {expanded && (
        <pre className="overflow-x-auto border-t border-gray-200 dark:border-gray-800 px-4 py-3 text-xs text-gray-700 dark:text-gray-300">
          {item.content}
        </pre>
      )}
    </article>
  )
}
