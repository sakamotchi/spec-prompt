export type ViewMode = 'markdown' | 'code' | 'image' | 'plain'

const MARKDOWN_EXTS = new Set(['md', 'mdx'])

const CODE_EXTS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mts', 'mjs', 'cjs',
  'rs', 'py', 'go', 'java', 'c', 'cpp', 'h', 'cs', 'rb', 'php', 'swift', 'kt',
  'json', 'toml', 'yaml', 'yml', 'css', 'scss', 'html', 'xml', 'sql',
  'sh', 'bash', 'zsh', 'fish', 'ps1',
])

const IMAGE_EXTS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'avif', 'svg',
])

export function getViewMode(filePath: string): ViewMode {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  if (MARKDOWN_EXTS.has(ext)) return 'markdown'
  if (CODE_EXTS.has(ext)) return 'code'
  if (IMAGE_EXTS.has(ext)) return 'image'
  return 'plain'
}
