import { useRef, useState } from 'react'
import { Panel, PanelGroup } from 'react-resizable-panels'
import Header from '../components/Header'
import AgentControlBar from '../components/AgentControlBar'
import WorkspaceTabs from '../components/WorkspaceTabs'
import ChatPanel from '../components/ChatPanel'
import FileTreePanel from '../components/FileTreePanel'
import ResizeHandle from '../components/ResizeHandle'
import type { ImperativePanelHandle } from 'react-resizable-panels'

export default function MainScreen() {
  const leftPanelRef = useRef<ImperativePanelHandle>(null)
  const rightPanelRef = useRef<ImperativePanelHandle>(null)
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white">
      <Header />
      <AgentControlBar />
      <div className="flex flex-1 min-h-0 p-2 gap-2">
        <PanelGroup direction="horizontal">
          {leftCollapsed && (
            <button
              onClick={() => leftPanelRef.current?.expand()}
              className="flex w-5 items-center justify-center bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
              aria-label="展開左側面板"
            >
              ›
            </button>
          )}

          <Panel
            ref={leftPanelRef}
            defaultSize={20}
            minSize={15}
            collapsible
            onCollapse={() => setLeftCollapsed(true)}
            onExpand={() => setLeftCollapsed(false)}
          >
            <aside className="flex h-full flex-col gap-4 p-4 overflow-hidden">
              <div className="flex justify-end">
                <button
                  onClick={() => leftPanelRef.current?.collapse()}
                  className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white px-1"
                  aria-label="收合左側面板"
                >
                  ‹
                </button>
              </div>
              <FileTreePanel />
            </aside>
          </Panel>

          <ResizeHandle />

          <Panel minSize={30}>
            <main className="flex h-full flex-col rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
              <WorkspaceTabs />
            </main>
          </Panel>

          <ResizeHandle />

          <Panel
            ref={rightPanelRef}
            defaultSize={25}
            minSize={15}
            collapsible
            onCollapse={() => setRightCollapsed(true)}
            onExpand={() => setRightCollapsed(false)}
          >
            <aside className="flex h-full flex-col rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
              <div className="flex justify-start px-2 py-1">
                <button
                  onClick={() => rightPanelRef.current?.collapse()}
                  className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white px-1"
                  aria-label="收合右側面板"
                >
                  ›
                </button>
              </div>
              <ChatPanel />
            </aside>
          </Panel>

          {rightCollapsed && (
            <button
              onClick={() => rightPanelRef.current?.expand()}
              className="flex w-5 items-center justify-center bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
              aria-label="展開右側面板"
            >
              ‹
            </button>
          )}
        </PanelGroup>
      </div>
    </div>
  )
}
