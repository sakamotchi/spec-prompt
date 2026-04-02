import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { FileNode } from '../lib/tauriApi'
import { tauriApi } from '../lib/tauriApi'
import { parseStatus, type DocStatus } from '../lib/frontmatter'

function setNodeChildren(nodes: FileNode[], targetPath: string, children: FileNode[]): FileNode[] {
  return nodes.map((node) => {
    if (node.path === targetPath) return { ...node, children }
    if (node.children) return { ...node, children: setNodeChildren(node.children, targetPath, children) }
    return node
  })
}

type MainTab = 'content' | 'terminal'
type MainLayout = 'tab' | 'split'
export type PathFormat = 'relative' | 'absolute'

export interface EditingState {
  type: 'rename'
  path: string
}

export interface CreatingState {
  type: 'create'
  parentPath: string
  nodeType: 'file' | 'dir'
}

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

  // Phase 2-D
  pathFormat: PathFormat
  selectedFiles: string[]
  setPathFormat: (format: PathFormat) => void
  toggleFileSelection: (path: string) => void
  clearFileSelection: () => void

  // Phase 2-E
  editingState: EditingState | null
  creatingState: CreatingState | null
  setEditingState: (state: EditingState | null) => void
  setCreatingState: (state: CreatingState | null) => void

  // Phase 2-F
  recentProjects: string[]
  setRecentProjects: (projects: string[]) => void
  switchProject: (root: string) => void

  // Phase 3-A
  docStatuses: Record<string, DocStatus | null>
  setDocStatus: (path: string, status: DocStatus | null) => void
  loadDocStatuses: (paths: string[]) => Promise<void>
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

      pathFormat: 'relative',
      selectedFiles: [],
      setPathFormat: (format) => set({ pathFormat: format }),
      toggleFileSelection: (path) =>
        set((state) => ({
          selectedFiles: state.selectedFiles.includes(path)
            ? state.selectedFiles.filter((p) => p !== path)
            : [...state.selectedFiles, path],
        })),
      clearFileSelection: () => set({ selectedFiles: [] }),

      editingState: null,
      creatingState: null,
      setEditingState: (state) => set({ editingState: state }),
      setCreatingState: (state) => set({ creatingState: state }),

      recentProjects: [],
      setRecentProjects: (projects) => set({ recentProjects: projects }),
      switchProject: (root) =>
        set({
          projectRoot: root,
          fileTree: [],
          expandedDirs: new Set<string>(),
          selectedFile: null,
          selectedFiles: [],
          editingState: null,
          creatingState: null,
          docStatuses: {},
        }),

      docStatuses: {},
      setDocStatus: (path, status) =>
        set((state) => ({ docStatuses: { ...state.docStatuses, [path]: status } })),
      loadDocStatuses: async (paths) => {
        const mdPaths = paths.filter((p) => /\.(md|mdx)$/i.test(p))
        await Promise.all(
          mdPaths.map(async (path) => {
            try {
              const content = await tauriApi.readFile(path)
              const status = parseStatus(content)
              set((s) => ({ docStatuses: { ...s.docStatuses, [path]: status } }))
            } catch {
              // 読み込み失敗は無視
            }
          })
        )
      },
    }),
    {
      name: 'spec-prompt-app-store',
      partialize: (state) => ({
        activeMainTab: state.activeMainTab,
        mainLayout: state.mainLayout,
        projectRoot: state.projectRoot,
        selectedFile: state.selectedFile,
        expandedDirs: state.expandedDirs,
        pathFormat: state.pathFormat,
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
