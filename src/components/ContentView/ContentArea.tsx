import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { watch } from '@tauri-apps/plugin-fs'
import { useAppStore } from '../../stores/appStore'
import { useContentStore } from '../../stores/contentStore'
import { getViewMode } from '../../lib/viewMode'
import { ContentTabBar } from './ContentTabBar'
import { ContentView } from './ContentView'

function ContentPane({ pane }: { pane: 'primary' | 'secondary' }) {
  const group = useContentStore((s) => s[pane])
  const focusedPane = useContentStore((s) => s.focusedPane)
  const setActiveTab = useContentStore((s) => s.setActiveTab)
  const closeTab = useContentStore((s) => s.closeTab)
  const splitEnabled = useContentStore((s) => s.splitEnabled)
  const toggleSplit = useContentStore((s) => s.toggleSplit)
  const setFocusedPane = useContentStore((s) => s.setFocusedPane)
  const moveTab = useContentStore((s) => s.moveTab)

  return (
    <div
      className="flex flex-col h-full min-w-0"
      onMouseDown={() => setFocusedPane(pane)}
    >
      <ContentTabBar
        tabs={group.tabs}
        activeTabId={group.activeTabId}
        pane={pane}
        isFocused={splitEnabled && focusedPane === pane}
        onTabClick={(id) => setActiveTab(id, pane)}
        onTabClose={closeTab}
        onTabMove={moveTab}
        splitEnabled={splitEnabled}
        onToggleSplit={pane === 'primary' ? toggleSplit : undefined}
      />
      <div className="flex-1 min-h-0 overflow-hidden">
        <ContentView tabId={group.activeTabId} />
      </div>
    </div>
  )
}

export function ContentArea() {
  const projectRoot = useAppStore((s) => s.projectRoot)
  const splitEnabled = useContentStore((s) => s.splitEnabled)
  const setTabContent = useContentStore((s) => s.setTabContent)

  const [splitSize, setSplitSize] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  useEffect(() => {
    if (!splitEnabled) setSplitSize(null)
  }, [splitEnabled])

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

  // ファイル監視（両グループの全タブを対象）
  useEffect(() => {
    if (!projectRoot) return

    let unlisten: (() => void) | null = null
    const getAllTabs = () => {
      const s = useContentStore.getState()
      return [...s.primary.tabs, ...s.secondary.tabs]
    }

    watch(
      projectRoot,
      (event) => {
        for (const tab of getAllTabs()) {
          if (!tab.filePath) continue
          const matched = event.paths.some(
            (p) => p === tab.filePath || p.endsWith(tab.filePath!) || tab.filePath!.endsWith(p)
          )
          if (matched) {
            invoke<string>('read_file', { path: tab.filePath })
              .then((text) =>
                setTabContent(tab.id, tab.filePath!, text, getViewMode(tab.filePath!))
              )
              .catch(console.error)
          }
        }
      },
      { recursive: true, delayMs: 300 },
    )
      .then((fn) => { unlisten = fn })
      .catch(console.error)

    return () => { unlisten?.() }
  }, [projectRoot, setTabContent])

  if (!splitEnabled) {
    return <ContentPane pane="primary" />
  }

  return (
    <div ref={containerRef} className="flex h-full">
      <div
        className="flex flex-col min-w-0 overflow-hidden"
        style={{
          flex: splitSize != null ? '0 0 auto' : 1,
          width: splitSize != null ? `${splitSize}px` : undefined,
        }}
      >
        <ContentPane pane="primary" />
      </div>

      <div
        className="w-1 flex-shrink-0 cursor-col-resize transition-colors"
        style={{ background: 'var(--color-border)' }}
        onMouseDown={onSeparatorMouseDown}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-accent)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--color-border)')}
      />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <ContentPane pane="secondary" />
      </div>
    </div>
  )
}
