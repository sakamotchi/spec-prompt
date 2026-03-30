import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { FileNode } from '../lib/tauriApi'

function setNodeChildren(nodes: FileNode[], targetPath: string, children: FileNode[]): FileNode[] {
  return nodes.map((node) => {
    if (node.path === targetPath) return { ...node, children }
    if (node.children) return { ...node, children: setNodeChildren(node.children, targetPath, children) }
    return node
  })
}

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
  updateDirChildren: (path: string, children: FileNode[]) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeMainTab: 'content',
      setActiveMainTab: (tab) => set({ activeMainTab: tab }),
      mainLayout: 'tab',
      toggleMainLayout: () =>
        set((state) => ({ mainLayout: state.mainLayout === 'tab' ? 'split' : 'tab' })),

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
      updateDirChildren: (path, children) =>
        set((state) => {
          if (path === state.projectRoot) return { fileTree: children }
          return { fileTree: setNodeChildren(state.fileTree, path, children) }
        }),
    }),
    {
      name: 'spec-prompt-app-store',
      partialize: (state) => ({
        activeMainTab: state.activeMainTab,
        mainLayout: state.mainLayout,
        projectRoot: state.projectRoot,
        selectedFile: state.selectedFile,
        expandedDirs: state.expandedDirs,
      }),
      storage: createJSONStorage(() => localStorage, {
        replacer: (_key, value) =>
          value instanceof Set ? { __type: 'Set', values: [...value] } : value,
        reviver: (_key, value) => {
          if (
            value !== null &&
            typeof value === 'object' &&
            (value as { __type?: string }).__type === 'Set'
          ) {
            return new Set((value as { values: string[] }).values)
          }
          return value
        },
      }),
    }
  )
)
