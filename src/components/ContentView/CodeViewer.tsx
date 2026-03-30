import { useEffect, useState } from 'react'
import { createHighlighter } from 'shiki'

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

  useEffect(() => {
    const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
    const lang = EXT_TO_LANG[ext] ?? 'text'

    getHighlighter().then((highlighter) => {
      const result = highlighter.codeToHtml(content, {
        lang,
        theme: 'github-dark',
      })
      setHtml(result)
    })
  }, [content, filePath])

  if (!html) return null

  return (
    <div
      className="h-full overflow-auto text-sm"
      style={{ background: 'var(--color-bg-base)' }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
