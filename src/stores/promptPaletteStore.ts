import type { RefObject } from 'react'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type PromptPaletteTextareaRef = RefObject<HTMLTextAreaElement | null>

export type PromptHistoryEntry = {
  id: string
  body: string
  createdAt: number
}

export type PromptTemplate = {
  id: string
  name: string
  body: string
  tags?: string[]
  updatedAt: number
}

export type DropdownKind = 'none' | 'history' | 'template'

export type PaletteEditorState =
  | { mode: 'create'; initialBody?: string }
  | { mode: 'edit'; templateId: string }
  | null

export type TemplateUpsertInput = Omit<PromptTemplate, 'id' | 'updatedAt'> &
  Partial<Pick<PromptTemplate, 'id'>>

export interface PromptPaletteState {
  isOpen: boolean
  targetPtyId: string | null
  targetTabName: string | null
  drafts: Record<string, string>
  textareaRef: PromptPaletteTextareaRef | null
  /** 挿入シグナル: insertAtCaret が成功するたび単調増加。UI のフラッシュ購読用 */
  lastInsertAt: number

  history: PromptHistoryEntry[]
  templates: PromptTemplate[]
  historyCursor: number | null
  dropdown: DropdownKind
  editorState: PaletteEditorState

  open: (ptyId: string, tabName: string) => void
  close: () => void
  setDraft: (ptyId: string, value: string) => void
  getDraft: (ptyId: string) => string
  clearDraft: (ptyId: string) => void

  registerTextarea: (ref: PromptPaletteTextareaRef | null) => void
  insertAtCaret: (text: string) => void

  pushHistory: (body: string) => void
  setHistoryCursor: (index: number | null) => void
  openDropdown: (kind: Exclude<DropdownKind, 'none'>) => void
  closeDropdown: () => void
  upsertTemplate: (template: TemplateUpsertInput) => PromptTemplate
  removeTemplate: (id: string) => void
  openEditor: (state: NonNullable<PaletteEditorState>) => void
  closeEditor: () => void
}

const HISTORY_LIMIT = 100
const PERSIST_KEY = 'spec-prompt:prompt-palette'

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
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

export const usePromptPaletteStore = create<PromptPaletteState>()(
  persist(
    (set, get) => ({
      isOpen: false,
      targetPtyId: null,
      targetTabName: null,
      drafts: {},
      textareaRef: null,
      lastInsertAt: 0,

      history: [],
      templates: [],
      historyCursor: null,
      dropdown: 'none',
      editorState: null,

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

      pushHistory: (body) =>
        set((s) => {
          const trimmed = body.replace(/\s+$/u, '')
          if (trimmed.length === 0) return s
          if (s.history[0]?.body === trimmed) return s
          const entry: PromptHistoryEntry = {
            id: generateId(),
            body: trimmed,
            createdAt: Date.now(),
          }
          const next = [entry, ...s.history].slice(0, HISTORY_LIMIT)
          return { history: next, historyCursor: null }
        }),

      setHistoryCursor: (index) =>
        set((s) => {
          if (index === null) return { historyCursor: null }
          if (index < 0 || index >= s.history.length) return { historyCursor: null }
          return { historyCursor: index }
        }),

      openDropdown: (kind) => set({ dropdown: kind }),
      closeDropdown: () => set({ dropdown: 'none' }),

      upsertTemplate: (input) => {
        const now = Date.now()
        const id = input.id ?? generateId()
        const template: PromptTemplate = {
          id,
          name: input.name,
          body: input.body,
          tags: input.tags,
          updatedAt: now,
        }
        set((s) => {
          const existing = s.templates.findIndex((t) => t.id === id)
          if (existing >= 0) {
            const next = s.templates.slice()
            next[existing] = template
            return { templates: next }
          }
          return { templates: [...s.templates, template] }
        })
        return template
      },

      removeTemplate: (id) =>
        set((s) => ({ templates: s.templates.filter((t) => t.id !== id) })),

      openEditor: (editorState) => set({ editorState }),
      closeEditor: () => set({ editorState: null }),
    }),
    {
      name: PERSIST_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        history: state.history,
        templates: state.templates,
      }),
    },
  ),
)
