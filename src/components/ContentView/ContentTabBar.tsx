import { useCallback } from 'react'
import { X, Columns2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ContentTab } from '../../stores/contentStore'
import { useContentStore } from '../../stores/contentStore'
import { useTabDndStore } from '../../stores/tabDndStore'
import { ContentTabContextMenu } from './ContentTabContextMenu'

const DRAG_MIME = 'application/x-sddesk-tab'

interface ContentTabBarProps {
  tabs: ContentTab[]
  activeTabId: string
  pane: 'primary' | 'secondary'
  isFocused?: boolean
  onTabClick: (id: string) => void
  onTabClose: (id: string, pane: 'primary' | 'secondary') => void
  onTabMove: (tabId: string, fromPane: 'primary' | 'secondary', toPane: 'primary' | 'secondary') => void
  splitEnabled?: boolean
  onToggleSplit?: () => void
}

export function ContentTabBar({
  tabs,
  activeTabId,
  pane,
  isFocused,
  onTabClick,
  onTabClose,
  onTabMove,
  splitEnabled,
  onToggleSplit,
}: ContentTabBarProps) {
  const { t } = useTranslation()
  const closeAllTabs = useContentStore((s) => s.closeAllTabs)
  const closeOtherTabs = useContentStore((s) => s.closeOtherTabs)
  const closeTabsToRight = useContentStore((s) => s.closeTabsToRight)
  // Tauri 環境では HTML5 dragover/drop が JS に届かないため、実際のドロップ判定は
  // TabDndCoordinator 側で onDragDropEvent を受けて行う。ここではハイライト表示のみ購読する。
  const isDragOver = useTabDndStore(
    (s) => s.hover?.kind === 'content' && s.hover.pane === pane,
  )

  const handleDragStart = useCallback((e: React.DragEvent, tabId: string) => {
    // 非 Tauri 環境（または fallback）用に data も設定する
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify({ tabId, pane }))
    e.dataTransfer.effectAllowed = 'move'
    useTabDndStore.getState().startDrag({ kind: 'content', tabId, fromPane: pane })
  }, [pane])

  // HTML5 の dragover/drop は Tauri の dragDropEnabled=true では発火しないが、
  // 非 Tauri 環境ではこれが fallback になる。
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes(DRAG_MIME)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const raw = e.dataTransfer.getData(DRAG_MIME)
    try {
      const { tabId, pane: fromPane } = JSON.parse(raw)
      if (fromPane !== pane) {
        onTabMove(tabId, fromPane, pane)
      }
    } catch {
      // ignore invalid drag data
    }
  }, [pane, onTabMove])

  return (
    <div
      data-tab-drop-kind="content"
      data-tab-drop-pane={pane}
      className="flex items-center h-8 flex-shrink-0 transition-colors"
      style={{
        background: isDragOver
          ? 'color-mix(in srgb, var(--color-accent) 15%, var(--color-bg-elevated))'
          : 'var(--color-bg-elevated)',
        borderBottom: `1px solid ${isDragOver ? 'var(--color-accent)' : isFocused ? 'var(--color-accent)' : 'var(--color-border)'}`,
      }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="flex items-center flex-1 overflow-x-auto min-w-0">
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTabId
          const label = tab.filePath
            ? (tab.filePath.split('/').pop() ?? tab.filePath)
            : t('content.newTab')
          const canClose = tabs.length > 1
          const canCloseOthers = tabs.length > 1
          const canCloseToRight = index < tabs.length - 1
          return (
            <ContentTabContextMenu
              key={tab.id}
              canClose={canClose}
              canCloseOthers={canCloseOthers}
              canCloseToRight={canCloseToRight}
              onClose={() => onTabClose(tab.id, pane)}
              onCloseToRight={() => closeTabsToRight(tab.id, pane)}
              onCloseOthers={() => closeOtherTabs(tab.id, pane)}
              onCloseAll={() => closeAllTabs(pane)}
            >
              <button
                draggable
                onDragStart={(e) => handleDragStart(e, tab.id)}
                onClick={() => onTabClick(tab.id)}
                className="flex items-center gap-1.5 h-full px-3 text-xs flex-shrink-0 transition-colors outline-none group cursor-grab active:cursor-grabbing"
                style={{
                  color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                  borderBottom: isActive
                    ? '2px solid var(--color-accent)'
                    : '2px solid transparent',
                }}
              >
                <span className="max-w-[140px] truncate">{label}</span>
                {canClose && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation()
                      onTabClose(tab.id, pane)
                    }}
                    className="flex items-center justify-center w-4 h-4 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10 cursor-default"
                  >
                    <X size={10} />
                  </span>
                )}
              </button>
            </ContentTabContextMenu>
          )
        })}
      </div>

      {onToggleSplit && (
        <button
          onClick={onToggleSplit}
          title={t('content.tooltip.split')}
          className="flex items-center justify-center w-7 h-7 rounded transition-colors outline-none hover:bg-white/10 flex-shrink-0 mr-1"
          style={{ color: splitEnabled ? 'var(--color-accent)' : 'var(--color-text-muted)' }}
        >
          <Columns2 size={13} />
        </button>
      )}
    </div>
  )
}
