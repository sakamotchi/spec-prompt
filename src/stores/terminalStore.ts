import { create } from 'zustand'

export interface TerminalTab {
  id: string
  ptyId: string | null
  /** タブ作成時に固定される名前（"Terminal 1" など） */
  fallbackTitle: string
  /** OSC 0/1/2 で受信した最新タイトル。null = 未受信 or リセット */
  oscTitle: string | null
}

export interface TerminalGroup {
  tabs: TerminalTab[]
  activeTabId: string
}

interface TerminalState {
  primary: TerminalGroup
  secondary: TerminalGroup
  splitEnabled: boolean
  focusedPane: 'primary' | 'secondary'

  addTab: (pane: 'primary' | 'secondary') => void
  closeTab: (id: string, pane: 'primary' | 'secondary') => void
  setActiveTab: (id: string, pane: 'primary' | 'secondary') => void
  setPtyId: (tabId: string, ptyId: string) => void
  setOscTitle: (ptyId: string, rawTitle: string | null) => void
  moveTab: (tabId: string, fromPane: 'primary' | 'secondary', toPane: 'primary' | 'secondary') => void
  toggleSplit: () => void
  setFocusedPane: (pane: 'primary' | 'secondary') => void
  // ショートカット用アクション
  closeActiveTab: (pane: 'primary' | 'secondary') => void
  activateTabByIndex: (index: number, pane: 'primary' | 'secondary') => void
  activatePrevTab: (pane: 'primary' | 'secondary') => void
}

const makeTab = (index: number): TerminalTab => ({
  id: crypto.randomUUID(),
  ptyId: null,
  fallbackTitle: `Terminal ${index}`,
  oscTitle: null,
})

const makeGroup = (index = 1): TerminalGroup => {
  const tab = makeTab(index)
  return { tabs: [tab], activeTabId: tab.id }
}

/**
 * OSC タイトル文字列の制御文字（C0 + DEL）を除去し、trim する。
 * 空文字や null に解決される場合は null を返し、フロント側でフォールバック名を使う。
 */
// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_RE = /[\x00-\x1F\x7F]/g
export function sanitizeTitle(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const cleaned = raw.replace(CONTROL_CHAR_RE, '').trim()
  return cleaned.length === 0 ? null : cleaned
}

/**
 * タブの表示タイトルを算出する。
 * P2 時点の優先順位: oscTitle > fallbackTitle
 * P3 以降で pinned / manualTitle を追加する際はここを拡張する。
 */
export function computeDisplayTitle(tab: TerminalTab): string {
  return tab.oscTitle ?? tab.fallbackTitle
}

export const useTerminalStore = create<TerminalState>((set) => ({
  primary: makeGroup(1),
  secondary: makeGroup(1),
  splitEnabled: false,
  focusedPane: 'primary',

  addTab: (pane) =>
    set((state) => {
      const group = state[pane]
      const newTab = makeTab(group.tabs.length + 1)
      return {
        [pane]: { tabs: [...group.tabs, newTab], activeTabId: newTab.id },
      }
    }),

  closeTab: (id, pane) =>
    set((state) => {
      const group = state[pane]
      if (group.tabs.length <= 1) return state
      const newTabs = group.tabs.filter((t) => t.id !== id)
      const fallback = newTabs[newTabs.length - 1].id
      return {
        [pane]: {
          tabs: newTabs,
          activeTabId: group.activeTabId === id ? fallback : group.activeTabId,
        },
      }
    }),

  setActiveTab: (id, pane) =>
    set((state) => ({ [pane]: { ...state[pane], activeTabId: id } })),

  setPtyId: (tabId, ptyId) =>
    set((state) => {
      const updateGroup = (g: TerminalGroup): TerminalGroup => ({
        ...g,
        tabs: g.tabs.map((t) => (t.id === tabId ? { ...t, ptyId } : t)),
      })
      return { primary: updateGroup(state.primary), secondary: updateGroup(state.secondary) }
    }),

  setOscTitle: (ptyId, rawTitle) =>
    set((state) => {
      const sanitized = sanitizeTitle(rawTitle)
      let changed = false
      const updateGroup = (g: TerminalGroup): TerminalGroup => {
        const tabs = g.tabs.map((t) => {
          if (t.ptyId !== ptyId) return t
          if (t.oscTitle === sanitized) return t
          changed = true
          return { ...t, oscTitle: sanitized }
        })
        return changed ? { ...g, tabs } : g
      }
      const primary = updateGroup(state.primary)
      const secondary = updateGroup(state.secondary)
      if (!changed) return state
      return { primary, secondary }
    }),

  moveTab: (tabId, fromPane, toPane) =>
    set((state) => {
      if (fromPane === toPane) return state
      const fromGroup = state[fromPane]
      const toGroup = state[toPane]
      const tab = fromGroup.tabs.find((t) => t.id === tabId)
      if (!tab) return state

      const newFromTabs = fromGroup.tabs.filter((t) => t.id !== tabId)
      const fromFallback = fromGroup.activeTabId === tabId
        ? newFromTabs[newFromTabs.length - 1]?.id
        : fromGroup.activeTabId
      const newFromGroup: TerminalGroup = newFromTabs.length === 0
        ? (() => { const t = makeTab(1); return { tabs: [t], activeTabId: t.id } })()
        : { tabs: newFromTabs, activeTabId: fromFallback! }

      const newToGroup: TerminalGroup = {
        tabs: [...toGroup.tabs, tab],
        activeTabId: tab.id,
      }

      return { [fromPane]: newFromGroup, [toPane]: newToGroup }
    }),

  toggleSplit: () => set((state) => ({ splitEnabled: !state.splitEnabled })),

  setFocusedPane: (pane) => set({ focusedPane: pane }),

  closeActiveTab: (pane) =>
    set((state) => {
      const group = state[pane]
      if (group.tabs.length <= 1) return state
      const activeId = group.activeTabId
      const idx = group.tabs.findIndex((t) => t.id === activeId)
      const newTabs = group.tabs.filter((t) => t.id !== activeId)
      const fallback = newTabs[Math.max(0, idx - 1)].id
      return { [pane]: { tabs: newTabs, activeTabId: fallback } }
    }),

  activateTabByIndex: (index, pane) =>
    set((state) => {
      const group = state[pane]
      const tab = group.tabs[Math.min(index, group.tabs.length - 1)]
      if (!tab) return state
      return { [pane]: { ...group, activeTabId: tab.id } }
    }),

  activatePrevTab: (pane) =>
    set((state) => {
      const group = state[pane]
      const idx = group.tabs.findIndex((t) => t.id === group.activeTabId)
      const prevIdx = (idx - 1 + group.tabs.length) % group.tabs.length
      return { [pane]: { ...group, activeTabId: group.tabs[prevIdx].id } }
    }),
}))
