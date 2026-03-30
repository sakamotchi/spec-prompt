import { useEffect, useRef, useState } from 'react'
import { renderMarkdown } from '../../lib/markdown'
import { openUrl } from '@tauri-apps/plugin-opener'

export function MarkdownPreview({ content }: { content: string }) {
  const [html, setHtml] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    renderMarkdown(content).then(setHtml)
  }, [content])

  // Mermaid レンダリング
  useEffect(() => {
    if (!html || !containerRef.current) return
    const els = containerRef.current.querySelectorAll<HTMLElement>(
      'code.language-mermaid, pre code.language-mermaid',
    )
    if (!els.length) return

    import('mermaid').then(({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, theme: 'dark' })
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
  }, [html])

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
      style={{ color: 'var(--color-text-primary)' }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
