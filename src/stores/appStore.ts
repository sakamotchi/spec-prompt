import { create } from 'zustand'

type MainTab = 'content' | 'terminal'

interface AppState {
  activeMainTab: MainTab
  setActiveMainTab: (tab: MainTab) => void
  // Phase 1-B, 1-C, 1-D で順次追加予定:
  // fileTree, selectedFile, activeProjectPath ...
}

export const useAppStore = create<AppState>((set) => ({
  activeMainTab: 'content',
  setActiveMainTab: (tab) => set({ activeMainTab: tab }),
}))
