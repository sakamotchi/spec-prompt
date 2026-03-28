import { create } from 'zustand'

export interface TerminalTab {
  id: string
  title: string
  ptyId: string | null
}

interface TerminalState {
  tabs: TerminalTab[]
  activeTabId: string
  addTab: () => void
  closeTab: (id: string) => void
  setActiveTab: (id: string) => void
  setPtyId: (tabId: string, ptyId: string) => void
}

const initialTab: TerminalTab = {
  id: crypto.randomUUID(),
  title: 'Terminal 1',
  ptyId: null,
}

export const useTerminalStore = create<TerminalState>((set) => ({
  tabs: [initialTab],
  activeTabId: initialTab.id,

  addTab: () =>
    set((state) => {
      const newTab: TerminalTab = {
        id: crypto.randomUUID(),
        title: `Terminal ${state.tabs.length + 1}`,
        ptyId: null,
      }
      return { tabs: [...state.tabs, newTab], activeTabId: newTab.id }
    }),

  closeTab: (id) =>
    set((state) => {
      if (state.tabs.length <= 1) return state
      const newTabs = state.tabs.filter((t) => t.id !== id)
      const newActiveId =
        state.activeTabId === id ? newTabs[newTabs.length - 1].id : state.activeTabId
      return { tabs: newTabs, activeTabId: newActiveId }
    }),

  setActiveTab: (id) => set({ activeTabId: id }),

  setPtyId: (tabId, ptyId) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, ptyId } : t)),
    })),
}))
