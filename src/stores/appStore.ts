import { create } from 'zustand'
import type { FileNode } from '../lib/tauriApi'

type MainTab = 'content' | 'terminal'
type MainLayout = 'tab' | 'split'

interface AppState {
  // Phase 1-A
  activeMainTab: MainTab
  setActiveMainTab: (tab: MainTab) => void
  mainLayout: MainLayout
  toggleMainLayout: () => void

  // Phase 1-B
  projectRoot: string | null
  fileTree: FileNode[]
  selectedFile: string | null
  expandedDirs: Set<string>
  setProjectRoot: (root: string) => void
  setFileTree: (tree: FileNode[]) => void
  setSelectedFile: (path: string | null) => void
  toggleExpandedDir: (path: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  activeMainTab: 'content',
  setActiveMainTab: (tab) => set({ activeMainTab: tab }),

  projectRoot: null,
  fileTree: [],
  selectedFile: null,
  expandedDirs: new Set<string>(),
  setProjectRoot: (root) => set({ projectRoot: root }),
  setFileTree: (tree) => set({ fileTree: tree }),
  setSelectedFile: (path) => set({ selectedFile: path }),
  toggleExpandedDir: (path) =>
    set((state) => {
      const next = new Set(state.expandedDirs)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return { expandedDirs: next }
    }),
}))
