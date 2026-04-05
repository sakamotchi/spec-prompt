export type ShortcutCategory =
  | 'ペイン切り替え'
  | 'タブ操作'
  | '分割表示'
  | 'フォーカス移動'
  | 'その他'

export interface ShortcutDef {
  label: string
  /** ヘルプモーダルで表示するキーバッジの配列（例: ['⌘', 'T']） */
  keys: string[]
  category: ShortcutCategory
}

export const SHORTCUT_DEFS: ShortcutDef[] = [
  // ペイン切り替え
  { label: 'コンテンツ↔ターミナル切り替え', keys: ['Ctrl', 'Tab'], category: 'ペイン切り替え' },

  // タブ操作
  { label: 'コンテンツタブを新規作成', keys: ['⌘', 'T'], category: 'タブ操作' },
  { label: 'ターミナルタブを新規作成', keys: ['⌘', '⇧', 'T'], category: 'タブ操作' },
  { label: 'タブを閉じる', keys: ['⌘', 'W'], category: 'タブ操作' },
  { label: '前のタブへ移動', keys: ['Ctrl', '⇧', 'Tab'], category: 'タブ操作' },
  { label: 'n 番目のタブへ移動', keys: ['⌘', '1-9'], category: 'タブ操作' },

  // 分割表示
  { label: 'コンテンツ分割切り替え', keys: ['⌘', '\\'], category: '分割表示' },
  { label: 'ターミナル分割切り替え', keys: ['⌘', '⇧', '\\'], category: '分割表示' },
  { label: 'コンテンツ/ターミナル並列表示', keys: ['Ctrl', '\\'], category: '分割表示' },

  // フォーカス移動
  { label: 'ツリーパネルへフォーカス', keys: ['⌘', '0'], category: 'フォーカス移動' },

  // その他
  { label: 'パス検索パレット', keys: ['Ctrl', 'P'], category: 'その他' },
  { label: 'ショートカット一覧', keys: ['?'], category: 'その他' },
]
