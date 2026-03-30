import { create } from 'zustand'
import type { ViewMode } from '../lib/viewMode'

interface ContentState {
  filePath: string | null
  content: string | null
  viewMode: ViewMode
  isLoading: boolean
  setFile: (filePath: string, content: string, viewMode: ViewMode) => void
  setLoading: (loading: boolean) => void
  clear: () => void
}

export const useContentStore = create<ContentState>((set) => ({
  filePath: null,
  content: null,
  viewMode: 'plain',
  isLoading: false,
  setFile: (filePath, content, viewMode) =>
    set({ filePath, content, viewMode, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  clear: () => set({ filePath: null, content: null, viewMode: 'plain', isLoading: false }),
}))
