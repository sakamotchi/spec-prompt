import { memo, useCallback, useState } from 'react'
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
import { InlineInput } from './InlineInput'
import { DeleteDialog } from './DeleteDialog'

interface TreeNodeProps {
  node: FileNode
  depth: number
}

function parentDir(path: string): string {
  return path.split('/').slice(0, -1).join('/')
}

export const TreeNode = memo(function TreeNode({ node, depth }: TreeNodeProps) {
  const selectedFile = useAppStore((s) => s.selectedFile)
  const expandedDirs = useAppStore((s) => s.expandedDirs)
  const selectedFiles = useAppStore((s) => s.selectedFiles)
  const editingState = useAppStore((s) => s.editingState)
  const creatingState = useAppStore((s) => s.creatingState)
  const toggleExpandedDir = useAppStore((s) => s.toggleExpandedDir)
  const setSelectedFile = useAppStore((s) => s.setSelectedFile)
  const updateDirChildren = useAppStore((s) => s.updateDirChildren)
  const toggleFileSelection = useAppStore((s) => s.toggleFileSelection)
  const clearFileSelection = useAppStore((s) => s.clearFileSelection)
  const setEditingState = useAppStore((s) => s.setEditingState)
  const setCreatingState = useAppStore((s) => s.setCreatingState)
  const openFile = useContentStore((s) => s.openFile)
  const closeTabByPath = useContentStore((s) => s.closeTabByPath)
  const renameTabPath = useContentStore((s) => s.renameTabPath)
  const { insertPath } = usePathInsertion()

  const [isLoadingChildren, setIsLoadingChildren] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const isExpanded = expandedDirs.has(node.path)
  const isSelected = selectedFile === node.path
  const isMultiSelected = selectedFiles.includes(node.path)
  const isEditing = editingState?.path === node.path
  const indent = depth * 16

  const reloadDir = useCallback(
    async (dirPath: string) => {
      try {
        const children = await tauriApi.readDir(dirPath)
        updateDirChildren(dirPath, children)
      } catch (e) {
        console.error(e)
      }
    },
    [updateDirChildren],
  )

  const handleClick = (e: React.MouseEvent) => {
    if (isEditing) return

    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      if (e.shiftKey) {
        toggleFileSelection(node.path)
      } else if (selectedFiles.length > 0) {
        toggleFileSelection(node.path)
      } else {
        insertPath(node.path)
      }
      return
    }

    if (e.shiftKey) {
      toggleFileSelection(node.path)
      return
    }

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'F2' && !isEditing) {
      e.preventDefault()
      setCreatingState(null)
      setEditingState({ type: 'rename', path: node.path })
    }
  }

  const ensureExpanded = useCallback(
    (dirPath: string) => {
      if (!expandedDirs.has(dirPath)) {
        tauriApi
          .readDir(dirPath)
          .then((children) => {
            updateDirChildren(dirPath, children)
            toggleExpandedDir(dirPath)
          })
          .catch(console.error)
      }
    },
    [expandedDirs, updateDirChildren, toggleExpandedDir],
  )

  const handleNewFile = () => {
    setEditingState(null)
    const parentPath = node.is_dir ? node.path : parentDir(node.path)
    ensureExpanded(parentPath)
    setCreatingState({ type: 'create', parentPath, nodeType: 'file' })
  }

  const handleNewFolder = () => {
    setEditingState(null)
    const parentPath = node.is_dir ? node.path : parentDir(node.path)
    ensureExpanded(parentPath)
    setCreatingState({ type: 'create', parentPath, nodeType: 'dir' })
  }

  const handleRename = () => {
    setCreatingState(null)
    setEditingState({ type: 'rename', path: node.path })
  }

  const handleOpenInEditor = () => {
    tauriApi.openInEditor(node.path).catch(console.error)
  }

  const handleRenameCommit = async (newName: string): Promise<string | null> => {
    const dir = parentDir(node.path)
    const newPath = `${dir}/${newName}`
    try {
      await tauriApi.renamePath(node.path, newPath)
      setEditingState(null)
      renameTabPath(node.path, newPath)
      if (selectedFile === node.path) setSelectedFile(newPath)
      await reloadDir(dir)
      return null
    } catch (e) {
      return e instanceof Error ? e.message : String(e)
    }
  }

  const handleCreateCommit = async (name: string): Promise<string | null> => {
    if (!creatingState) return null
    const newPath = `${creatingState.parentPath}/${name}`
    try {
      if (creatingState.nodeType === 'file') {
        await tauriApi.createFile(newPath)
      } else {
        await tauriApi.createDir(newPath)
      }
      setCreatingState(null)
      await reloadDir(creatingState.parentPath)
      return null
    } catch (e) {
      return e instanceof Error ? e.message : String(e)
    }
  }

  const handleDeleteConfirm = async () => {
    setDeleteDialogOpen(false)
    try {
      await tauriApi.deletePath(node.path)
      closeTabByPath(node.path)
      if (selectedFile === node.path) setSelectedFile(null)
      await reloadDir(parentDir(node.path))
    } catch (e) {
      console.error(e)
    }
  }

  // isExpanded を要求しない: 閉じたフォルダでも即座に入力欄を表示し、
  // ensureExpanded が非同期で展開したときに子ノードが上に追加される
  const showCreatingInput = node.is_dir && creatingState?.parentPath === node.path

  const FileIcon = () => {
    if (node.is_dir) {
      if (isLoadingChildren)
        return <Loader2 size={14} className="shrink-0 animate-spin text-[var(--color-text-muted)]" />
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
    <>
      <div onKeyDown={handleKeyDown} tabIndex={-1} style={{ outline: 'none' }}>
        <TreeContextMenu
          path={node.path}
          isDir={node.is_dir}
          onNewFile={handleNewFile}
          onNewFolder={handleNewFolder}
          onRename={handleRename}
          onDelete={() => setDeleteDialogOpen(true)}
          onOpenInEditor={handleOpenInEditor}
        >
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
            <span className="w-3 shrink-0 text-[var(--color-text-muted)]">
              {node.is_dir &&
                (isExpanded
                  ? <ChevronDown size={12} />
                  : <ChevronRight size={12} />)}
            </span>
            <FileIcon />
            {isEditing ? (
              <InlineInput
                defaultValue={node.name}
                depth={0}
                onCommit={handleRenameCommit}
                onCancel={() => setEditingState(null)}
              />
            ) : (
              <span className="truncate">{node.name}</span>
            )}
          </div>
        </TreeContextMenu>

        {/* 子ノード（展開時のみ） */}
        {node.is_dir && isExpanded && node.children?.map((child) => (
          <TreeNode key={child.path} node={child} depth={depth + 1} />
        ))}

        {/* 新規作成インライン入力（展開中のディレクトリの末尾） */}
        {showCreatingInput && (
          <InlineInput
            placeholder={creatingState!.nodeType === 'file' ? 'ファイル名...' : 'フォルダ名...'}
            depth={depth + 1}
            onCommit={handleCreateCommit}
            onCancel={() => setCreatingState(null)}
          />
        )}
      </div>

      <DeleteDialog
        open={deleteDialogOpen}
        name={node.name}
        isDir={node.is_dir}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </>
  )
})
