import { FolderOpen } from 'lucide-react'
import { SplitPane } from '../SplitPane'
import { MainArea } from '../MainArea'

function TreePanelPlaceholder() {
  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-panel)] border-r border-[var(--color-border)]">
      <div className="flex items-center gap-2 h-9 px-3 flex-shrink-0 border-b border-[var(--color-border)]">
        <FolderOpen size={14} className="text-[var(--color-text-muted)]" />
        <span className="text-xs text-[var(--color-text-muted)]">プロジェクト</span>
      </div>
      <div className="flex items-center justify-center flex-1 text-[var(--color-text-muted)] text-xs">
        Phase 1-B で実装
      </div>
    </div>
  )
}

export function AppLayout() {
  return (
    <div className="flex h-full w-full bg-[var(--color-bg-base)]">
      <SplitPane direction="horizontal" defaultSize={240} minSize={160} maxSize={480}>
        <TreePanelPlaceholder />
        <MainArea />
      </SplitPane>
    </div>
  )
}
