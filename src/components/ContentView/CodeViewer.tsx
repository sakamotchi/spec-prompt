import { useEffect, useState } from 'react'
import { createHighlighter } from 'shiki'
import { useSettingsStore } from '../../stores/settingsStore'
import { toFontFamilyCSS } from '../../lib/fontFamily'

// 対応言語マップ（拡張子 → Shiki 言語 ID）
const EXT_TO_LANG: Record<string, string> = {
  ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
  mts: 'typescript', mjs: 'javascript', cjs: 'javascript',
  rs: 'rust', py: 'python', go: 'go', java: 'java',
  c: 'c', cpp: 'cpp', h: 'c', cs: 'csharp', rb: 'ruby',
  php: 'php', swift: 'swift', kt: 'kotlin',
  json: 'json', toml: 'toml', yaml: 'yaml', yml: 'yaml',
  css: 'css', scss: 'scss', html: 'html', xml: 'xml', sql: 'sql',
  sh: 'bash', bash: 'bash', zsh: 'bash', fish: 'fish', ps1: 'powershell',
}

let highlighterPromise: ReturnType<typeof createHighlighter> | null = null

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['github-dark'],
      langs: Object.values(EXT_TO_LANG).filter((v, i, a) => a.indexOf(v) === i),
    })
  }
  return highlighterPromise
}

export function CodeViewer({ content, filePath }: { content: string; filePath: string }) {
  const [html, setHtml] = useState('')
  const [lineCount, setLineCount] = useState(0)
  const contentFontFamily = useSettingsStore((s) => s.contentFontFamily)
  const contentFontSize = useSettingsStore((s) => s.contentFontSize)

  useEffect(() => {
    const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
    const lang = EXT_TO_LANG[ext] ?? 'text'

    getHighlighter().then((highlighter) => {
      const result = highlighter.codeToHtml(content, {
        lang,
        theme: 'github-dark',
      })
      setHtml(result)
      setLineCount((result.match(/class="line"/g) ?? []).length)
    })
  }, [content, filePath])

  if (!html) return null

  const fontFamily = toFontFamilyCSS(contentFontFamily, 'sans-serif')
  const fontSize = `${contentFontSize}px`

  return (
    <div
      className="h-full overflow-auto flex text-sm"
      style={{
        background: 'var(--color-bg-base)',
        ['--content-font-family' as string]: fontFamily,
        ['--content-font-size' as string]: fontSize,
      } as React.CSSProperties}
    >
      {/* 行番号列: 選択範囲から切り離した別要素として描画 */}
      <div
        aria-hidden
        style={{
          flexShrink: 0,
          width: '3.5em',
          padding: '1em 0.5em 1em 1em',
          textAlign: 'right',
          lineHeight: 1.6,
          fontSize,
          fontFamily,
          color: '#555',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          pointerEvents: 'none',
          position: 'sticky',
          left: 0,
          background: 'var(--color-bg-base)',
        }}
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>

      {/* コード本体 */}
      <div
        style={{ flex: 1 }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}
