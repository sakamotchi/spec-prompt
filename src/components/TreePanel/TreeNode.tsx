import { memo, useCallback, useState } from 'react'
import { ChevronRight, ChevronDown, Loader2 } from 'lucide-react'
import { Icon } from '@iconify/react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../stores/appStore'
import { useContentStore } from '../../stores/contentStore'
import { usePathInsertion } from '../../hooks/usePathInsertion'
import { tauriApi } from '../../lib/tauriApi'
import type { FileNode } from '../../lib/tauriApi'
import { TreeContextMenu } from './ContextMenu'
import { InlineInput } from './InlineInput'
import { DeleteDialog } from './DeleteDialog'
import { DOC_STATUS_COLOR } from '../../lib/frontmatter'
import { getGitColor, getGitBadge, getDirGitColor } from '../../lib/gitStatus'

const EXT_ICON_MAP: Record<string, string> = {
  md:   'vscode-icons:file-type-markdown',
  mdx:  'vscode-icons:file-type-markdown',
  ts:   'vscode-icons:file-type-typescript',
  tsx:  'vscode-icons:file-type-reactts',
  js:   'vscode-icons:file-type-js',
  jsx:  'vscode-icons:file-type-reactjs',
  rs:   'vscode-icons:file-type-rust',
  py:   'vscode-icons:file-type-python',
  go:   'vscode-icons:file-type-go',
  json: 'vscode-icons:file-type-json',
  toml: 'vscode-icons:file-type-toml',
  yaml: 'vscode-icons:file-type-yaml',
  yml:  'vscode-icons:file-type-yaml',
  css:  'vscode-icons:file-type-css',
  html: 'vscode-icons:file-type-html',
  sql:  'vscode-icons:file-type-sql',
  txt:  'vscode-icons:file-type-text',
}

const FOLDER_ICON      = 'vscode-icons:default-folder'
const FOLDER_OPEN_ICON = 'vscode-icons:default-folder-opened'
const DEFAULT_FILE_ICON = 'vscode-icons:default-file'

interface TreeNodeProps {
  node: FileNode
  depth: number
}

function parentDir(path: string): string {
  return path.split('/').slice(0, -1).join('/')
}

export const TreeNode = memo(function TreeNode({ node, depth }: TreeNodeProps) {
  const { t } = useTranslation()
  // ノード固有の値だけ購読することで、他ノードの状態変化による不要な再レンダリングを防ぐ
  const isSelected = useAppStore((s) => s.selectedFile === node.path)
  const isExpanded = useAppStore((s) => s.expandedDirs.has(node.path))
  const isMultiSelected = useAppStore((s) => s.selectedFiles.includes(node.path))
  const isEditing = useAppStore((s) => s.editingState?.path === node.path)
  const showCreatingInput = useAppStore((s) => node.is_dir && s.creatingState?.parentPath === node.path)
  const docStatus = useAppStore((s) => s.docStatuses[node.path] ?? null)
  // gitStatuses 全体ではなく計算結果（色文字列）のみを購読し、不要な再レンダリングを防ぐ
  const gitColor = useAppStore((s) =>
    node.is_dir
      ? getDirGitColor(node.path, s.gitStatuses)
      : getGitColor(s.gitStatuses[node.path])
  )
  const gitBadge = useAppStore((s) =>
    node.is_dir ? undefined : getGitBadge(s.gitStatuses[node.path])
  )

  const toggleExpandedDir = useAppStore((s) => s.toggleExpandedDir)
  const selectedFile = useAppStore((s) => s.selectedFile)
  const setSelectedFile = useAppStore((s) => s.setSelectedFile)
  const updateDirChildren = useAppStore((s) => s.updateDirChildren)
  const toggleFileSelection = useAppStore((s) => s.toggleFileSelection)
  const clearFileSelection = useAppStore((s) => s.clearFileSelection)
  const setEditingState = useAppStore((s) => s.setEditingState)
  const creatingState = useAppStore((s) => s.creatingState)
  const setCreatingState = useAppStore((s) => s.setCreatingState)
  const setActiveMainTab = useAppStore((s) => s.setActiveMainTab)
  const loadDocStatuses = useAppStore((s) => s.loadDocStatuses)
  const openFile = useContentStore((s) => s.openFile)
  const closeTabByPath = useContentStore((s) => s.closeTabByPath)
  const renameTabPath = useContentStore((s) => s.renameTabPath)
  const { insertPath } = usePathInsertion()

  const [isLoadingChildren, setIsLoadingChildren] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const indent = depth * 16

  const reloadDir = useCallback(
    async (dirPath: string) => {
      try {
        const children = await tauriApi.readDir(dirPath)
        updateDirChildren(dirPath, children)
        loadDocStatuses(children.filter((c) => !c.is_dir).map((c) => c.path))
      } catch (e) {
        console.error(e)
      }
    },
    [updateDirChildren, loadDocStatuses],
  )

  const handleClick = (e: React.MouseEvent) => {
    if (isEditing) return

    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      if (e.shiftKey) {
        toggleFileSelection(node.path)
      } else if (useAppStore.getState().selectedFiles.length > 0) {
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
          .then((children) => {
            updateDirChildren(node.path, children)
            loadDocStatuses(children.filter((c) => !c.is_dir).map((c) => c.path))
          })
          .catch(console.error)
          .finally(() => setIsLoadingChildren(false))
      }
      toggleExpandedDir(node.path)
    } else {
      setSelectedFile(node.path)
      openFile(node.path)
      setActiveMainTab('content')
      if (/\.(md|mdx)$/i.test(node.path)) {
        loadDocStatuses([node.path])
      }
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
      if (!useAppStore.getState().expandedDirs.has(dirPath)) {
        tauriApi
          .readDir(dirPath)
          .then((children) => {
            updateDirChildren(dirPath, children)
            toggleExpandedDir(dirPath)
          })
          .catch(console.error)
      }
    },
    [updateDirChildren, toggleExpandedDir],
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

  const handleOpenNewWindow = node.is_dir
    ? () => { tauriApi.openNewWindow(node.path) }
    : undefined

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

  const FileIcon = () => {
    if (node.is_dir) {
      if (isLoadingChildren)
        return <Loader2 size={14} className="shrink-0 animate-spin text-[var(--color-text-muted)]" />
      return (
        <Icon
          icon={isExpanded ? FOLDER_OPEN_ICON : FOLDER_ICON}
          width={14}
          height={14}
          className="shrink-0"
        />
      )
    }
    const ext = node.name.split('.').pop()?.toLowerCase() ?? ''
    const iconId = EXT_ICON_MAP[ext] ?? DEFAULT_FILE_ICON
    return <Icon icon={iconId} width={14} height={14} className="shrink-0" />
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
          onOpenNewWindow={handleOpenNewWindow}
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
              <>
                <span className="truncate flex-1" style={gitColor ? { color: gitColor } : undefined}>{node.name}</span>
                {gitBadge && (
                  <span
                    className="shrink-0 text-[10px] ml-1 font-mono leading-none"
                    style={{ color: gitColor }}
                  >
                    {gitBadge}
                  </span>
                )}
                {!node.is_dir && /\.(md|mdx)$/i.test(node.name) && (() => {
                  return docStatus ? (
                    <span
                      className="shrink-0 w-1.5 h-1.5 rounded-full ml-1"
                      style={{ background: DOC_STATUS_COLOR[docStatus] }}
                      title={docStatus}
                    />
                  ) : null
                })()}
              </>
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
            placeholder={creatingState!.nodeType === 'file' ? t('tree.placeholder.file') : t('tree.placeholder.folder')}
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
