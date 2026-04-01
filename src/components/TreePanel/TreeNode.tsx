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
import { useContentStore } from '../../stores/contentStore'
import { usePathInsertion } from '../../hooks/usePathInsertion'
import { tauriApi } from '../../lib/tauriApi'
import type { FileNode } from '../../lib/tauriApi'
import { TreeContextMenu } from './ContextMenu'

interface TreeNodeProps {
  node: FileNode
  depth: number
}

export const TreeNode = memo(function TreeNode({ node, depth }: TreeNodeProps) {
  const selectedFile = useAppStore((s) => s.selectedFile)
  const expandedDirs = useAppStore((s) => s.expandedDirs)
  const selectedFiles = useAppStore((s) => s.selectedFiles)
  const toggleExpandedDir = useAppStore((s) => s.toggleExpandedDir)
  const setSelectedFile = useAppStore((s) => s.setSelectedFile)
  const updateDirChildren = useAppStore((s) => s.updateDirChildren)
  const toggleFileSelection = useAppStore((s) => s.toggleFileSelection)
  const clearFileSelection = useAppStore((s) => s.clearFileSelection)
  const openFile = useContentStore((s) => s.openFile)
  const { insertPath } = usePathInsertion()

  const [isLoadingChildren, setIsLoadingChildren] = useState(false)

  const isExpanded = expandedDirs.has(node.path)
  const isSelected = selectedFile === node.path
  const isMultiSelected = selectedFiles.includes(node.path)
  const indent = depth * 16

  const handleClick = (e: React.MouseEvent) => {
    // Ctrl/Cmd+クリック: パス挿入 or 複数選択
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      if (e.shiftKey) {
        // Ctrl+Shift: 複数選択に追加
        toggleFileSelection(node.path)
      } else if (selectedFiles.length > 0) {
        // Ctrl 単体: 複数選択モードなら追加、そうでなければパス挿入
        toggleFileSelection(node.path)
      } else {
        // 通常の Ctrl+クリック: パス挿入
        insertPath(node.path)
      }
      return
    }

    // Shift+クリック: 複数選択に追加
    if (e.shiftKey) {
      toggleFileSelection(node.path)
      return
    }

    // 通常クリック
    clearFileSelection()

    if (node.is_dir) {
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
      openFile(node.path)
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
      <TreeContextMenu path={node.path}>
        <div
          onClick={handleClick}
          className={[
            'flex items-center gap-1.5 h-7 pr-2 cursor-pointer select-none text-sm',
            'hover:bg-[var(--color-bg-elevated)]',
            isMultiSelected
              ? 'bg-[color-mix(in_srgb,var(--color-accent)_20%,transparent)] border-l-2 border-[var(--color-accent)] text-[var(--color-text-primary)]'
              : isSelected
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
      </TreeContextMenu>

      {/* 子ノード（展開時のみ） */}
      {node.is_dir && isExpanded && node.children?.map((child) => (
        <TreeNode key={child.path} node={child} depth={depth + 1} />
      ))}
    </div>
  )
})
