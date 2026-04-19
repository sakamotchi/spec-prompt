import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  usePromptPaletteStore,
  type PromptTemplate,
} from '../../stores/promptPaletteStore'
import { applyTemplateBodyToDraft } from '../../lib/templateApply'

const PREVIEW_MAX = 40

function preview(body: string): string {
  const singleLine = body.replace(/\s*\n\s*/g, ' ↵ ')
  if (singleLine.length <= PREVIEW_MAX) return singleLine
  return singleLine.slice(0, PREVIEW_MAX) + '…'
}

function fuzzyMatch(text: string, query: string): boolean {
  if (!query) return true
  const lower = text.toLowerCase()
  const q = query.toLowerCase()
  let qi = 0
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) qi++
  }
  return qi === q.length
}

export interface PromptTemplateDropdownProps {
  onAfterSelect?: (template: PromptTemplate) => void
}

export function PromptTemplateDropdown({
  onAfterSelect,
}: PromptTemplateDropdownProps = {}) {
  const { t } = useTranslation()
  const templates = usePromptPaletteStore((s) => s.templates)

  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const sorted = useMemo(
    () => [...templates].sort((a, b) => a.name.localeCompare(b.name)),
    [templates],
  )

  const filtered = useMemo(() => {
    if (!query) return sorted
    return sorted.filter(
      (tpl) => fuzzyMatch(tpl.name, query) || fuzzyMatch(tpl.body, query),
    )
  }, [sorted, query])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  useEffect(() => {
    const id = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const item = list.children[activeIndex] as HTMLElement | undefined
    if (item && typeof item.scrollIntoView === 'function') {
      item.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex])

  const handleSelect = useCallback(
    (tpl: PromptTemplate) => {
      applyTemplateBodyToDraft(tpl.body)
      onAfterSelect?.(tpl)
    },
    [onAfterSelect],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        usePromptPaletteStore.getState().closeDropdown()
        const ta = usePromptPaletteStore.getState().textareaRef?.current
        if (ta) requestAnimationFrame(() => ta.focus())
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, Math.max(0, filtered.length - 1)))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const entry = filtered[activeIndex]
        if (entry) handleSelect(entry)
        return
      }
    },
    [filtered, activeIndex, handleSelect],
  )

  const handleCreate = useCallback(() => {
    usePromptPaletteStore.getState().closeDropdown()
    usePromptPaletteStore.getState().openEditor({ mode: 'create' })
  }, [])

  const handleEdit = useCallback((tpl: PromptTemplate) => {
    usePromptPaletteStore.getState().closeDropdown()
    usePromptPaletteStore
      .getState()
      .openEditor({ mode: 'edit', templateId: tpl.id })
  }, [])

  const confirmDelete = useCallback(() => {
    if (!deleteTargetId) return
    usePromptPaletteStore.getState().removeTemplate(deleteTargetId)
    setDeleteTargetId(null)
  }, [deleteTargetId])

  return (
    <div
      data-palette-dropdown="template"
      className="rounded-md overflow-hidden"
      style={{
        border: '1px solid var(--color-border)',
        background: 'var(--color-bg-panel)',
        marginBottom: '0.5rem',
      }}
      onKeyDown={handleKeyDown}
    >
      {/* 検索入力 */}
      <div
        className="flex items-center gap-2 px-3 h-9 border-b"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <Search
          size={14}
          style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}
        />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('promptPalette.template.searchPlaceholder')}
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: 'var(--color-text-primary)' }}
          aria-label={t('promptPalette.template.searchPlaceholder')}
        />
      </div>

      {/* 候補一覧 */}
      <div
        ref={listRef}
        role="listbox"
        aria-label={t('promptPalette.template.ariaLabel')}
        className="overflow-y-auto"
        style={{ maxHeight: '240px' }}
      >
        {filtered.length === 0 ? (
          <div
            className="flex items-center justify-center h-14 text-xs"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {t('promptPalette.template.empty')}
          </div>
        ) : (
          filtered.map((tpl, i) => {
            const isActive = i === activeIndex
            return (
              <div
                key={tpl.id}
                role="option"
                aria-selected={isActive}
                onClick={() => handleSelect(tpl)}
                onMouseEnter={() => setActiveIndex(i)}
                className="group flex items-center justify-between gap-3 px-3 h-9 cursor-pointer text-xs"
                style={{
                  background: isActive ? 'var(--color-accent)' : 'transparent',
                  color: isActive ? '#fff' : 'var(--color-text-primary)',
                }}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="font-semibold truncate max-w-[10rem]">
                    {tpl.name}
                  </span>
                  <span
                    className="truncate font-mono text-[10px]"
                    style={{
                      color: isActive
                        ? 'rgba(255,255,255,0.85)'
                        : 'var(--color-text-muted)',
                    }}
                  >
                    {preview(tpl.body)}
                  </span>
                </div>
                <div
                  className="flex items-center gap-1 flex-shrink-0"
                  style={{ opacity: isActive ? 1 : 0 }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget
                    el.style.opacity = '1'
                  }}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleEdit(tpl)
                    }}
                    aria-label={t('promptPalette.template.edit')}
                    title={t('promptPalette.template.edit')}
                    className="flex items-center justify-center w-6 h-6 rounded"
                    style={{
                      color: isActive ? '#fff' : 'var(--color-text-muted)',
                    }}
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleteTargetId(tpl.id)
                    }}
                    aria-label={t('promptPalette.template.delete')}
                    title={t('promptPalette.template.delete')}
                    className="flex items-center justify-center w-6 h-6 rounded"
                    style={{
                      color: isActive ? '#fff' : 'var(--color-text-muted)',
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* 新規作成ボタン */}
      <div
        className="flex items-center justify-center h-9 border-t cursor-pointer text-xs"
        style={{
          borderColor: 'var(--color-border)',
          color: 'var(--color-text-primary)',
        }}
        onClick={handleCreate}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            handleCreate()
          }}
          className="flex items-center gap-2 px-3 h-full"
          style={{ color: 'var(--color-accent)' }}
        >
          <Plus size={12} />
          <span>{t('promptPalette.template.new')}</span>
        </button>
      </div>

      {/* 削除確認 */}
      <AlertDialog.Root
        open={deleteTargetId !== null}
        onOpenChange={(o) => !o && setDeleteTargetId(null)}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay
            className="fixed inset-0 z-[60]"
            style={{ background: 'rgba(0,0,0,0.5)' }}
          />
          <AlertDialog.Content
            className="fixed left-1/2 top-1/2 z-[70] w-[380px] max-w-[90vw] rounded-lg p-4"
            style={{
              background: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border)',
              transform: 'translate(-50%, -50%)',
              color: 'var(--color-text-primary)',
            }}
          >
            <AlertDialog.Title className="text-sm font-semibold mb-2">
              {t('promptPalette.template.delete')}
            </AlertDialog.Title>
            <AlertDialog.Description
              className="text-xs mb-4"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {t('promptPalette.template.editor.deleteConfirm')}
            </AlertDialog.Description>
            <div className="flex justify-end gap-2">
              <AlertDialog.Cancel asChild>
                <button
                  type="button"
                  className="px-3 h-7 rounded text-xs"
                  style={{
                    color: 'var(--color-text-muted)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  {t('promptPalette.template.editor.cancel')}
                </button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="px-3 h-7 rounded text-xs font-semibold"
                  style={{ background: '#dc2626', color: '#fff' }}
                >
                  {t('promptPalette.template.delete')}
                </button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  )
}
