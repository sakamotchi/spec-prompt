import { create } from 'zustand'

export interface PromptPaletteState {
  isOpen: boolean
  targetPtyId: string | null
  targetTabName: string | null
  drafts: Record<string, string>

  open: (ptyId: string, tabName: string) => void
  close: () => void
  setDraft: (ptyId: string, value: string) => void
  getDraft: (ptyId: string) => string
  clearDraft: (ptyId: string) => void
}

export const usePromptPaletteStore = create<PromptPaletteState>((set, get) => ({
  isOpen: false,
  targetPtyId: null,
  targetTabName: null,
  drafts: {},

  open: (ptyId, tabName) =>
    set({ isOpen: true, targetPtyId: ptyId, targetTabName: tabName }),

  close: () =>
    set({ isOpen: false, targetPtyId: null, targetTabName: null }),

  setDraft: (ptyId, value) =>
    set((state) => ({ drafts: { ...state.drafts, [ptyId]: value } })),

  getDraft: (ptyId) => get().drafts[ptyId] ?? '',

  clearDraft: (ptyId) =>
    set((state) => {
      if (!(ptyId in state.drafts)) return state
      const next = { ...state.drafts }
      delete next[ptyId]
      return { drafts: next }
    }),
}))
