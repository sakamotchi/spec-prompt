import { useEffect } from 'react'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import {
  useTabDndStore,
  type TabDragKind,
  type TabDragPane,
} from '../../stores/tabDndStore'
import { useContentStore } from '../../stores/contentStore'
import { useTerminalStore } from '../../stores/terminalStore'

// data-tab-drop-kind="content|terminal" / data-tab-drop-pane="primary|secondary"
// を持つ要素をヒットテストのターゲットとする。
function findTabDropTarget(
  px: number,
  py: number,
): { kind: TabDragKind; pane: TabDragPane } | null {
  // TreePanel と同様に CSS ピクセル / physical ピクセル両方で試す
  const dpr = window.devicePixelRatio || 1
  const candidates = [
    { x: px, y: py },
    { x: px / dpr, y: py / dpr },
  ]
  for (const c of candidates) {
    const el = document.elementFromPoint(c.x, c.y) as HTMLElement | null
    if (!el) continue
    const target = el.closest('[data-tab-drop-pane]') as HTMLElement | null
    if (!target) continue
    const pane = target.getAttribute('data-tab-drop-pane') as TabDragPane | null
    const kind = target.getAttribute('data-tab-drop-kind') as TabDragKind | null
    if (pane && kind) return { kind, pane }
  }
  return null
}

// タブ間 DnD を Tauri の onDragDropEvent 経由で仲介する。
export function TabDndCoordinator() {
  useEffect(() => {
    let unlisten: (() => void) | null = null
    let disposed = false

    getCurrentWebview()
      .onDragDropEvent((event) => {
        const store = useTabDndStore.getState()
        const source = store.source
        if (!source) return
        const payload = event.payload

        if (payload.type === 'over') {
          const hit = findTabDropTarget(payload.position.x, payload.position.y)
          if (hit && hit.kind === source.kind) {
            const cur = store.hover
            if (!cur || cur.kind !== hit.kind || cur.pane !== hit.pane) {
              store.setHover(hit)
            }
          } else if (store.hover) {
            store.setHover(null)
          }
        } else if (payload.type === 'drop') {
          const hit = findTabDropTarget(payload.position.x, payload.position.y)
          if (
            hit &&
            hit.kind === source.kind &&
            hit.pane !== source.fromPane
          ) {
            if (source.kind === 'content') {
              useContentStore
                .getState()
                .moveTab(source.tabId, source.fromPane, hit.pane)
            } else {
              useTerminalStore
                .getState()
                .moveTab(source.tabId, source.fromPane, hit.pane)
            }
          }
          store.endDrag()
        } else if (payload.type === 'leave') {
          store.setHover(null)
        }
      })
      .then((fn) => {
        if (disposed) fn()
        else unlisten = fn
      })
      .catch(console.error)

    // 注意: document の dragend/drop で source をクリアしない。
    // macOS の Tauri では HTML5 の dragend が onDragDropEvent('drop') より先に発火するため、
    // ここで endDrag すると肝心の drop ハンドリング時に source が null になってしまう。
    // 次の startDrag が state を上書きするので、source のリークは実害がない。

    return () => {
      disposed = true
      if (unlisten) unlisten()
    }
  }, [])

  return null
}
