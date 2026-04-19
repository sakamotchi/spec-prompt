/**
 * プロンプトテンプレート本文中のプレースホルダ `{{name}}` を検出するユーティリティ。
 *
 * Phase 1 スコープではエスケープ記法（`\{\{`）は非対応。
 * 必要になれば後続フェーズで正規表現を拡張する。
 */

export type Placeholder = {
  /** 本文内の開始オフセット（0-indexed） */
  start: number
  /** 本文内の終了オフセット（exclusive） */
  end: number
  /** `{{` と `}}` の間の文字列（スペースは含んだまま） */
  name: string
}

const PLACEHOLDER_RE = /\{\{([^{}]+)\}\}/g

/** 本文中のプレースホルダを出現順に返す */
export function parsePlaceholders(body: string): Placeholder[] {
  const out: Placeholder[] = []
  const re = new RegExp(PLACEHOLDER_RE.source, PLACEHOLDER_RE.flags)
  let match: RegExpExecArray | null
  while ((match = re.exec(body)) !== null) {
    out.push({
      start: match.index,
      end: match.index + match[0].length,
      name: match[1],
    })
  }
  return out
}

/**
 * 指定キャレット位置以降に出現する次のプレースホルダを返す。
 * 境界: start >= caret を満たす最初のプレースホルダ。見つからなければ null。
 */
export function findNextPlaceholder(
  body: string,
  caret: number,
): Placeholder | null {
  const all = parsePlaceholders(body)
  for (const p of all) {
    if (p.start >= caret) return p
  }
  return null
}

/**
 * 指定キャレット位置より前に出現する直近のプレースホルダを返す。
 * 境界: end <= caret を満たす最後のプレースホルダ。見つからなければ null。
 * Shift+Tab による逆方向遷移用。
 */
export function findPreviousPlaceholder(
  body: string,
  caret: number,
): Placeholder | null {
  const all = parsePlaceholders(body)
  let result: Placeholder | null = null
  for (const p of all) {
    if (p.end <= caret) result = p
    else break
  }
  return result
}
