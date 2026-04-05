import { useEffect, useState } from 'react'
import { FolderOpen, Loader2, AlertCircle, Settings } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { useContentStore } from '../../stores/contentStore'
import { tauriApi } from '../../lib/tauriApi'
import { useFileTree } from '../../hooks/useFileTree'
import { TreeNode } from './TreeNode'
import { InlineInput } from './InlineInput'
import { RecentProjectsMenu } from './RecentProjectsMenu'
import { SettingsModal } from '../Settings/SettingsModal'

export function TreePanel() {
  const projectRoot = useAppStore((s) => s.projectRoot)
  const fileTree = useAppStore((s) => s.fileTree)
  const recentProjects = useAppStore((s) => s.recentProjects)
  const setRecentProjects = useAppStore((s) => s.setRecentProjects)
  const switchProject = useAppStore((s) => s.switchProject)
  const setProjectRoot = useAppStore((s) => s.setProjectRoot)
  const updateDirChildren = useAppStore((s) => s.updateDirChildren)
  const { loading, error } = useFileTree()

  const creatingState = useAppStore((s) => s.creatingState)
  const setCreatingState = useAppStore((s) => s.setCreatingState)

  const resetAllTabs = useContentStore((s) => s.resetAllTabs)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const projectName = projectRoot
    ? projectRoot.split('/').pop() ?? projectRoot
    : null

  // 起動時に最近開いたプロジェクト履歴を取得
  useEffect(() => {
    tauriApi.getRecentProjects()
      .then(setRecentProjects)
      .catch(console.error)
  }, [setRecentProjects])

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

  return (
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
            title="プロジェクトを開く"
            className="p-1 rounded hover:bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <FolderOpen size={14} />
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            title="設定"
            className="p-1 rounded hover:bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <Settings size={14} />
          </button>
        </div>
      </div>
      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />

      {/* ツリーエリア */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading && (
          <div className="flex items-center justify-center h-16 gap-2 text-[var(--color-text-muted)] text-xs">
            <Loader2 size={14} className="animate-spin" />
            読み込み中...
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
            <span>フォルダを開いてください</span>
          </div>
        )}

        {!loading && !error && fileTree.map((node) => (
          <TreeNode key={node.path} node={node} depth={0} />
        ))}

        {/* ルート直下への新規作成インライン入力 */}
        {showRootCreatingInput && (
          <InlineInput
            placeholder={creatingState!.nodeType === 'file' ? 'ファイル名...' : 'フォルダ名...'}
            depth={0}
            onCommit={handleRootCreateCommit}
            onCancel={() => setCreatingState(null)}
          />
        )}
      </div>
    </div>
  )
}
