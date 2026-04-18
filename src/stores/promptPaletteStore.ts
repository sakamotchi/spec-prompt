import type { RefObject } from 'react'
import { create } from 'zustand'

export type PromptPaletteTextareaRef = RefObject<HTMLTextAreaElement | null>

export interface PromptPaletteState {
  isOpen: boolean
  targetPtyId: string | null
  targetTabName: string | null
  drafts: Record<string, string>
  textareaRef: PromptPaletteTextareaRef | null
  /** 挿入シグナル: insertAtCaret が成功するたび単調増加。UI のフラッシュ購読用 */
  lastInsertAt: number

  open: (ptyId: string, tabName: string) => void
  close: () => void
  setDraft: (ptyId: string, value: string) => void
  getDraft: (ptyId: string) => string
  clearDraft: (ptyId: string) => void

  registerTextarea: (ref: PromptPaletteTextareaRef | null) => void
  insertAtCaret: (text: string) => void
}

function scheduleCaretRestore(
  getRef: () => PromptPaletteTextareaRef | null,
  caret: number,
) {
  const apply = () => {
    const ta = getRef()?.current
    if (!ta) return
    ta.focus()
    try {
      ta.setSelectionRange(caret, caret)
    } catch {
      // jsdom など setSelectionRange が実装不完全な環境では黙殺
    }
  }
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(apply)
  } else {
    apply()
  }
}

export const usePromptPaletteStore = create<PromptPaletteState>((set, get) => ({
  isOpen: false,
  targetPtyId: null,
  targetTabName: null,
  drafts: {},
  textareaRef: null,
  lastInsertAt: 0,

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

  registerTextarea: (ref) => set({ textareaRef: ref }),

  insertAtCaret: (text) => {
    const state = get()
    const ptyId = state.targetPtyId
    const ta = state.textareaRef?.current
    if (!ptyId || !ta) return

    const length = ta.value.length
    const start = ta.selectionStart ?? length
    const end = ta.selectionEnd ?? length
    const safeStart = Math.min(Math.max(0, start), length)
    const safeEnd = Math.min(Math.max(safeStart, end), length)
    const before = ta.value.slice(0, safeStart)
    const after = ta.value.slice(safeEnd)
    const nextValue = before + text + after
    const caret = before.length + text.length

    set((s) => ({
      drafts: { ...s.drafts, [ptyId]: nextValue },
      lastInsertAt: s.lastInsertAt + 1,
    }))

    scheduleCaretRestore(() => get().textareaRef, caret)
  },
}))
