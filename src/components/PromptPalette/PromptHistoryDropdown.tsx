import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  usePromptPaletteStore,
  type PromptHistoryEntry,
} from '../../stores/promptPaletteStore'

const PREVIEW_MAX = 80

function preview(body: string): string {
  const singleLine = body.replace(/\s*\n\s*/g, ' ↵ ')
  if (singleLine.length <= PREVIEW_MAX) return singleLine
  return singleLine.slice(0, PREVIEW_MAX) + '…'
}

function relativeTime(epochMs: number, now: number = Date.now()): string {
  const diffSec = Math.max(0, Math.floor((now - epochMs) / 1000))
  if (diffSec < 60) return `${diffSec} 秒前`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin} 分前`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour} 時間前`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) return `${diffDay} 日前`
  const d = new Date(epochMs)
  const m = (d.getMonth() + 1).toString().padStart(2, '0')
  const day = d.getDate().toString().padStart(2, '0')
  return `${m}/${day}`
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

export interface PromptHistoryDropdownProps {
  /** 選択直後のテスト用フック。省略時は `setDraft` + `closeDropdown` のみ */
  onAfterSelect?: (entry: PromptHistoryEntry) => void
}

export function PromptHistoryDropdown({ onAfterSelect }: PromptHistoryDropdownProps = {}) {
  const { t } = useTranslation()
  const history = usePromptPaletteStore((s) => s.history)

  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    if (!query) return history
    return history.filter((h) => fuzzyMatch(h.body, query))
  }, [history, query])

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
    (entry: PromptHistoryEntry) => {
      const state = usePromptPaletteStore.getState()
      const ptyId = state.targetPtyId
      if (!ptyId) return
      state.setDraft(ptyId, entry.body)
      state.setHistoryCursor(null)
      state.closeDropdown()
      onAfterSelect?.(entry)
      // textarea にフォーカスを戻し、キャレットを末尾へ
      requestAnimationFrame(() => {
        const ta = usePromptPaletteStore.getState().textareaRef?.current
        if (!ta) return
        ta.focus()
        const len = ta.value.length
        try {
          ta.setSelectionRange(len, len)
        } catch {
          // jsdom で setSelectionRange が未実装のケースを無視
        }
      })
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

  return (
    <div
      data-palette-dropdown="history"
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
          placeholder={t('promptPalette.history.searchPlaceholder')}
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: 'var(--color-text-primary)' }}
          aria-label={t('promptPalette.history.searchPlaceholder')}
        />
      </div>

      {/* 候補一覧 */}
      <div
        ref={listRef}
        role="listbox"
        aria-label={t('promptPalette.history.ariaLabel')}
        className="overflow-y-auto"
        style={{ maxHeight: '240px' }}
      >
        {filtered.length === 0 ? (
          <div
            className="flex items-center justify-center h-14 text-xs"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {t('promptPalette.history.empty')}
          </div>
        ) : (
          filtered.map((entry, i) => (
            <div
              key={entry.id}
              role="option"
              aria-selected={i === activeIndex}
              onClick={() => handleSelect(entry)}
              onMouseEnter={() => setActiveIndex(i)}
              className="flex items-center justify-between gap-3 px-3 h-8 cursor-pointer text-xs"
              style={{
                background: i === activeIndex ? 'var(--color-accent)' : 'transparent',
                color: i === activeIndex ? '#fff' : 'var(--color-text-primary)',
              }}
            >
              <span
                className="truncate font-mono"
                style={{ minWidth: 0, flex: 1 }}
              >
                {preview(entry.body)}
              </span>
              <span
                className="flex-shrink-0 text-[10px]"
                style={{
                  color:
                    i === activeIndex
                      ? 'rgba(255,255,255,0.8)'
                      : 'var(--color-text-muted)',
                }}
              >
                {relativeTime(entry.createdAt)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
