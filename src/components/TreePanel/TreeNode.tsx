import { memo, useState } from 'react'
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileText,
  File,
  Loader2,
} from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { tauriApi } from '../../lib/tauriApi'
import type { FileNode } from '../../lib/tauriApi'

interface TreeNodeProps {
  node: FileNode
  depth: number
}

export const TreeNode = memo(function TreeNode({ node, depth }: TreeNodeProps) {
  const selectedFile = useAppStore((s) => s.selectedFile)
  const expandedDirs = useAppStore((s) => s.expandedDirs)
  const toggleExpandedDir = useAppStore((s) => s.toggleExpandedDir)
  const setSelectedFile = useAppStore((s) => s.setSelectedFile)
  const updateDirChildren = useAppStore((s) => s.updateDirChildren)
  const [isLoadingChildren, setIsLoadingChildren] = useState(false)

  const isExpanded = expandedDirs.has(node.path)
  const isSelected = selectedFile === node.path
  const indent = depth * 16

  const handleClick = () => {
    if (node.is_dir) {
      // 展開しようとしていて、まだ子が読み込まれていない場合にロード
      if (!isExpanded && node.children === null) {
        setIsLoadingChildren(true)
        tauriApi
          .readDir(node.path)
          .then((children) => updateDirChildren(node.path, children))
          .catch(console.error)
          .finally(() => setIsLoadingChildren(false))
      }
      toggleExpandedDir(node.path)
    } else {
      setSelectedFile(node.path)
    }
  }

  const FileIcon = () => {
    if (node.is_dir) {
      if (isLoadingChildren) return <Loader2 size={14} className="shrink-0 animate-spin text-[var(--color-text-muted)]" />
      return isExpanded
        ? <FolderOpen size={14} className="shrink-0 text-[var(--color-accent)]" />
        : <Folder size={14} className="shrink-0 text-[var(--color-text-muted)]" />
    }
    const isText = /\.(md|mdx|txt|ts|tsx|js|jsx|rs|py|go|json|toml|yaml|yml|css|html|sql)$/.test(node.name)
    return isText
      ? <FileText size={14} className="shrink-0 text-[var(--color-text-muted)]" />
      : <File size={14} className="shrink-0 text-[var(--color-text-muted)]" />
  }

  return (
    <div>
      <div
        onClick={handleClick}
        className={[
          'flex items-center gap-1.5 h-7 pr-2 cursor-pointer select-none text-sm',
          'hover:bg-[var(--color-bg-elevated)]',
          isSelected
            ? 'bg-[var(--color-bg-elevated)] border-l-2 border-[var(--color-accent)] text-[var(--color-text-primary)]'
            : 'border-l-2 border-transparent text-[var(--color-text-primary)]',
        ].join(' ')}
        style={{ paddingLeft: `${indent + 8}px` }}
      >
        {/* 展開矢印（ディレクトリのみ） */}
        <span className="w-3 shrink-0 text-[var(--color-text-muted)]">
          {node.is_dir &&
            (isExpanded
              ? <ChevronDown size={12} />
              : <ChevronRight size={12} />)}
        </span>
        <FileIcon />
        <span className="truncate">{node.name}</span>
      </div>

      {/* 子ノード（展開時のみ） */}
      {node.is_dir && isExpanded && node.children?.map((child) => (
        <TreeNode key={child.path} node={child} depth={depth + 1} />
      ))}
    </div>
  )
})
