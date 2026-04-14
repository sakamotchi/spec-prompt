import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus, X, Columns2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTerminalStore, computeDisplayTitle } from '../../stores/terminalStore'
import { useAppStore } from '../../stores/appStore'
import { TerminalPanel } from './TerminalPanel'

const DRAG_MIME = 'application/x-specprompt-tab'

interface TerminalPaneProps {
  pane: 'primary' | 'secondary'
}

function TerminalPane({ pane }: TerminalPaneProps) {
  const { t } = useTranslation()
  const group = useTerminalStore((s) => s[pane])
  const projectRoot = useAppStore((s) => s.projectRoot)
  const addTab = useTerminalStore((s) => s.addTab)
  const closeTab = useTerminalStore((s) => s.closeTab)
  const setActiveTab = useTerminalStore((s) => s.setActiveTab)
  const toggleSplit = useTerminalStore((s) => s.toggleSplit)
  const splitEnabled = useTerminalStore((s) => s.splitEnabled)
  const moveTab = useTerminalStore((s) => s.moveTab)
  const setFocusedPane = useTerminalStore((s) => s.setFocusedPane)

  const [isDragOver, setIsDragOver] = useState(false)
  // ドラッグ中はターミナルコンテンツの pointer-events を無効化して xterm に drop が届かないようにする
  const [isAnyTabDragging, setIsAnyTabDragging] = useState(false)

  useEffect(() => {
    const onDragStart = () => setIsAnyTabDragging(true)
    // dragend が Tauri 環境で発火しない場合があるため drop・mouseup も解除条件にする
    const reset = () => setIsAnyTabDragging(false)
    document.addEventListener('dragstart', onDragStart, true)
    document.addEventListener('dragend', reset, true)
    document.addEventListener('drop', reset, true)
    document.addEventListener('mouseup', reset, true)
    return () => {
      document.removeEventListener('dragstart', onDragStart, true)
      document.removeEventListener('dragend', reset, true)
      document.removeEventListener('drop', reset, true)
      document.removeEventListener('mouseup', reset, true)
    }
  }, [])

  const handleDragStart = useCallback((e: React.DragEvent, tabId: string) => {
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify({ tabId, pane }))
    e.dataTransfer.effectAllowed = 'move'
  }, [pane])

  // ペイン全体をドロップターゲットにする
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes(DRAG_MIME)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // 子要素への移動は無視（false positive を防ぐ）
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    const raw = e.dataTransfer.getData(DRAG_MIME)
    try {
      const { tabId, pane: fromPane } = JSON.parse(raw)
      if (fromPane !== pane) {
        moveTab(tabId, fromPane, pane)
      }
    } catch {
      // ignore invalid drag data
    }
  }, [pane, moveTab])

  return (
    <div
      className="flex flex-col h-full min-w-0 transition-colors"
      style={{
        outline: isDragOver ? '2px solid var(--color-accent)' : 'none',
        outlineOffset: '-2px',
      }}
      onPointerDown={() => setFocusedPane(pane)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* タブバー */}
      <div
        className="flex items-center h-8 flex-shrink-0 border-b"
        style={{
          background: 'var(--color-bg-elevated)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="flex items-center flex-1 overflow-x-auto min-w-0">
          {group.tabs.map((tab) => {
            const isActive = tab.id === group.activeTabId
            const display = computeDisplayTitle(tab)
            return (
              <button
                key={tab.id}
                draggable
                onDragStart={(e) => handleDragStart(e, tab.id)}
                onClick={() => setActiveTab(tab.id, pane)}
                title={display}
                className="flex items-center gap-1.5 h-full px-3 text-xs flex-shrink-0 transition-colors outline-none group cursor-grab active:cursor-grabbing"
                style={{
                  color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                  borderBottom: isActive
                    ? '2px solid var(--color-accent)'
                    : '2px solid transparent',
                }}
              >
                <span className="max-w-[12rem] truncate">{display}</span>
                {group.tabs.length > 1 && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation()
                      closeTab(tab.id, pane)
                    }}
                    className="flex items-center justify-center w-4 h-4 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10 cursor-default"
                  >
                    <X size={10} />
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <button
          onClick={() => addTab(pane)}
          className="flex items-center justify-center w-7 h-full flex-shrink-0 transition-colors outline-none"
          style={{ color: 'var(--color-text-muted)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-text-primary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-muted)')}
          title={t('terminal.tooltip.newTab')}
        >
          <Plus size={14} />
        </button>

        {pane === 'primary' && (
          <button
            onClick={toggleSplit}
            title={t('terminal.tooltip.split')}
            className="flex items-center justify-center w-7 h-7 rounded transition-colors outline-none hover:bg-white/10 flex-shrink-0 mr-1"
            style={{ color: splitEnabled ? 'var(--color-accent)' : 'var(--color-text-muted)' }}
          >
            <Columns2 size={13} />
          </button>
        )}
      </div>

      {/* ターミナル（非アクティブは display:none で常時マウント）
          ドラッグ中は pointer-events:none で xterm への drop を遮断 */}
      <div
        className="flex-1 min-h-0 relative"
        style={{ pointerEvents: isAnyTabDragging ? 'none' : 'auto' }}
      >
        {group.tabs.map((tab) => {
          const isActive = tab.id === group.activeTabId
          return (
            <div
              key={tab.id}
              className="absolute inset-0 p-1"
              style={{ display: isActive ? 'flex' : 'none' }}
            >
              <TerminalPanel tabId={tab.id} cwd={projectRoot ?? "~"} isActive={isActive} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function TerminalTabs() {
  const splitEnabled = useTerminalStore((s) => s.splitEnabled)

  const [splitSize, setSplitSize] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  const onSeparatorMouseDown = useCallback(() => {
    isDragging.current = true
    document.body.style.userSelect = 'none'

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const newSize = e.clientX - rect.left
      setSplitSize(Math.min(rect.width - 150, Math.max(150, newSize)))
    }

    const onMouseUp = () => {
      isDragging.current = false
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [])

  return (
    <div ref={containerRef} className="flex h-full">
      {/* プライマリペイン：常にマウントしてPTYセッションを保持 */}
      <div
        className="flex flex-col min-w-0 overflow-hidden"
        style={{
          flex: !splitEnabled || splitSize == null ? 1 : '0 0 auto',
          width: splitEnabled && splitSize != null ? `${splitSize}px` : undefined,
        }}
      >
        <TerminalPane pane="primary" />
      </div>

      {/* セパレーター：分割時のみ表示 */}
      <div
        className="w-1 flex-shrink-0 cursor-col-resize transition-colors"
        style={{ background: 'var(--color-border)', display: splitEnabled ? 'block' : 'none' }}
        onMouseDown={onSeparatorMouseDown}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-accent)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--color-border)')}
      />

      {/* セカンダリペイン：常にマウントしてPTYセッションを保持、分割時のみ表示 */}
      <div
        className="flex flex-col flex-1 min-w-0 overflow-hidden"
        style={{ display: splitEnabled ? 'flex' : 'none' }}
      >
        <TerminalPane pane="secondary" />
      </div>
    </div>
  )
}
