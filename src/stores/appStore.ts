import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { getCurrentWindow } from '@tauri-apps/api/window'
import type { FileNode, GitFileStatus } from '../lib/tauriApi'
import { tauriApi } from '../lib/tauriApi'
import { parseStatus, type DocStatus } from '../lib/frontmatter'
import { migrateLegacyKey } from '../lib/legacyStorageMigration'

const WINDOW_LABEL = getCurrentWindow().label
const PERSIST_KEY = `sddesk-app-store:${WINDOW_LABEL}`

// マイグレーション: より新しい（ラベル付き）legacy を優先し、既存値があればそれを保護する。
// 1. SpecPrompt 時代のラベル付き legacy (`spec-prompt-app-store:${label}`)
migrateLegacyKey(`spec-prompt-app-store:${WINDOW_LABEL}`, PERSIST_KEY)
// 2. さらに古いラベルなし legacy (`spec-prompt-app-store`、main window のみ)
if (WINDOW_LABEL === 'main') {
  migrateLegacyKey('spec-prompt-app-store', PERSIST_KEY)
}

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

  // Git ステータス
  gitStatuses: Record<string, GitFileStatus>
  refreshGitStatus: () => void

  // ファイル DnD（ドロップターゲットのハイライト用）
  dragOverPath: string | null
  setDragOverPath: (path: string | null) => void
  // ファイル DnD（HTML5 dragstart で内部ドラッグ中の対象パスを保持。
  // macOS では dragDropEnabled=true により内部 dragover/drop が JS に届かないため、
  // 実際の移動判定は Tauri の onDragDropEvent 側で行い、ここで持つ paths を使う）
  internalDragPaths: string[]
  setInternalDragPaths: (paths: string[]) => void
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
          if (path === state.projectRoot) {
            // ルート更新時も展開済みフォルダの子要素を維持する
            const merged = children.map((newNode) => {
              const existing = state.fileTree.find((n) => n.path === newNode.path)
              if (existing?.children && newNode.is_dir) {
                return { ...newNode, children: existing.children }
              }
              return newNode
            })
            return { fileTree: merged }
          }
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
      switchProject: (root) => {
        set({
          projectRoot: root,
          fileTree: [],
          expandedDirs: new Set<string>(),
          selectedFile: null,
          selectedFiles: [],
          editingState: null,
          creatingState: null,
          docStatuses: {},
          gitStatuses: {},
        })
        // 新プロジェクトの Git ステータスを取得
        useAppStore.getState().refreshGitStatus()
      },

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

      dragOverPath: null,
      setDragOverPath: (path) => set({ dragOverPath: path }),
      internalDragPaths: [],
      setInternalDragPaths: (paths) => set({ internalDragPaths: paths }),

      // Git ステータス
      gitStatuses: {},
      refreshGitStatus: (() => {
        let timer: ReturnType<typeof setTimeout> | null = null
        return () => {
          if (timer) clearTimeout(timer)
          timer = setTimeout(async () => {
            timer = null
            const root = useAppStore.getState().projectRoot
            if (!root) return
            try {
              const statuses = await tauriApi.getGitStatus(root)
              set({ gitStatuses: statuses })
            } catch {
              // Git 未対応の場合は空のまま
            }
          }, 500)
        }
      })(),
    }),
    {
      name: PERSIST_KEY,
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
