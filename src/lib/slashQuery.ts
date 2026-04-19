/**
 * textarea の draft が行頭 `/` + 改行・空白を含まないトークンであれば
 * `/` 以降のクエリ文字列を返す。条件不一致なら null。
 *
 * 例:
 *   `/`       → ''
 *   `/rev`    → 'rev'
 *   `/rev pr` → null（空白あり）
 *   `hello`   → null（先頭でない）
 */
export function parseSlashQuery(draft: string): string | null {
  const match = /^\/(\S*)$/.exec(draft)
  return match ? match[1] : null
}
