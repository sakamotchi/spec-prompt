import { create } from 'zustand'

export interface TerminalTab {
  id: string
  title: string
  ptyId: string | null
  scrollback: string
}

export interface TerminalGroup {
  tabs: TerminalTab[]
  activeTabId: string
}

interface TerminalState {
  primary: TerminalGroup
  secondary: TerminalGroup
  splitEnabled: boolean

  addTab: (pane: 'primary' | 'secondary') => void
  closeTab: (id: string, pane: 'primary' | 'secondary') => void
  setActiveTab: (id: string, pane: 'primary' | 'secondary') => void
  setPtyId: (tabId: string, ptyId: string) => void
  appendScrollback: (tabId: string, data: string) => void
  moveTab: (tabId: string, fromPane: 'primary' | 'secondary', toPane: 'primary' | 'secondary') => void
  toggleSplit: () => void
}

const makeTab = (index: number): TerminalTab => ({
  id: crypto.randomUUID(),
  title: `Terminal ${index}`,
  ptyId: null,
  scrollback: '',
})

const makeGroup = (index = 1): TerminalGroup => {
  const tab = makeTab(index)
  return { tabs: [tab], activeTabId: tab.id }
}

export const useTerminalStore = create<TerminalState>((set) => ({
  primary: makeGroup(1),
  secondary: makeGroup(1),
  splitEnabled: false,

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

  appendScrollback: (tabId, data) =>
    set((state) => {
      const LIMIT = 100_000
      const updateGroup = (g: TerminalGroup): TerminalGroup => ({
        ...g,
        tabs: g.tabs.map((t) => {
          if (t.id !== tabId) return t
          const next = t.scrollback + data
          return { ...t, scrollback: next.length > LIMIT ? next.slice(-LIMIT) : next }
        }),
      })
      return { primary: updateGroup(state.primary), secondary: updateGroup(state.secondary) }
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
}))
