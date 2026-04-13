import type { BuiltinLanguage } from 'shiki'

/** 対応言語マップ（拡張子 → Shiki 言語 ID）。CodeViewer と MarkdownPreview で共有 */
export const EXT_TO_LANG: Record<string, BuiltinLanguage> = {
  ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
  mts: 'typescript', mjs: 'javascript', cjs: 'javascript',
  rs: 'rust', py: 'python', go: 'go', java: 'java',
  c: 'c', cpp: 'cpp', h: 'c', cs: 'csharp', rb: 'ruby',
  php: 'php', swift: 'swift', kt: 'kotlin',
  json: 'json', toml: 'toml', yaml: 'yaml', yml: 'yaml',
  css: 'css', scss: 'scss', html: 'html', xml: 'xml', sql: 'sql',
  sh: 'bash', bash: 'bash', zsh: 'bash', fish: 'fish', ps1: 'powershell',
}

/** 重複を除いた Shiki 言語 ID の配列 */
export const SHIKI_LANGS = Object.values(EXT_TO_LANG).filter((v, i, a) => a.indexOf(v) === i)
