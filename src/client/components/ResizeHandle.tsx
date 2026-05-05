import { PanelResizeHandle } from 'react-resizable-panels'

export default function ResizeHandle() {
  return (
    <PanelResizeHandle className="group flex w-2 items-center justify-center bg-gray-100 dark:bg-gray-900 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors cursor-col-resize">
      <div className="flex flex-col gap-1">
        <div className="h-1 w-1 rounded-full bg-gray-400 dark:bg-gray-600 group-hover:bg-gray-600 dark:group-hover:bg-gray-400 transition-colors" />
        <div className="h-1 w-1 rounded-full bg-gray-400 dark:bg-gray-600 group-hover:bg-gray-600 dark:group-hover:bg-gray-400 transition-colors" />
        <div className="h-1 w-1 rounded-full bg-gray-400 dark:bg-gray-600 group-hover:bg-gray-600 dark:group-hover:bg-gray-400 transition-colors" />
      </div>
    </PanelResizeHandle>
  )
}
