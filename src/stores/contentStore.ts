import { create } from 'zustand'
import type { ViewMode } from '../lib/viewMode'

export interface ContentTab {
  id: string
  filePath: string | null
  content: string | null
  viewMode: ViewMode
  isLoading: boolean
}

export interface ContentGroup {
  tabs: ContentTab[]
  activeTabId: string
}

interface ContentState {
  primary: ContentGroup
  secondary: ContentGroup
  splitEnabled: boolean
  focusedPane: 'primary' | 'secondary'

  openFile: (filePath: string, pane?: 'primary' | 'secondary') => void
  closeTab: (id: string, pane: 'primary' | 'secondary') => void
  setActiveTab: (id: string, pane: 'primary' | 'secondary') => void
  setFocusedPane: (pane: 'primary' | 'secondary') => void
  setTabContent: (tabId: string, filePath: string, content: string, viewMode: ViewMode) => void
  setTabLoading: (tabId: string, loading: boolean) => void
  toggleSplit: () => void
  moveTab: (tabId: string, fromPane: 'primary' | 'secondary', toPane: 'primary' | 'secondary') => void
  closeTabByPath: (filePath: string) => void
  renameTabPath: (oldPath: string, newPath: string) => void
  resetAllTabs: () => void
}

const makeTab = (overrides?: Partial<ContentTab>): ContentTab => ({
  id: crypto.randomUUID(),
  filePath: null,
  content: null,
  viewMode: 'plain',
  isLoading: false,
  ...overrides,
})

const makeGroup = (): ContentGroup => {
  const tab = makeTab()
  return { tabs: [tab], activeTabId: tab.id }
}

// 両グループのタブを更新するヘルパー
function updateBothGroups(
  state: ContentState,
  updater: (group: ContentGroup) => ContentGroup,
): Pick<ContentState, 'primary' | 'secondary'> {
  return { primary: updater(state.primary), secondary: updater(state.secondary) }
}

export const useContentStore = create<ContentState>((set) => ({
  primary: makeGroup(),
  secondary: makeGroup(),
  splitEnabled: false,
  focusedPane: 'primary',

  openFile: (filePath, pane) =>
    set((state) => {
      const target = pane ?? state.focusedPane
      const group = state[target]

      // すでに開いているタブがあればアクティブ化
      const existing = group.tabs.find((t) => t.filePath === filePath)
      if (existing) {
        return { [target]: { ...group, activeTabId: existing.id }, focusedPane: target }
      }

      // アクティブタブが空なら再利用（新規タブを作らない）
      const activeTab = group.tabs.find((t) => t.id === group.activeTabId)
      if (activeTab?.filePath === null) {
        return {
          [target]: {
            tabs: group.tabs.map((t) =>
              t.id === group.activeTabId ? makeTab({ id: t.id, filePath, isLoading: true }) : t
            ),
            activeTabId: group.activeTabId,
          },
          focusedPane: target,
        }
      }

      // 新規タブを追加
      const newTab = makeTab({ filePath, isLoading: true })
      return {
        [target]: { tabs: [...group.tabs, newTab], activeTabId: newTab.id },
        focusedPane: target,
      }
    }),

  closeTab: (id, pane) =>
    set((state) => {
      const group = state[pane]
      if (group.tabs.length <= 1) {
        // 最後の1枚は空タブに置き換える
        const empty = makeTab()
        return { [pane]: { tabs: [empty], activeTabId: empty.id } }
      }
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

  setFocusedPane: (pane) => set({ focusedPane: pane }),

  // タブIDは両グループで一意なので両方を更新
  setTabContent: (tabId, filePath, content, viewMode) =>
    set((state) => ({
      ...updateBothGroups(state, (g) => ({
        ...g,
        tabs: g.tabs.map((t) =>
          t.id === tabId ? { ...t, filePath, content, viewMode, isLoading: false } : t
        ),
      })),
    })),

  setTabLoading: (tabId, isLoading) =>
    set((state) => ({
      ...updateBothGroups(state, (g) => ({
        ...g,
        tabs: g.tabs.map((t) => (t.id === tabId ? { ...t, isLoading } : t)),
      })),
    })),

  toggleSplit: () =>
    set((state) => ({ splitEnabled: !state.splitEnabled, focusedPane: 'primary' })),

  moveTab: (tabId, fromPane, toPane) =>
    set((state) => {
      if (fromPane === toPane) return state
      const fromGroup = state[fromPane]
      const toGroup = state[toPane]
      const tab = fromGroup.tabs.find((t) => t.id === tabId)
      if (!tab) return state

      // ソースから除去
      const newFromTabs = fromGroup.tabs.filter((t) => t.id !== tabId)
      const fromFallback = fromGroup.activeTabId === tabId
        ? newFromTabs[newFromTabs.length - 1]?.id
        : fromGroup.activeTabId
      const newFromGroup: ContentGroup = newFromTabs.length === 0
        ? (() => { const e = makeTab(); return { tabs: [e], activeTabId: e.id } })()
        : { tabs: newFromTabs, activeTabId: fromFallback! }

      // ターゲットへ追加（空タブ1枚のみなら置き換え）
      const targetHasSingleEmpty = toGroup.tabs.length === 1 && toGroup.tabs[0].filePath === null
      const newToTabs = targetHasSingleEmpty ? [tab] : [...toGroup.tabs, tab]
      const newToGroup: ContentGroup = { tabs: newToTabs, activeTabId: tab.id }

      return { [fromPane]: newFromGroup, [toPane]: newToGroup }
    }),

  closeTabByPath: (filePath) =>
    set((state) => {
      const closeInGroup = (group: ContentGroup, pane: 'primary' | 'secondary') => {
        const tab = group.tabs.find((t) => t.filePath === filePath)
        if (!tab) return { [pane]: group }
        if (group.tabs.length <= 1) {
          const empty = makeTab()
          return { [pane]: { tabs: [empty], activeTabId: empty.id } }
        }
        const newTabs = group.tabs.filter((t) => t.filePath !== filePath)
        const fallback = newTabs[newTabs.length - 1].id
        return {
          [pane]: {
            tabs: newTabs,
            activeTabId: group.activeTabId === tab.id ? fallback : group.activeTabId,
          },
        }
      }
      return { ...closeInGroup(state.primary, 'primary'), ...closeInGroup(state.secondary, 'secondary') }
    }),

  renameTabPath: (oldPath, newPath) =>
    set((state) => ({
      ...updateBothGroups(state, (g) => ({
        ...g,
        tabs: g.tabs.map((t) => (t.filePath === oldPath ? { ...t, filePath: newPath } : t)),
      })),
    })),

  resetAllTabs: () =>
    set({
      primary: makeGroup(),
      secondary: makeGroup(),
      splitEnabled: false,
      focusedPane: 'primary',
    }),
}))
