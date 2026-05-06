import { useEffect, useRef } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import { onTerminalOutput, emitTerminalResize, emitTerminalInput } from '../socket'
import { useStore } from '../store'

const XTERM_DARK = { background: '#0d1117', foreground: '#c9d1d9' }
const XTERM_LIGHT = { background: '#ffffff', foreground: '#1e1e1e' }

export default function TerminalPanel() {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const isDriver = useStore((s) => s.isDriver())
  const activeWorkspaceTab = useStore((s) => s.activeWorkspaceTab)
  const theme = useStore((s) => s.theme)
  const fontSize = useStore((s) => s.fontSize)

  useEffect(() => {
    if (!containerRef.current) return

    const term = new Terminal({
      scrollback: 1000,
      disableStdin: !isDriver,
      theme: theme === 'dark' ? XTERM_DARK : XTERM_LIGHT,
      fontSize,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    })
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(containerRef.current)
    fitAddon.fit()

    termRef.current = term
    fitAddonRef.current = fitAddon

    let inputDispose: { dispose: () => void } | null = null
    if (isDriver) {
      inputDispose = term.onData((data) => emitTerminalInput(data))
    }

    const unsubscribe = onTerminalOutput((data) => term.write(data))

    const ro = new ResizeObserver(() => {
      fitAddon.fit()
      const { cols, rows } = term
      emitTerminalResize(cols, rows)
    })
    ro.observe(containerRef.current)

    return () => {
      inputDispose?.dispose()
      unsubscribe()
      ro.disconnect()
      term.dispose()
    }
  }, [isDriver, theme, fontSize])

  useEffect(() => {
    if (termRef.current && fitAddonRef.current) {
      termRef.current.options.fontSize = fontSize
      fitAddonRef.current.fit()
    }
  }, [fontSize])

  useEffect(() => {
    if (activeWorkspaceTab === 'agent-output' && fitAddonRef.current) {
      fitAddonRef.current.fit()
    }
  }, [activeWorkspaceTab])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="bg-gray-200 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700 px-3 py-1 text-gray-500 text-xs">
        Agent Output{isDriver && <span className="ml-2 text-yellow-600 dark:text-yellow-500">• interactive</span>}
      </div>
      <div
        ref={containerRef}
        className={`flex-1 min-h-0 p-2 ${theme === 'dark' ? 'bg-[#0d1117]' : 'bg-white'}`}
      />
    </div>
  )
}
