/**
 * 旧 localStorage キーから新キーへ値を移行する。
 * SpecPrompt → SDDesk 改名（2026-04-21）に伴うマイグレーション用。
 *
 * 動作:
 *   1. 旧キーの値が存在しなければ何もしない
 *   2. 新キーに値が無ければ旧の値をコピー（既存値は保護）
 *   3. 旧キーは削除
 */
export function migrateLegacyKey(oldKey: string, newKey: string): void {
  if (oldKey === newKey) return
  const legacyValue = localStorage.getItem(oldKey)
  if (legacyValue === null) return
  if (localStorage.getItem(newKey) === null) {
    localStorage.setItem(newKey, legacyValue)
  }
  localStorage.removeItem(oldKey)
}

/**
 * 旧プレフィックスを持つ全キーを新プレフィックスへ一括移行する。
 * windowSession の `specprompt-win-*` → `sddesk-win-*` のような用途。
 *
 * 各キーごとに `migrateLegacyKey` と同じセマンティクス（新キーが既存なら保護）。
 */
export function migrateLegacyKeyPrefix(oldPrefix: string, newPrefix: string): void {
  if (oldPrefix === newPrefix) return
  const matchingKeys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(oldPrefix)) matchingKeys.push(key)
  }
  for (const oldKey of matchingKeys) {
    const suffix = oldKey.slice(oldPrefix.length)
    const newKey = newPrefix + suffix
    migrateLegacyKey(oldKey, newKey)
  }
}
