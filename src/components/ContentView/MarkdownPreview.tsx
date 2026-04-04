import { useEffect, useRef, useState } from 'react'
import { renderMarkdown } from '../../lib/markdown'
import { openUrl } from '@tauri-apps/plugin-opener'
import { useSettingsStore } from '../../stores/settingsStore'
import { toFontFamilyCSS } from '../../lib/fontFamily'

export function MarkdownPreview({ content }: { content: string }) {
  const [html, setHtml] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

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

  // 外部リンクをデフォルトブラウザで開く
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a')
      if (!a) return
      const href = a.getAttribute('href')
      if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
        e.preventDefault()
        openUrl(href)
      }
    }
    container.addEventListener('click', onClick)
    return () => container.removeEventListener('click', onClick)
  }, [html])

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
