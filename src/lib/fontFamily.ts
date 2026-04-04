const GENERIC_FAMILIES = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
  'emoji',
  'math',
  'fangsong',
])

function normalizeFontToken(token: string): string {
  const trimmed = token.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('"') || trimmed.startsWith("'")) return trimmed
  if (GENERIC_FAMILIES.has(trimmed.toLowerCase())) return trimmed
  return /\s/.test(trimmed) ? `"${trimmed}"` : trimmed
}

export function toFontFamilyCSS(fontFamily: string, fallback?: string): string {
  const tokens = fontFamily
    .split(',')
    .map(normalizeFontToken)
    .filter(Boolean)

  if (fallback) {
    tokens.push(...fallback.split(',').map(normalizeFontToken).filter(Boolean))
  }

  return tokens.join(', ')
}
