export type DocStatus = 'draft' | 'reviewing' | 'approved'

export const DOC_STATUS_LABEL: Record<DocStatus, string> = {
  draft: '草稿',
  reviewing: 'レビュー中',
  approved: '承認済',
}

export const DOC_STATUS_COLOR: Record<DocStatus, string> = {
  draft: '#6b7280',
  reviewing: '#eab308',
  approved: '#22c55e',
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

export function parseStatus(content: string): DocStatus | null {
  const match = content.match(FRONTMATTER_RE)
  if (!match) return null
  const m = match[1].match(/^status:\s*(\S+)/m)
  if (!m) return null
  const s = m[1]
  return s === 'draft' || s === 'reviewing' || s === 'approved' ? s : null
}

export function setStatus(content: string, status: DocStatus): string {
  const match = content.match(FRONTMATTER_RE)
  if (match) {
    const fm = match[1]
    const updated = /^status:/m.test(fm)
      ? fm.replace(/^status:.*$/m, `status: ${status}`)
      : `${fm}\nstatus: ${status}`
    return content.replace(match[0], `---\n${updated}\n---\n`)
  }
  return `---\nstatus: ${status}\n---\n\n${content}`
}
