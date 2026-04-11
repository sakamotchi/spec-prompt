import { useEffect, useRef, useState } from 'react'
import { renderMarkdown } from '../../lib/markdown'
import { openUrl } from '@tauri-apps/plugin-opener'
import { useSettingsStore } from '../../stores/settingsStore'
import { useContentStore } from '../../stores/contentStore'
import { toFontFamilyCSS } from '../../lib/fontFamily'

function resolveRelativePath(basePath: string, href: string): string {
  const parts = basePath.split('/')
  parts.pop() // ファイル名を除いてディレクトリ部分だけにする
  for (const segment of href.split('/')) {
    if (segment === '..') parts.pop()
    else if (segment !== '.') parts.push(segment)
  }
  return parts.join('/')
}

export function MarkdownPreview({ content, filePath }: { content: string; filePath?: string }) {
  const [html, setHtml] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const openFile = useContentStore((s) => s.openFile)
  const theme = useSettingsStore((s) => s.theme)
  const contentFontFamily = useSettingsStore((s) => s.contentFontFamily)
  const contentFontSize = useSettingsStore((s) => s.contentFontSize)

  const resolvedTheme = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme
  const shikiTheme = resolvedTheme === 'dark' ? 'github-dark' : 'github-light'

  useEffect(() => {
    renderMarkdown(content, shikiTheme).then(setHtml)
  }, [content, shikiTheme])

  // Mermaid レンダリング
  useEffect(() => {
    if (!html || !containerRef.current) return
    const els = containerRef.current.querySelectorAll<HTMLElement>(
      'code.language-mermaid, pre code.language-mermaid',
    )
    if (!els.length) return

    import('mermaid').then(({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, theme: resolvedTheme === 'dark' ? 'dark' : 'default' })
      els.forEach(async (el) => {
        const code = el.textContent ?? ''
        const id = `mermaid-${Math.random().toString(36).slice(2)}`
        try {
          const { svg } = await mermaid.render(id, code)
          const wrapper = el.closest('pre') ?? el
          wrapper.outerHTML = `<div class="mermaid-diagram">${svg}</div>`
        } catch {
          // 構文エラーでもクラッシュしない
        }
      })
    })
  }, [html, resolvedTheme])

  // リンクのクリックを制御する
  // - http/https → デフォルトブラウザで開く
  // - #hash     → ページ内スクロール
  // - 相対パス  → アプリ内タブで開く
  // それ以外も含めて必ず preventDefault し WebView ナビゲーションを防ぐ
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a')
      if (!a) return
      const href = a.getAttribute('href')
      if (!href) return
      e.preventDefault()
      if (href.startsWith('http://') || href.startsWith('https://')) {
        openUrl(href)
      } else if (href.startsWith('#')) {
        container.querySelector(decodeURIComponent(href))?.scrollIntoView({ behavior: 'smooth' })
      } else if (filePath) {
        openFile(resolveRelativePath(filePath, href))
      }
    }
    container.addEventListener('click', onClick)
    return () => container.removeEventListener('click', onClick)
  }, [html, filePath, openFile])

  return (
    <div
      ref={containerRef}
      className="markdown-preview h-full overflow-y-auto px-8 py-6"
      style={{
        color: 'var(--color-text-primary)',
        fontFamily: toFontFamilyCSS(contentFontFamily, 'sans-serif'),
        fontSize: `${contentFontSize}px`,
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
