# 設計書 - Phase 2-C: タブ・分割表示

## アーキテクチャ

### 影響範囲

- **フロントエンド**: `contentStore` の大幅拡張、`terminalStore` に分割状態追加、各コンポーネントの変更
- **バックエンド（Rust）**: 変更なし

## 実装方針

### コンテンツタブ

`contentStore` を単一ファイル状態からタブ配列に変更する。`terminalStore` と同様の設計にそろえる。ファイルツリーでクリック済みのファイルは既存タブをアクティブにし、新規ファイルはタブを追加する。

### コンテンツ分割表示

`contentStore` に `splitEnabled` と `secondaryActiveTabId` を追加する。`MainArea` でコンテンツエリアを `SplitPane` で分割し、左右それぞれ独立した `ContentPane` を描画する。左右のアクティブタブは別々に管理する。

### ターミナル分割表示

Phase 1-E の `display: none` 常時マウント方式を踏襲する。`terminalStore` に `splitEnabled` と `secondaryActiveTabId` を追加し、`TerminalPanel` 内で2つの xterm.js インスタンスを常時マウントして切り替える。

## データ構造

### contentStore（変更後）

```typescript
interface ContentTab {
  id: string
  filePath: string | null
  content: string | null
  viewMode: ViewMode
  isLoading: boolean
}

interface ContentState {
  tabs: ContentTab[]
  activeTabId: string
  splitEnabled: boolean
  secondaryActiveTabId: string  // 分割右ペインのアクティブタブ

  addTab: (filePath: string) => void       // 既存タブがあればアクティブ化
  closeTab: (id: string) => void
  setActiveTab: (id: string, pane?: 'primary' | 'secondary') => void
  setFile: (tabId: string, filePath: string, content: string, viewMode: ViewMode) => void
  setLoading: (tabId: string, loading: boolean) => void
  toggleSplit: () => void
}
```

### terminalStore（変更後）

```typescript
interface TerminalState {
  // 既存（変更なし）
  tabs: TerminalTab[]
  activeTabId: string
  addTab: () => void
  closeTab: (id: string) => void
  setActiveTab: (id: string) => void
  setPtyId: (tabId: string, ptyId: string) => void

  // 追加
  splitEnabled: boolean
  secondaryActiveTabId: string
  setSecondaryActiveTab: (id: string) => void
  toggleSplit: () => void
}
```

## UI設計

### UIライブラリ

| ライブラリ | 用途 |
|-----------|------|
| `lucide-react` | 分割ボタンアイコン（`Columns2`）、タブ閉じるアイコン（`X`） |
| 既存 `SplitPane` | 左右分割の実装（Phase 1-E で実装済み） |

### カラーパレット

既存の CSS カスタムプロパティをそのまま使用：
- `--color-bg-elevated`: タブバー背景
- `--color-accent`: アクティブタブのボーダー・テキスト
- `--color-border`: タブ間のセパレーター
- `--color-text-muted`: 非アクティブタブのテキスト

### 画面構成（コンテンツ分割時）

```
┌──────────┬──────────────────┬──────────────────┐
│          │ [01_要件.md ×][+] │ [App.ts ×][+]    │  ← 独立したタブバー
│ ツリー   ├──────────────────┼──────────────────┤
│          │ # 要件定義書      │ const app = ...  │
│          │ ## 1. 概要        │ function main()  │
└──────────┴──────────────────┴──────────────────┘
                              ↑ ドラッグでリサイズ
```

### 画面構成（ターミナル分割時）

```
┌──────────┬──────────────────┬──────────────────┐
│          │ [Term 1 ×][+] □  │ [Term 2 ×][+] □  │  ← 独立したタブバー
│ ツリー   ├──────────────────┼──────────────────┤
│          │ $ claude          │ $ npm run dev    │
└──────────┴──────────────────┴──────────────────┘
```

### コンポーネント構成

```
MainArea
├── ContentPane (新規: 単一ペインのコンテンツ表示単位)
│   ├── ContentTabBar (タブバー + 分割ボタン)
│   └── ContentView (既存・タブ対応に変更)
│       ├── MarkdownPreview
│       ├── CodeViewer
│       └── PlainTextViewer
│
└── TerminalPanel (変更: 分割対応)
    ├── TerminalTabBar (既存 TerminalTabs + 分割ボタン)
    └── xterm.js インスタンス × n（display:none で常時マウント）
```

## 状態管理

### contentStore の初期状態

```typescript
const initialTab: ContentTab = {
  id: crypto.randomUUID(),
  filePath: null,
  content: null,
  viewMode: 'plain',
  isLoading: false,
}

// 初期状態
{
  tabs: [initialTab],
  activeTabId: initialTab.id,
  splitEnabled: false,
  secondaryActiveTabId: initialTab.id,
}
```

### addTab の動作

```typescript
addTab: (filePath) => set((state) => {
  // 既存タブに同じファイルが開いていればアクティブ化
  const existing = state.tabs.find((t) => t.filePath === filePath)
  if (existing) return { activeTabId: existing.id }
  // 新規タブを追加
  const newTab: ContentTab = { id: crypto.randomUUID(), filePath, content: null, viewMode: 'plain', isLoading: true }
  return { tabs: [...state.tabs, newTab], activeTabId: newTab.id }
})
```

### ターミナル分割の PTY 管理

`display: none` で常時マウントする方式のため、分割を切り替えても PTY セッションは維持される。右ペインのデフォルト表示タブは `secondaryActiveTabId`（初期値: 2番目のタブ、なければ1番目）。

## 設計上の決定事項

| 決定事項 | 理由 | 代替案 |
|---------|------|--------|
| contentStore をタブ配列に変更 | terminalStore と設計を統一する。単一状態では複数タブを管理できない | contentStore をそのままにして別途 tabsStore を作る（不必要な複雑化） |
| 分割は左右2ペインのみ | Phase 2-C のスコープとして十分。3ペイン以上は将来対応 | 上下分割も同時実装（スコープ増大）|
| ターミナル分割は display:none 常時マウント | Phase 1-E で確立した方式。PTY セッションが破棄されない | アンマウント方式（PTY セッションが失われる）|
| 右ペインのタブは左ペインと共有 | タブを増やしすぎず、左右で同じタブリストを参照できる | 左右で独立したタブリスト（管理が複雑化）|

## 未解決事項

- [ ] コンテンツ分割時にファイルツリーからクリックしたファイルをどちらのペインに開くか（フォーカスがあるペインに開く方式が自然か）
- [ ] ファイル監視（Phase 2-B）との整合：複数タブが同じファイルを開いている場合の更新処理
