import { useEffect, useRef, useState } from 'react'
import { FolderOpen, Loader2, AlertCircle, Settings, SquareArrowOutUpRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { saveMySession, consolidateAndSave, clearMySession } from '../../lib/windowSession'
import { useAppStore } from '../../stores/appStore'
import { useContentStore } from '../../stores/contentStore'
import { tauriApi } from '../../lib/tauriApi'
import { useFileTree } from '../../hooks/useFileTree'
import { TreeNode } from './TreeNode'
import { InlineInput } from './InlineInput'
import { RecentProjectsMenu } from './RecentProjectsMenu'
import { SettingsModal } from '../Settings/SettingsModal'
import { ConfirmDropDialog } from './ConfirmDropDialog'
import { TreeDndProvider, useTreeDnd } from '../../hooks/useTreeDnd'
import { useTabDndStore } from '../../stores/tabDndStore'

export function TreePanel() {
  const projectRoot = useAppStore((s) => s.projectRoot)
  const fileTree = useAppStore((s) => s.fileTree)
  const recentProjects = useAppStore((s) => s.recentProjects)
  const setRecentProjects = useAppStore((s) => s.setRecentProjects)
  const switchProject = useAppStore((s) => s.switchProject)
  const setProjectRoot = useAppStore((s) => s.setProjectRoot)
  const updateDirChildren = useAppStore((s) => s.updateDirChildren)
  const dragOverPath = useAppStore((s) => s.dragOverPath)
  const setDragOverPath = useAppStore((s) => s.setDragOverPath)
  const { loading, error } = useFileTree()

  const creatingState = useAppStore((s) => s.creatingState)
  const setCreatingState = useAppStore((s) => s.setCreatingState)

  const resetAllTabs = useContentStore((s) => s.resetAllTabs)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { t } = useTranslation()

  const dnd = useTreeDnd()
  const treeAreaRef = useRef<HTMLDivElement>(null)

  const projectName = projectRoot
    ? projectRoot.split('/').pop() ?? projectRoot
    : null

  // 起動時に最近開いたプロジェクト履歴を取得
  useEffect(() => {
    tauriApi.getRecentProjects()
      .then(setRecentProjects)
      .catch(console.error)
  }, [setRecentProjects])

  // プロジェクトが変わったらウィンドウタイトルを更新
  useEffect(() => {
    const name = projectRoot?.split('/').pop() ?? null
    getCurrentWindow().setTitle(name ? `SpecPrompt — ${name}` : 'SpecPrompt').catch(console.error)
  }, [projectRoot])

  // 追加ウィンドウ・メインウィンドウ共通: projectRoot が変わったら自身のセッションを更新
  useEffect(() => {
    const win = getCurrentWindow()
    saveMySession(win.label, projectRoot)
  }, [projectRoot])

  // ウィンドウ閉じイベント: セッション情報を更新
  useEffect(() => {
    const win = getCurrentWindow()
    let unlisten: (() => void) | null = null
    win.onCloseRequested(() => {
      if (win.label === 'main') {
        // メインウィンドウが閉じるとき: 生きている追加ウィンドウを統合保存
        // （追加ウィンドウが先に閉じても per-window キーは残るので正しく取れる）
        consolidateAndSave()
      } else {
        // 追加ウィンドウが明示的に閉じられたとき、自身のセッションを削除する
        // これを行わないと、強制終了時の拾い上げによる復元時に、手動で閉じたウィンドウまで復活してしまう
        clearMySession(win.label)
      }
    }).then((fn) => { unlisten = fn }).catch(console.error)
    return () => { unlisten?.() }
  }, [])

  // ルート直下への新規作成
  const showRootCreatingInput =
    projectRoot !== null && creatingState?.parentPath === projectRoot

  const handleRootCreateCommit = async (name: string): Promise<string | null> => {
    if (!creatingState || !projectRoot) return null
    const newPath = `${projectRoot}/${name}`
    try {
      if (creatingState.nodeType === 'file') {
        await tauriApi.createFile(newPath)
      } else {
        await tauriApi.createDir(newPath)
      }
      setCreatingState(null)
      const children = await tauriApi.readDir(projectRoot)
      updateDirChildren(projectRoot, children)
      return null
    } catch (e) {
      return e instanceof Error ? e.message : String(e)
    }
  }

  const handleOpen = async () => {
    const selected = await tauriApi.openFolderDialog()
    if (selected) {
      setProjectRoot(selected)
      tauriApi.addRecentProject(selected)
        .then(() => tauriApi.getRecentProjects())
        .then(setRecentProjects)
        .catch(console.error)
    }
  }

  const handleSelectRecent = async (path: string) => {
    switchProject(path)
    resetAllTabs()
    tauriApi.addRecentProject(path)
      .then(() => tauriApi.getRecentProjects())
      .then(setRecentProjects)
      .catch(console.error)
  }

  // ルート領域（ツリー余白）への内部 DnD
  const handleRootDragOver = (e: React.DragEvent) => {
    if (!projectRoot) return
    const internalPaths = useAppStore.getState().internalDragPaths
    if (internalPaths.length === 0) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverPath !== projectRoot) setDragOverPath(projectRoot)
  }

  const handleRootDrop = (e: React.DragEvent) => {
    if (!projectRoot) return
    const internalPaths = useAppStore.getState().internalDragPaths
    if (internalPaths.length === 0) return
    e.preventDefault()
    setDragOverPath(null)
    useAppStore.getState().setInternalDragPaths([])
    dnd.handleInternalDrop(internalPaths, projectRoot)
  }

  // DnD（内部ツリー移動・外部 Finder コピー）。
  // macOS Tauri では dragDropEnabled=true によって dragover/drop が JS に届かないため、
  // Tauri の onDragDropEvent 経由で target を検出する。
  // 内部/外部の判別は appStore.internalDragPaths の有無で行う。
  useEffect(() => {
    let unlisten: (() => void) | null = null
    let disposed = false

    // onDragDropEvent の position は macOS では CSS ピクセル、他環境では physical のことがあるため
    // 両方の解釈で elementFromPoint を試し、先にヒットしたほうを採用する
    const findDestDir = (px: number, py: number): string | null => {
      const root = useAppStore.getState().projectRoot
      if (!root) return null
      const dpr = window.devicePixelRatio || 1
      const candidates = [
        { x: px, y: py },
        { x: px / dpr, y: py / dpr },
      ]
      for (const c of candidates) {
        const el = document.elementFromPoint(c.x, c.y) as HTMLElement | null
        if (!el) continue
        const node = el.closest('[data-tree-node][data-is-dir="true"]') as HTMLElement | null
        if (node) return node.getAttribute('data-path')
        if (treeAreaRef.current?.contains(el)) return root
      }
      return null
    }

    getCurrentWebview()
      .onDragDropEvent((event) => {
        // タブ間 DnD の最中はツリー側のハイライト/ドロップ判定を行わない
        if (useTabDndStore.getState().source) return
        const root = useAppStore.getState().projectRoot
        const payload = event.payload
        if (payload.type === 'over') {
          if (!root) return
          const dest = findDestDir(payload.position.x, payload.position.y)
          if (dest && useAppStore.getState().dragOverPath !== dest) {
            useAppStore.getState().setDragOverPath(dest)
          } else if (!dest && useAppStore.getState().dragOverPath !== null) {
            useAppStore.getState().setDragOverPath(null)
          }
        } else if (payload.type === 'drop') {
          const state = useAppStore.getState()
          state.setDragOverPath(null)
          if (!root) {
            state.setInternalDragPaths([])
            return
          }
          const internalPaths = state.internalDragPaths
          const dest = findDestDir(payload.position.x, payload.position.y)
          // 内部ドラッグ中なら内部移動として処理
          if (internalPaths.length > 0) {
            state.setInternalDragPaths([])
            if (dest) dnd.handleInternalDrop(internalPaths, dest)
            return
          }
          // 外部ドラッグ（Finder からのファイル）
          if (!dest) return
          if (!payload.paths || payload.paths.length === 0) return
          dnd.handleExternalDrop(payload.paths, dest)
        } else if (payload.type === 'leave') {
          useAppStore.getState().setDragOverPath(null)
        }
      })
      .then((fn) => {
        if (disposed) fn()
        else unlisten = fn
      })
      .catch(console.error)

    return () => {
      disposed = true
      if (unlisten) unlisten()
    }
  }, [dnd])

  return (
    <TreeDndProvider value={dnd}>
    <div
      data-panel="tree"
      tabIndex={-1}
      className="flex flex-col h-full bg-[var(--color-bg-panel)] border-r border-[var(--color-border)] outline-none"
    >
      {/* ヘッダー */}
      <div className="flex items-center justify-between h-9 px-3 shrink-0 border-b border-[var(--color-border)]">
        <RecentProjectsMenu
          projectName={projectName}
          recentProjects={recentProjects}
          currentProject={projectRoot}
          onSelect={handleSelectRecent}
        />
        <div className="flex items-center gap-1">
          <button
            onClick={handleOpen}
            title={t('tree.tooltip.openProject')}
            className="p-1 rounded hover:bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <FolderOpen size={14} />
          </button>
          <button
            onClick={() => tauriApi.openNewWindow()}
            title={t('tree.tooltip.newWindow')}
            className="p-1 rounded hover:bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <SquareArrowOutUpRight size={14} />
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            title={t('tree.tooltip.settings')}
            className="p-1 rounded hover:bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <Settings size={14} />
          </button>
        </div>
      </div>
      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />

      {/* ツリーエリア */}
      <div
        ref={treeAreaRef}
        className={[
          'flex-1 overflow-y-auto min-h-0',
          projectRoot && dragOverPath === projectRoot
            ? 'bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)]'
            : '',
        ].join(' ')}
        onDragOver={handleRootDragOver}
        onDrop={handleRootDrop}
      >
        {loading && (
          <div className="flex items-center justify-center h-16 gap-2 text-[var(--color-text-muted)] text-xs">
            <Loader2 size={14} className="animate-spin" />
            {t('tree.loading')}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 m-2 p-2 rounded text-xs text-red-400 bg-red-950/30">
            <AlertCircle size={14} className="shrink-0" />
            <span className="break-all">{error}</span>
          </div>
        )}

        {!loading && !error && !projectRoot && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-[var(--color-text-muted)] text-xs px-4 text-center">
            <FolderOpen size={24} className="opacity-40" />
            <span>{t('tree.emptyState')}</span>
          </div>
        )}

        {!loading && !error && fileTree.map((node) => (
          <TreeNode key={node.path} node={node} depth={0} />
        ))}

        {/* ルート直下への新規作成インライン入力 */}
        {showRootCreatingInput && (
          <InlineInput
            placeholder={creatingState!.nodeType === 'file' ? t('tree.placeholder.file') : t('tree.placeholder.folder')}
            depth={0}
            onCommit={handleRootCreateCommit}
            onCancel={() => setCreatingState(null)}
          />
        )}
      </div>

      <ConfirmDropDialog
        open={dnd.pendingConfirm !== null}
        operation={dnd.pendingConfirm?.operation ?? 'move'}
        count={dnd.pendingConfirm?.count ?? 0}
        destDir={dnd.pendingConfirm?.destDir ?? ''}
        onConfirm={() => {
          void dnd.confirmPending()
        }}
        onCancel={dnd.cancelPending}
      />
    </div>
    </TreeDndProvider>
  )
}
