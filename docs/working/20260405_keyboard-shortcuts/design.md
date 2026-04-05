# 設計書 - Phase 3-C: キーボードショートカット整備

## アーキテクチャ

### 対象コンポーネント

```
Frontend (React/TypeScript)
  ├── src/lib/shortcuts.ts          ← ショートカット定義（定数）
  ├── src/App.tsx                   ← グローバル keydown リスナー
  ├── src/components/ContentView/ContentTabs.tsx   ← タブ操作
  ├── src/components/TerminalPanel/TerminalTabs.tsx ← タブ操作
  └── src/components/KeyboardShortcuts/ShortcutsModal.tsx ← ヘルプUI
```

バックエンド（Rust）への変更なし。すべてフロントエンドのみで完結する。

### 影響範囲

- **フロントエンド**: `App.tsx`、`ContentTabs.tsx`、`TerminalTabs.tsx`、`contentStore.ts`、`terminalStore.ts`
- **バックエンド（Rust）**: 変更なし

---

## 実装方針

### 概要

1. ショートカット定義を `src/lib/shortcuts.ts` に集約し、ヘルプ一覧と実ハンドラが同じ定数を参照する設計にする
2. グローバルキーハンドラを `App.tsx` の `useEffect` で登録し、`keydown` イベントを捕捉する
3. xterm.js にフォーカスがある場合はターミナル内のキー入力を妨げないよう、イベントターゲットを確認してハンドラをスキップする
4. ショートカット一覧モーダルは Radix UI Dialog を使用して実装する

### 詳細

1. **`shortcuts.ts` — 定義集約**
   - `ShortcutItem` 型を定義し、`key`, `modifiers`, `label`, `category`, `action` を持つ配列を export する
   - この配列をグローバルハンドラとヘルプモーダルの両方が参照する

2. **グローバルキーハンドラ**
   - `App.tsx` の `useEffect` で `window.addEventListener('keydown', handler)` を登録
   - `e.target` が `INPUT`, `TEXTAREA` または `.xterm-helper-textarea` の場合はスキップ
   - `?` キー（Shift なし）でヘルプモーダルの open/close を切り替える

3. **タブ操作**
   - `contentStore` / `terminalStore` に `addTab()` / `closeActiveTab()` アクションを追加
   - グローバルハンドラからアクティブなペイン（コンテンツ or ターミナル）を判断してアクションを呼ぶ

4. **分割切り替え**
   - `contentStore` / `terminalStore` の既存 `toggleSplit()` を呼び出す

5. **ヘルプモーダル**
   - `ShortcutsModal` コンポーネントが `SHORTCUTS` 定数を受け取り、`category` でグループ化して表示する

---

## データ構造

### 型定義（TypeScript）

```typescript
// src/lib/shortcuts.ts

export type ShortcutCategory =
  | 'タブ操作'
  | 'ペイン切り替え'
  | '分割表示'
  | 'フォーカス移動'
  | 'ヘルプ'

export interface ShortcutItem {
  /** 表示用ラベル */
  label: string
  /** キー文字列（例: 'T', 'W', '?', '\\'） */
  key: string
  /** 修飾キー */
  modifiers: {
    meta?: boolean   // Cmd (macOS)
    ctrl?: boolean
    shift?: boolean
    alt?: boolean
  }
  /** ヘルプ表示用カテゴリ */
  category: ShortcutCategory
  /**
   * ハンドラ。グローバル keydown で呼ばれる。
   * タブ内の入力欄にフォーカスがある場合はスキップされる。
   */
  handler: () => void
}
```

### ショートカット一覧（設計値）

| カテゴリ | キー | 操作 |
|---------|------|------|
| ペイン切り替え | `Ctrl+Tab` | コンテンツ↔ターミナル切り替え（既存） |
| タブ操作 | `Cmd+T` | コンテンツタブを新規作成 |
| タブ操作 | `Cmd+Shift+T` | ターミナルタブを新規作成 |
| タブ操作 | `Cmd+W` | アクティブタブを閉じる |
| タブ操作 | `Cmd+1`～`Cmd+9` | n番目のタブをアクティブ化 |
| タブ操作 | `Ctrl+Tab` | 次のタブへ移動 ※ペイン切り替えと共有 |
| タブ操作 | `Ctrl+Shift+Tab` | 前のタブへ移動 |
| 分割表示 | `Cmd+\` | コンテンツペインの分割/統合切り替え |
| 分割表示 | `Cmd+Shift+\` | ターミナルペインの分割/統合切り替え |
| フォーカス移動 | `Cmd+0` | ツリーパネルへフォーカス |
| ヘルプ | `?` | ショートカット一覧を開く/閉じる |
| ヘルプ / パレット | `Ctrl+P` | パス検索パレットを開く（既存） |

---

## API設計

### Tauriコマンド

変更なし。

### Tauriイベント

変更なし。

---

## UI設計

### UIライブラリ

| ライブラリ | 用途 | 備考 |
|-----------|------|------|
| `@radix-ui/react-dialog` | ヘルプモーダル | Phase 3-B で導入済み |
| `lucide-react` | アイコン（`Keyboard` 等） | 既存 |

### カラーパレット

`src/index.css` で定義済みの CSS カスタムプロパティを使用：
- `--color-bg-elevated` — モーダル背景
- `--color-border` — セパレーター
- `--color-text-primary` / `--color-text-muted` — テキスト
- `--color-accent` — キーバッジ

### 画面構成

```
┌─────────────────────────────────────────┐
│ キーボードショートカット              × │
├─────────────────────────────────────────┤
│ ペイン切り替え                          │
│  コンテンツ↔ターミナル    Ctrl Tab      │
│                                         │
│ タブ操作                                │
│  コンテンツタブを新規作成   ⌘ T        │
│  ターミナルタブを新規作成   ⌘ ⇧ T     │
│  タブを閉じる               ⌘ W        │
│  次のタブ                   Ctrl Tab    │
│  前のタブ                   Ctrl ⇧ Tab │
│  n 番目のタブ               ⌘ 1-9      │
│                                         │
│ 分割表示                                │
│  コンテンツ分割切り替え     ⌘ \        │
│  ターミナル分割切り替え     ⌘ ⇧ \     │
│                                         │
│ フォーカス移動                          │
│  ツリーパネルへ             ⌘ 0        │
│                                         │
│ その他                                  │
│  パス検索パレット           Ctrl P      │
│  このヘルプ                 ?           │
└─────────────────────────────────────────┘
```

### コンポーネント構成

```
src/components/KeyboardShortcuts/
└── ShortcutsModal.tsx   # Dialog.Root + カテゴリ別リスト表示
```

---

## 状態管理

### Zustandストア変更

```typescript
// contentStore.ts — 追加するアクション
interface ContentState {
  // 既存...
  addTab: () => void           // 新規タブを末尾に追加してアクティブ化
  closeActiveTab: () => void   // アクティブタブを閉じ、左隣をアクティブにする
  activateTabByIndex: (index: number) => void  // 0-indexed でタブをアクティブ化
  activateNextTab: () => void
  activatePrevTab: () => void
}

// terminalStore.ts — 追加するアクション（同様）
interface TerminalGroupState {
  // 既存...
  addTab: (cwd?: string) => void
  closeActiveTab: () => void
  activateTabByIndex: (index: number) => void
  activateNextTab: () => void
  activatePrevTab: () => void
}
```

### グローバルキーハンドラの登録

```typescript
// App.tsx
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    // テキスト入力欄・ターミナルはスキップ
    const target = e.target as HTMLElement
    const tag = target.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    if (target.classList.contains('xterm-helper-textarea')) return

    // ショートカット定義を走査してマッチしたハンドラを実行
    for (const shortcut of SHORTCUTS) {
      if (matchesShortcut(e, shortcut)) {
        e.preventDefault()
        shortcut.handler()
        return
      }
    }
  }
  window.addEventListener('keydown', handler)
  return () => window.removeEventListener('keydown', handler)
}, [])
```

---

## テストコード

### Rustテスト例

変更なし（Rust コードは修正しない）。

---

## 設計上の決定事項

| 決定事項 | 理由 | 代替案 |
|---------|------|--------|
| ショートカット定義を `shortcuts.ts` に集約 | ヘルプ一覧と実ハンドラの定義が乖離しないようにする | 各コンポーネントで個別に定義（保守性が低い） |
| グローバルハンドラを `App.tsx` に登録 | どのコンポーネントがフォーカスを持っていても動作させるため | 各コンポーネントで個別登録（モーダル表示中など漏れが生じやすい） |
| xterm.js フォーカス時はスキップ | `.xterm-helper-textarea` を判定することで xterm.js のキーハンドリングを妨げない | `isActive` prop でガード（ターミナルが非アクティブタブにある場合に対応困難） |
| `Cmd+1`～`Cmd+9` をタブ切り替えに使用 | VS Code / ブラウザ互換のUX | `Ctrl+1`～`Ctrl+9`（macOSではシステムに衝突しやすい） |
| `Ctrl+Tab` をペイン切り替えとタブ切り替えで共有 | ペインが切り替わったら最後のアクティブタブが表示されるため自然な動作になる | 別キーに分離（ショートカットが増えすぎる） |

## 未解決事項

- [ ] `Cmd+1`～`Cmd+9` はコンテンツタブに当てるか、ターミナルタブに当てるか、アクティブなペインに当てるか（要ユーザー確認）
- [ ] ツリーパネルへのフォーカス移動後、矢印キーでツリー内を移動できるようにするか（スコープ外の可能性）
