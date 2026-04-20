import { create } from 'zustand'

export type TabDragKind = 'content' | 'terminal'
export type TabDragPane = 'primary' | 'secondary'

export interface TabDragSource {
  kind: TabDragKind
  tabId: string
  fromPane: TabDragPane
}

export interface TabDragHover {
  kind: TabDragKind
  pane: TabDragPane
}

interface TabDndState {
  source: TabDragSource | null
  hover: TabDragHover | null
  startDrag: (source: TabDragSource) => void
  setHover: (hover: TabDragHover | null) => void
  endDrag: () => void
}

// Tauri の dragDropEnabled=true 環境では webview 内の HTML5 dragover/drop が
// JS に届かないため、dragstart で記録したソースを Tauri の onDragDropEvent 側で
// 参照して実際の移動判定を行う。その橋渡しとして使う。
export const useTabDndStore = create<TabDndState>((set) => ({
  source: null,
  hover: null,
  startDrag: (source) => set({ source, hover: null }),
  setHover: (hover) => set({ hover }),
  endDrag: () => set({ source: null, hover: null }),
}))
