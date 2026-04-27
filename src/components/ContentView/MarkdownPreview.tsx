import { useEffect, useRef, useState } from 'react'
import { renderMarkdown } from '../../lib/markdown'
import { openUrl } from '@tauri-apps/plugin-opener'
import { convertFileSrc } from '@tauri-apps/api/core'
import { useSettingsStore } from '../../stores/settingsStore'
import { useContentStore } from '../../stores/contentStore'
import { toFontFamilyCSS } from '../../lib/fontFamily'
import { useTabScroll } from './useTabScroll'

const HTML_ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => HTML_ESCAPE[c]!)
}

function resolveRelativePath(basePath: string, href: string): string {
  const parts = basePath.split('/')
  parts.pop() // ファイル名を除いてディレクトリ部分だけにする
  for (const segment of href.split('/')) {
    if (segment === '..') parts.pop()
    else if (segment !== '.') parts.push(segment)
  }
  return parts.join('/')
}

export function MarkdownPreview({
  tabId,
  content,
  filePath,
}: {
  tabId: string
  content: string
  filePath?: string
}) {
  const [html, setHtml] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  useTabScroll(tabId, containerRef, [html])

  const openFile = useContentStore((s) => s.openFile)
  const theme = useSettingsStore((s) => s.theme)
  const contentFontFamily = useSettingsStore((s) => s.contentFontFamily)
  const contentFontSize = useSettingsStore((s) => s.contentFontSize)

  const resolvedTheme = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme
  const shikiTheme = resolvedTheme === 'dark' ? 'github-dark' : 'github-light'

  // 描画前に Mermaid を SVG 化し、結果を html state に含めて setState する。
  // 外部 DOM 改変方式だと、親再レンダー時に React が dangerouslySetInnerHTML を
  // 同一文字列でも再適用して巻き戻すため、SVG が消えて元のコード表示に戻ってしまう。
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const baseHtml = await renderMarkdown(content, shikiTheme)
      if (cancelled) return

      if (!/language-mermaid/.test(baseHtml)) {
        setHtml(baseHtml)
        return
      }

      const stage = document.createElement('div')
      stage.innerHTML = baseHtml
      const els = stage.querySelectorAll<HTMLElement>(
        'code.language-mermaid, pre code.language-mermaid',
      )

      const { default: mermaid } = await import('mermaid')
      if (cancelled) return
      mermaid.initialize({
        startOnLoad: false,
        theme: resolvedTheme === 'dark' ? 'dark' : 'default',
      })

      for (const el of Array.from(els)) {
        const code = el.textContent ?? ''
        const id = `mermaid-${Math.random().toString(36).slice(2)}`
        const wrapper = el.closest('pre') ?? el
        try {
          const { svg } = await mermaid.render(id, code)
          wrapper.outerHTML = `<div class="mermaid-diagram">${svg}</div>`
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          wrapper.outerHTML = `<div class="mermaid-error" role="alert"><div class="mermaid-error-title">Mermaid 構文エラー</div><pre class="mermaid-error-message">${escapeHtml(message)}</pre><details class="mermaid-error-source"><summary>元のコード</summary><pre><code>${escapeHtml(code)}</code></pre></details></div>`
          // mermaid.render が失敗時に DOM 末尾へ残す一時要素を掃除
          document.getElementById(id)?.remove()
          document.getElementById(`d${id}`)?.remove()
        }
      }

      if (!cancelled) setHtml(stage.innerHTML)
    })()
    return () => {
      cancelled = true
    }
  }, [content, shikiTheme, resolvedTheme])

  // <img> の src をローカルファイル参照から Tauri の asset プロトコル URL に書き換える。
  // WebView は file://・相対パスを直接読めないため、convertFileSrc でカスタムスキームに変換する。
  useEffect(() => {
    if (!html || !containerRef.current) return
    const imgs = containerRef.current.querySelectorAll<HTMLImageElement>('img')
    imgs.forEach((img) => {
      const raw = img.getAttribute('src')
      if (!raw) return
      if (/^(https?:|data:|asset:|tauri:|blob:)/i.test(raw)) return
      let absolute: string
      if (raw.startsWith('/')) {
        absolute = raw
      } else if (filePath) {
        absolute = resolveRelativePath(filePath, raw)
      } else {
        return
      }
      img.setAttribute('src', convertFileSrc(absolute))
    })
  }, [html, filePath])

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
