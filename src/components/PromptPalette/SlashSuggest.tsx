import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import { usePromptPaletteStore } from '../../stores/promptPaletteStore'
import { parseSlashQuery } from '../../lib/slashQuery'
import {
  getSlashSuggestCandidates,
  type SlashSuggestItem,
  type SlashSuggestSection,
} from '../../lib/slashSuggestItem'
import { BUILT_IN_COMMANDS } from '../../lib/builtInCommands'

const MAX_PER_SECTION = 10

export interface SlashSuggestProps {
  /** 現在の draft（親コンポーネントが管理） */
  draft: string
  /** 候補選択時のハンドラ。親が kind に応じて流し込み/挿入処理を行う */
  onSelect: (item: SlashSuggestItem) => void
}

/**
 * 親から textarea の keydown を委譲するためのハンドル。
 * 親は `handleKeyDown(e)` を呼び、true が返ったら自身の後続処理を打ち切る。
 */
export interface SlashSuggestHandle {
  handleKeyDown: (e: React.KeyboardEvent) => boolean
}

/**
 * textarea の draft が `/` で始まり、改行・空白を含まない場合のみ表示される
 * インラインサジェスト。組み込みコマンド・バンドル Skill・テンプレートを
 * セクション毎に混在表示する。
 *
 * キーボード操作は親の textarea 側でも効かせたいため、`forwardRef` で
 * `handleKeyDown` を公開し、親が textarea の onKeyDown から委譲する。
 */
export const SlashSuggest = forwardRef<SlashSuggestHandle, SlashSuggestProps>(
  function SlashSuggest({ draft, onSelect }, ref) {
    const { t } = useTranslation()
    const templates = usePromptPaletteStore((s) => s.templates)

    const query = parseSlashQuery(draft)
    const isActive = query !== null

    const sections: SlashSuggestSection[] = useMemo(() => {
      if (!isActive) return []
      return getSlashSuggestCandidates({
        templates,
        builtIns: BUILT_IN_COMMANDS,
        query: query ?? '',
        maxPerSection: MAX_PER_SECTION,
      })
    }, [isActive, query, templates])

    /** セクションをフラットにした候補列（↑↓/Enter/Tab はグローバル index で管理） */
    const flatItems: SlashSuggestItem[] = useMemo(
      () => sections.flatMap((s) => s.items),
      [sections],
    )

    const [activeIndex, setActiveIndex] = useState(0)
    const listRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
      setActiveIndex(0)
    }, [query])

    // activeIndex が変わったら該当行をスクロールで可視範囲に入れる
    useEffect(() => {
      const list = listRef.current
      if (!list) return
      const row = list.querySelector<HTMLElement>(
        `[data-slash-index="${activeIndex}"]`,
      )
      if (!row) return
      // jsdom など scrollIntoView 未実装の環境は黙殺
      if (typeof row.scrollIntoView !== 'function') return
      row.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }, [activeIndex])

    /**
     * キー操作を処理し、自身で消費したかを bool で返す。
     * - ArrowDown/ArrowUp: activeIndex 更新
     * - Enter（修飾なし）: activeIndex の候補を確定
     * - Tab（Cmd/Ctrl/Alt なし、Shift 有無不問）: activeIndex の候補を確定
     * Cmd+Enter などの送信系修飾付きは親に委譲する。
     */
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent): boolean => {
        if (!isActive) return false
        if (flatItems.length === 0) return false
        if (e.nativeEvent.isComposing) return false

        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setActiveIndex((i) => Math.min(i + 1, flatItems.length - 1))
          return true
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          setActiveIndex((i) => Math.max(i - 1, 0))
          return true
        }
        if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey && !e.altKey) {
          const item = flatItems[activeIndex]
          if (item) {
            e.preventDefault()
            onSelect(item)
            return true
          }
        }
        if (e.key === 'Tab' && !e.metaKey && !e.ctrlKey && !e.altKey) {
          const item = flatItems[activeIndex]
          if (item) {
            e.preventDefault()
            onSelect(item)
            return true
          }
        }
        return false
      },
      [isActive, flatItems, activeIndex, onSelect],
    )

    useImperativeHandle(ref, () => ({ handleKeyDown }), [handleKeyDown])

    if (!isActive || flatItems.length === 0) return null

  let globalIndex = -1

  return (
    <div
      data-palette-dropdown="slash"
      role="listbox"
      aria-label="slash-suggest"
      onKeyDown={handleKeyDown}
      ref={listRef}
      className="rounded-md"
      style={{
        border: '1px solid var(--color-border)',
        background: 'var(--color-bg-panel)',
        marginBottom: '0.5rem',
        maxHeight: '40vh',
        overflowY: 'auto',
      }}
    >
      {sections.map((section) => (
        <div
          key={section.kind}
          role="group"
          aria-label={t(section.labelKey)}
          data-section={section.kind}
        >
          <div
            aria-hidden="true"
            className="px-3 py-1 text-[10px] uppercase tracking-wider"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {t(section.labelKey)}
          </div>
          {section.items.map((item) => {
            globalIndex += 1
            const isActiveRow = globalIndex === activeIndex
            const currentIndex = globalIndex
            return (
              <div
                key={itemKey(item)}
                role="option"
                aria-selected={isActiveRow}
                data-slash-index={currentIndex}
                onMouseEnter={() => setActiveIndex(currentIndex)}
                onClick={() => onSelect(item)}
                className="flex items-center gap-3 px-3 h-7 cursor-pointer text-xs"
                style={{
                  background: isActiveRow
                    ? 'var(--color-accent)'
                    : 'transparent',
                  color: isActiveRow ? '#fff' : 'var(--color-text-primary)',
                }}
              >
                <span
                  className="inline-flex items-center justify-center px-1.5 h-4 rounded text-[9px] font-semibold font-mono shrink-0"
                  style={{
                    background: isActiveRow
                      ? 'rgba(255,255,255,0.2)'
                      : 'var(--color-bg-elevated)',
                    color: isActiveRow
                      ? 'rgba(255,255,255,0.95)'
                      : 'var(--color-text-muted)',
                    minWidth: '2.25rem',
                  }}
                >
                  {t(section.badgeKey)}
                </span>
                <span className="font-semibold truncate max-w-[10rem]">
                  {item.name}
                </span>
                <span
                  className="truncate font-mono text-[10px] ml-auto"
                  style={{
                    color: isActiveRow
                      ? 'rgba(255,255,255,0.85)'
                      : 'var(--color-text-muted)',
                  }}
                >
                  {itemSubtext(item)}
                </span>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
  },
)

function itemKey(item: SlashSuggestItem): string {
  switch (item.kind) {
    case 'template':
      return `template:${item.id}`
    case 'builtin':
      return `builtin:${item.name}`
    case 'user-skill':
      return `user-skill:${item.path}`
    case 'project-skill':
      return `project-skill:${item.path}`
  }
}

function itemSubtext(item: SlashSuggestItem): string {
  switch (item.kind) {
    case 'template':
      return item.body.length > 30 ? item.body.slice(0, 30) + '…' : item.body
    case 'builtin':
      return item.description
    case 'user-skill':
    case 'project-skill':
      return item.description ?? ''
  }
}
