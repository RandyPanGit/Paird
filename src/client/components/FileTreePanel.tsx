import { useEffect, useState } from 'react'
import { getSocket } from '../socket'
import { useStore } from '../store'
import type { FsNode } from '../../shared/types'

interface TreeNode extends FsNode {
  children?: TreeNode[]
  expanded?: boolean
}

function buildTree(nodes: FsNode[]): TreeNode[] {
  return nodes.map(n => ({ ...n }))
}

export default function FileTreePanel() {
  const projectPath = useStore((state) => state.projectPath)
  const openFileTab = useStore((state) => state.openFileTab)
  const [roots, setRoots] = useState<TreeNode[]>([])

  useEffect(() => {
    if (!projectPath) return
    getSocket().emit('fs:read-dir', { path: projectPath }, (result: FsNode[] | { error: string }) => {
      if (!Array.isArray(result)) return
      setRoots(buildTree(result))
    })
  }, [projectPath])

  function toggleDir(node: TreeNode, siblings: TreeNode[], setSiblings: (nodes: TreeNode[]) => void): void {
    if (node.expanded) {
      setSiblings(siblings.map(n => n.path === node.path ? { ...n, expanded: false, children: undefined } : n))
      return
    }
    getSocket().emit('fs:read-dir', { path: node.path }, (result: FsNode[] | { error: string }) => {
      if (!Array.isArray(result)) return
      setSiblings(siblings.map(n =>
        n.path === node.path ? { ...n, expanded: true, children: buildTree(result) } : n
      ))
    })
  }

  function handleFileClick(node: TreeNode): void {
    getSocket().emit('fs:read-file', { path: node.path }, (result: { content: string } | { error: string }) => {
      if ('error' in result) return
      openFileTab({ path: node.path, content: result.content })
    })
  }

  function renderNodes(nodes: TreeNode[], depth: number, setSiblings: (nodes: TreeNode[]) => void): React.ReactNode {
    return nodes.map(node => (
      <div key={node.path}>
        <button
          type="button"
          className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-xs hover:bg-gray-200 dark:hover:bg-gray-800 truncate"
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
          onClick={() => {
            if (node.type === 'dir') toggleDir(node, nodes, setSiblings)
            else handleFileClick(node)
          }}
        >
          <span className="shrink-0 text-gray-400">
            {node.type === 'dir' ? (node.expanded ? '▾' : '▸') : '·'}
          </span>
          <span className="truncate text-gray-700 dark:text-gray-300">{node.name}</span>
        </button>
        {node.type === 'dir' && node.expanded && node.children && (
          renderNodes(node.children, depth + 1, (updated) => {
            setSiblings(nodes.map(n => n.path === node.path ? { ...n, children: updated } : n))
          })
        )}
      </div>
    ))
  }

  if (!projectPath) return null

  return (
    <section className="flex min-h-0 flex-col rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-900">
      <div className="border-b border-gray-200 dark:border-gray-800 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white">Files</div>
      <div className="overflow-y-auto flex-1 p-3">
        {renderNodes(roots, 0, setRoots)}
      </div>
    </section>
  )
}
