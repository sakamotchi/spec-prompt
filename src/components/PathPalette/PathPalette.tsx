import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../stores/appStore'
import { usePathInsertion } from '../../hooks/usePathInsertion'
import type { FileNode } from '../../lib/tauriApi'

interface PathItem {
  path: string
  label: string
  relativePath: string
}

// ファイルツリーを平坦化して全ファイルのリストを作る
function flattenTree(nodes: FileNode[], projectRoot: string): PathItem[] {
  const result: PathItem[] = []
  const prefix = projectRoot.endsWith('/') ? projectRoot : projectRoot + '/'

  function walk(nodes: FileNode[]) {
    for (const node of nodes) {
      if (!node.is_dir) {
        result.push({
          path: node.path,
          label: node.name,
          relativePath: node.path.startsWith(prefix) ? node.path.slice(prefix.length) : node.path,
        })
      }
      if (node.children) walk(node.children)
    }
  }

  walk(nodes)
  return result
}

// 簡易 fuzzy マッチ：クエリの各文字が順番に含まれているか
function fuzzyMatch(item: PathItem, query: string): boolean {
  if (!query) return true
  const lower = item.relativePath.toLowerCase()
  const q = query.toLowerCase()
  let qi = 0
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) qi++
  }
  return qi === q.length
}

interface PathPaletteProps {
  open: boolean
  onClose: () => void
}

export function PathPalette({ open, onClose }: PathPaletteProps) {
  const { t } = useTranslation()
  const fileTree = useAppStore((s) => s.fileTree)
  const projectRoot = useAppStore((s) => s.projectRoot)
  const { insertPath } = usePathInsertion()

  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const allItems = useMemo(
    () => (projectRoot ? flattenTree(fileTree, projectRoot) : []),
    [fileTree, projectRoot],
  )

  const filtered = useMemo(() => {
    const matched = allItems.filter((item) => fuzzyMatch(item, query))
    return matched.slice(0, 100)
  }, [allItems, query])

  // クエリ変更時は先頭に戻す
  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  // 開いたときにリセット
  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIndex(0)
      // 少し遅らせてフォーカス
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const handleSelect = useCallback(
    (item: PathItem) => {
      insertPath(item.path)
      onClose()
    },
    [insertPath, onClose],
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[activeIndex]) handleSelect(filtered[activeIndex])
    }
  }

  // アクティブ項目をスクロール表示
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const item = list.children[activeIndex] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.5)' }}
        />
        <Dialog.Content
          className="fixed left-1/2 top-1/3 z-50 w-[560px] max-w-[90vw] rounded-lg shadow-2xl overflow-hidden"
          style={{
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border)',
            transform: 'translateX(-50%)',
          }}
          onKeyDown={handleKeyDown}
          onCloseAutoFocus={(e) => {
            e.preventDefault()
            window.dispatchEvent(new CustomEvent('terminal:focus'))
          }}
          aria-label={t('pathPalette.ariaLabel')}
        >
          {/* 検索入力 */}
          <div
            className="flex items-center gap-2 px-3 h-11 border-b"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <Search size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('pathPalette.placeholder')}
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: 'var(--color-text-primary)' }}
            />
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{t('pathPalette.hint')}</span>
          </div>

          {/* 候補一覧 */}
          <div
            ref={listRef}
            className="overflow-y-auto"
            style={{ maxHeight: '320px' }}
          >
            {filtered.length === 0 ? (
              <div
                className="flex items-center justify-center h-16 text-xs"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {t('pathPalette.noResults')}
              </div>
            ) : (
              filtered.map((item, i) => (
                <div
                  key={item.path}
                  onClick={() => handleSelect(item)}
                  className="flex items-center gap-2 px-3 h-8 cursor-pointer text-xs"
                  style={{
                    background: i === activeIndex ? 'var(--color-accent)' : 'transparent',
                    color: i === activeIndex ? '#fff' : 'var(--color-text-primary)',
                  }}
                  onMouseEnter={() => setActiveIndex(i)}
                >
                  <span className="truncate">{item.relativePath}</span>
                </div>
              ))
            )}
          </div>

          {/* フッター */}
          {filtered.length > 0 && (
            <div
              className="flex items-center justify-end px-3 h-7 border-t text-xs"
              style={{
                borderColor: 'var(--color-border)',
                color: 'var(--color-text-muted)',
              }}
            >
              {t('pathPalette.count', { count: filtered.length })}
              {allItems.length > 100 && allItems.length === filtered.length && t('pathPalette.countLimit')}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
