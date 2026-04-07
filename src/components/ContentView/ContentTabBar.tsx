import { useCallback, useState } from 'react'
import { X, Columns2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ContentTab } from '../../stores/contentStore'

const DRAG_MIME = 'application/x-specprompt-tab'

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
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragStart = useCallback((e: React.DragEvent, tabId: string) => {
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify({ tabId, pane }))
    e.dataTransfer.effectAllowed = 'move'
  }, [pane])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes(DRAG_MIME)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
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
      className="flex items-center h-8 flex-shrink-0 transition-colors"
      style={{
        background: isDragOver
          ? 'color-mix(in srgb, var(--color-accent) 15%, var(--color-bg-elevated))'
          : 'var(--color-bg-elevated)',
        borderBottom: `1px solid ${isDragOver ? 'var(--color-accent)' : isFocused ? 'var(--color-accent)' : 'var(--color-border)'}`,
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex items-center flex-1 overflow-x-auto min-w-0">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId
          const label = tab.filePath
            ? (tab.filePath.split('/').pop() ?? tab.filePath)
            : t('content.newTab')
          return (
            <button
              key={tab.id}
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
              {tabs.length > 1 && (
                <span
                  onClick={(e) => {
                    e.stopPropagation()
                    onTabClose(tab.id, pane)
                  }}
                  className="flex items-center justify-center w-4 h-4 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10"
                >
                  <X size={10} />
                </span>
              )}
            </button>
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
