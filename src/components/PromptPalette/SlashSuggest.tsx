import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  usePromptPaletteStore,
  type PromptTemplate,
} from '../../stores/promptPaletteStore'
import { parseSlashQuery } from '../../lib/slashQuery'

const MAX_SUGGESTIONS = 10

/**
 * textarea の draft が `/` で始まり、改行・空白を含まない場合のみ表示される
 * インラインテンプレートサジェスト。
 */
export interface SlashSuggestProps {
  /** 現在の draft（親コンポーネントが管理） */
  draft: string
  /** 選択時に呼ばれる。親が全文置換＋プレースホルダ選択状態化を行う想定 */
  onSelect: (template: PromptTemplate) => void
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

export function SlashSuggest({ draft, onSelect }: SlashSuggestProps) {
  const { t } = useTranslation()
  const templates = usePromptPaletteStore((s) => s.templates)

  const query = parseSlashQuery(draft)
  const isActive = query !== null

  const candidates = useMemo<PromptTemplate[]>(() => {
    if (!isActive) return []
    const q = query ?? ''
    const sorted = [...templates].sort((a, b) => a.name.localeCompare(b.name))
    if (!q) return sorted.slice(0, MAX_SUGGESTIONS)
    return sorted.filter((tpl) => fuzzyMatch(tpl.name, q)).slice(0, MAX_SUGGESTIONS)
  }, [templates, query, isActive])

  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isActive) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, Math.max(0, candidates.length - 1)))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        if (candidates[activeIndex]) {
          e.preventDefault()
          onSelect(candidates[activeIndex])
        }
      }
    },
    [isActive, candidates, activeIndex, onSelect],
  )

  if (!isActive || candidates.length === 0) return null

  return (
    <div
      data-palette-dropdown="slash"
      role="listbox"
      aria-label="slash-suggest"
      onKeyDown={handleKeyDown}
      className="rounded-md overflow-hidden"
      style={{
        border: '1px solid var(--color-border)',
        background: 'var(--color-bg-panel)',
        marginBottom: '0.5rem',
      }}
    >
      <div
        className="px-3 py-1 text-[10px]"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {t('promptPalette.template.title')}
      </div>
      {candidates.map((tpl, i) => (
        <div
          key={tpl.id}
          role="option"
          aria-selected={i === activeIndex}
          onMouseEnter={() => setActiveIndex(i)}
          onClick={() => onSelect(tpl)}
          className="flex items-center justify-between gap-3 px-3 h-7 cursor-pointer text-xs"
          style={{
            background:
              i === activeIndex ? 'var(--color-accent)' : 'transparent',
            color: i === activeIndex ? '#fff' : 'var(--color-text-primary)',
          }}
        >
          <span className="font-semibold truncate max-w-[10rem]">{tpl.name}</span>
          <span
            className="truncate font-mono text-[10px]"
            style={{
              color:
                i === activeIndex
                  ? 'rgba(255,255,255,0.85)'
                  : 'var(--color-text-muted)',
            }}
          >
            {tpl.body.length > 30 ? tpl.body.slice(0, 30) + '…' : tpl.body}
          </span>
        </div>
      ))}
    </div>
  )
}
