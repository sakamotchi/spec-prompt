import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus, X, Columns2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTerminalStore, computeDisplayTitle } from '../../stores/terminalStore'
import { useAppStore } from '../../stores/appStore'
import { usePromptPaletteStore } from '../../stores/promptPaletteStore'
import { TerminalPanel } from './TerminalPanel'
import { TabInlineRenameInput } from './TabInlineRenameInput'
import { TabContextMenu } from './TabContextMenu'
import { TerminalBodyContextMenu } from './TerminalBodyContextMenu'
import { useTabDndStore } from '../../stores/tabDndStore'

const DRAG_MIME = 'application/x-sddesk-tab'

interface TerminalPaneProps {
  pane: 'primary' | 'secondary'
}

function TerminalPane({ pane }: TerminalPaneProps) {
  const { t } = useTranslation()
  const group = useTerminalStore((s) => s[pane])
  const projectRoot = useAppStore((s) => s.projectRoot)
  const addTab = useTerminalStore((s) => s.addTab)
  const closeTab = useTerminalStore((s) => s.closeTab)
  const closeAllTabs = useTerminalStore((s) => s.closeAllTabs)
  const closeOtherTabs = useTerminalStore((s) => s.closeOtherTabs)
  const closeTabsToRight = useTerminalStore((s) => s.closeTabsToRight)
  const setActiveTab = useTerminalStore((s) => s.setActiveTab)
  const toggleSplit = useTerminalStore((s) => s.toggleSplit)
  const splitEnabled = useTerminalStore((s) => s.splitEnabled)
  const moveTab = useTerminalStore((s) => s.moveTab)
  const setFocusedPane = useTerminalStore((s) => s.setFocusedPane)

  // Tauri の dragDropEnabled=true 環境では HTML5 dragover/drop が JS に届かないため、
  // ハイライト表示は TabDndCoordinator が更新する共有ストアから購読する。
  const isDragOver = useTabDndStore(
    (s) => s.hover?.kind === 'terminal' && s.hover.pane === pane,
  )
  // ドラッグ中はターミナルコンテンツの pointer-events を無効化して xterm に drop が届かないようにする
  const [isAnyTabDragging, setIsAnyTabDragging] = useState(false)
  // インライン編集中のタブ ID（null のときは通常表示）
  const [editingTabId, setEditingTabId] = useState<string | null>(null)

  const commitRename = useCallback((tabId: string, title: string) => {
    const trimmed = title.trim()
    if (trimmed.length === 0) {
      useTerminalStore.getState().unpinTab(tabId)
    } else {
      useTerminalStore.getState().renameTab(tabId, trimmed)
    }
    setEditingTabId(null)
  }, [])

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
    // 非 Tauri 環境（または fallback）用に data も設定する
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify({ tabId, pane }))
    e.dataTransfer.effectAllowed = 'move'
    useTabDndStore.getState().startDrag({ kind: 'terminal', tabId, fromPane: pane })
  }, [pane])

  // 非 Tauri 環境での fallback。Tauri では JS に届かないので実質 no-op。
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes(DRAG_MIME)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
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
      data-tab-drop-kind="terminal"
      data-tab-drop-pane={pane}
      className="flex flex-col h-full min-w-0 transition-colors"
      style={{
        outline: isDragOver ? '2px solid var(--color-accent)' : 'none',
        outlineOffset: '-2px',
      }}
      onPointerDown={() => setFocusedPane(pane)}
      onDragOver={handleDragOver}
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
          {group.tabs.map((tab, index) => {
            const isActive = tab.id === group.activeTabId
            const isEditing = tab.id === editingTabId
            const display = computeDisplayTitle(tab)
            const canClose = group.tabs.length > 1
            const canCloseOthers = group.tabs.length > 1
            const canCloseToRight = index < group.tabs.length - 1
            const unread = tab.hasUnreadNotification
            const handleTabClick = () => {
              setActiveTab(tab.id, pane)
              if (unread && typeof document !== 'undefined' && document.hasFocus()) {
                useTerminalStore.getState().clearUnread(tab.id)
              }
              // タブ切替後にターミナル本体（hidden textarea）へフォーカスを戻す。
              // display:none → flex の切替反映後に focus する必要があるため 1 フレーム遅延。
              // 分割時は逆ペインへフォーカスが流れないよう pane を指定する。
              requestAnimationFrame(() => {
                window.dispatchEvent(new CustomEvent('terminal:focus', { detail: { pane } }))
              })
            }
            return (
              <TabContextMenu
                key={tab.id}
                pinned={tab.pinned}
                canClose={canClose}
                canCloseOthers={canCloseOthers}
                canCloseToRight={canCloseToRight}
                onRename={() => setEditingTabId(tab.id)}
                onUnpin={() => useTerminalStore.getState().unpinTab(tab.id)}
                onClose={() => closeTab(tab.id, pane)}
                onCloseToRight={() => closeTabsToRight(tab.id, pane)}
                onCloseOthers={() => closeOtherTabs(tab.id, pane)}
                onCloseAll={() => closeAllTabs(pane)}
                onOpenPromptPalette={() => {
                  if (!tab.ptyId) return
                  usePromptPaletteStore.getState().open(tab.ptyId, display)
                }}
              >
                <button
                  draggable={!isEditing}
                  onDragStart={isEditing ? undefined : (e) => handleDragStart(e, tab.id)}
                  onClick={isEditing ? undefined : handleTabClick}
                  onDoubleClick={() => setEditingTabId(tab.id)}
                  title={isEditing ? undefined : display}
                  data-unread={unread ? 'true' : undefined}
                  className={`flex items-center gap-1.5 h-full px-3 text-xs flex-shrink-0 transition-colors outline-none group ${
                    isEditing ? 'cursor-text' : 'cursor-grab active:cursor-grabbing'
                  }`}
                  style={{
                    color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                    borderBottom: isActive
                      ? '2px solid var(--color-accent)'
                      : '2px solid transparent',
                    borderLeft: unread
                      ? '2px solid rgb(245, 158, 11)'
                      : '2px solid transparent',
                    background: unread ? 'rgba(245, 158, 11, 0.2)' : undefined,
                  }}
                >
                  {isEditing ? (
                    <TabInlineRenameInput
                      defaultValue={display}
                      onCommit={(title) => commitRename(tab.id, title)}
                      onCancel={() => setEditingTabId(null)}
                    />
                  ) : (
                    <span className="flex items-center gap-1 max-w-[12rem] min-w-0">
                      {unread && (
                        <span
                          aria-hidden="true"
                          className="flex-shrink-0"
                          style={{
                            color: 'rgb(245, 158, 11)',
                            fontSize: '0.7em',
                            lineHeight: 1,
                          }}
                        >
                          ●
                        </span>
                      )}
                      <span className="truncate">{display}</span>
                    </span>
                  )}
                  {!isEditing && canClose && (
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
              </TabContextMenu>
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
          const display = computeDisplayTitle(tab)
          return (
            <div
              key={tab.id}
              className="absolute inset-0 p-1"
              style={{ display: isActive ? 'flex' : 'none' }}
            >
              <TerminalBodyContextMenu ptyId={tab.ptyId} tabTitle={display}>
                <div className="w-full h-full">
                  <TerminalPanel tabId={tab.id} cwd={projectRoot ?? "~"} isActive={isActive} pane={pane} />
                </div>
              </TerminalBodyContextMenu>
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
