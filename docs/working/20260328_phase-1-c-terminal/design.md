# 設計書 - Phase 1-C: 統合ターミナル（TerminalPanel）

## アーキテクチャ

### 対象コンポーネント

```
Frontend (React/TypeScript)
    TerminalTabs（タブ管理UI）
    └── TerminalPanel × N（xterm.js インスタンス）
        ↓ invoke()
Tauri IPC
        ↓
Rust Backend（pty.rs）- 実装済み
    PtyManager（spawn / write / resize / close）
        ↓ emit("pty-output")
Frontend イベントリスナー（TerminalPanel 内）
```

### 影響範囲

- **フロントエンド**: `terminalStore` 追加、`TerminalTabs` 新規、`MainArea` 差し替え
- **バックエンド（Rust）**: 変更なし（Phase 0-E で完成済み）

---

## 実装方針

### 概要

Phase 0-E で実装済みの `TerminalPanel`（単一ターミナル）を複数タブで管理する `TerminalTabs` でラップする。各タブは独立した `TerminalPanel` インスタンスを持ち、非アクティブタブは DOM 上に残したまま非表示にして PTY セッションを維持する。

### 詳細

1. `terminalStore` にタブの配列とアクティブ ID を持たせる
2. `TerminalTabs` がタブバー（追加・閉じる・切り替え）を管理し、`terminalStore` と連動する
3. 各タブに対応する `TerminalPanel` を全てレンダリングし、アクティブ以外は CSS で非表示にする（PTY を維持するため unmount しない）
4. `TerminalPanel` は `tabId` を props で受け取り、PTY ID の管理を内部で行う

---

## データ構造

### 型定義（TypeScript）

```typescript
// src/stores/terminalStore.ts

interface TerminalTab {
  id: string       // UUID（タブの識別子）
  title: string    // 表示名（例: "Terminal 1"）
  ptyId: string | null  // spawn_pty で取得した PTY ID（起動前は null）
}

interface TerminalState {
  tabs: TerminalTab[]
  activeTabId: string | null
  addTab: () => void
  closeTab: (id: string) => void
  setActiveTab: (id: string) => void
  setPtyId: (tabId: string, ptyId: string) => void
}
```

### 初期状態

```typescript
// アプリ起動時の初期タブ（1つ）
const initialTab: TerminalTab = {
  id: crypto.randomUUID(),
  title: 'Terminal 1',
  ptyId: null,
}
```

---

## API 設計

### Tauri コマンド（実装済み・変更なし）

| コマンド名 | 引数 | 戻り値 | 説明 |
|-----------|------|--------|------|
| `spawn_pty` | `shell: String, cwd: String` | `Result<String, String>` | PTY 起動、PTY ID を返す |
| `write_pty` | `id: String, data: String` | `Result<(), String>` | PTY にデータ送信 |
| `resize_pty` | `id: String, cols: u16, rows: u16` | `Result<(), String>` | PTY サイズ変更 |
| `close_pty` | `id: String` | `Result<(), String>` | PTY 終了・削除 |

### Tauri イベント（実装済み・変更なし）

| イベント名 | ペイロード | 説明 |
|-----------|-----------|------|
| `pty-output` | `{ id: string, data: string }` | PTY 出力をフロントエンドにストリーミング |

---

## UI 設計

### UI ライブラリ

| ライブラリ | 用途 | 備考 |
|-----------|------|------|
| `lucide-react` | `Plus`（追加）・`X`（閉じる）アイコン | tree-shaking 対応 |

タブ UI は Radix UI を使わず、シンプルな `div` + クリックハンドラで実装する（Radix `Tabs` はコンテンツを隠す際に unmount するため PTY が破棄される）。

### カラーパレット

- アクティブタブ: `--color-bg-base` 背景 + `--color-accent` 下線
- 非アクティブタブ: `--color-bg-panel` 背景 + `--color-text-muted` テキスト
- タブバー: `--color-bg-elevated` 背景 + `--color-border` 下線

### 画面構成

```
┌───────────────────────────────────────────────────────────┐
│  MainTabs タブバー（コンテンツ / ターミナル）              │
├───────────────────────────────────────────────────────────┤
│  TerminalTabs タブバー（Terminal 1 × | Terminal 2  | + ） │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  TerminalPanel（アクティブタブのみ表示）                  │
│  $ _                                                      │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

### コンポーネント構成

```
MainArea
└── MainTabs
    └── [terminal タブコンテンツ]
        └── TerminalTabs           ← 新規
            ├── タブバー（+ ボタン含む）
            └── TerminalPanel × N  ← 既存（非アクティブは非表示）
```

### 非アクティブタブの非表示実装

```tsx
{tabs.map((tab) => (
  <div
    key={tab.id}
    style={{ display: tab.id === activeTabId ? 'flex' : 'none' }}
    className="flex-1 min-h-0"
  >
    <TerminalPanel tabId={tab.id} cwd="~" />
  </div>
))}
```

`display: none` にすることで DOM には残りつつ非表示にする。xterm.js は `display: none` 状態でも PTY との接続を維持する。表示時に `fitAddon.fit()` を呼ぶため、`TerminalPanel` 内で `tabId` の変化を検知して `fit()` を再実行する。

---

## 状態管理

### terminalStore の変更

```typescript
import { create } from 'zustand'

export const useTerminalStore = create<TerminalState>((set) => ({
  tabs: [{ id: crypto.randomUUID(), title: 'Terminal 1', ptyId: null }],
  activeTabId: null, // 初期値は tabs[0].id で初期化

  addTab: () =>
    set((state) => {
      const newTab: TerminalTab = {
        id: crypto.randomUUID(),
        title: `Terminal ${state.tabs.length + 1}`,
        ptyId: null,
      }
      return { tabs: [...state.tabs, newTab], activeTabId: newTab.id }
    }),

  closeTab: (id) =>
    set((state) => {
      if (state.tabs.length <= 1) return state // 最後の 1 タブは閉じない
      const newTabs = state.tabs.filter((t) => t.id !== id)
      const newActive =
        state.activeTabId === id ? newTabs[newTabs.length - 1].id : state.activeTabId
      return { tabs: newTabs, activeTabId: newActive }
    }),

  setActiveTab: (id) => set({ activeTabId: id }),

  setPtyId: (tabId, ptyId) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, ptyId } : t)),
    })),
}))
```

---

## テストコード

### terminalStore テスト

```typescript
describe('terminalStore', () => {
  it('初期状態でタブが1つある', () => {
    expect(useTerminalStore.getState().tabs).toHaveLength(1)
  })

  it('addTab でタブが増える', () => {
    useTerminalStore.getState().addTab()
    expect(useTerminalStore.getState().tabs).toHaveLength(2)
  })

  it('タブが1つの時 closeTab は何もしない', () => {
    const { tabs } = useTerminalStore.getState()
    useTerminalStore.getState().closeTab(tabs[0].id)
    expect(useTerminalStore.getState().tabs).toHaveLength(1)
  })

  it('closeTab で閉じたタブがアクティブなら隣のタブがアクティブになる', () => {
    useTerminalStore.getState().addTab()
    const { tabs } = useTerminalStore.getState()
    useTerminalStore.getState().setActiveTab(tabs[0].id)
    useTerminalStore.getState().closeTab(tabs[0].id)
    expect(useTerminalStore.getState().activeTabId).toBe(tabs[1].id)
  })
})
```

---

## 設計上の決定事項

| 決定事項 | 理由 | 代替案 |
|---------|------|--------|
| Radix `Tabs` を使わず独自タブバーを実装 | Radix Tabs はコンテンツ切り替え時に unmount するため PTY インスタンスが破棄される | Radix + `forceMount` prop（複雑になるため不採用） |
| 非アクティブタブを `display: none` で非表示 | PTY セッションを維持しつつ DOM コストも許容範囲内 | `visibility: hidden`（スペースを占有するため不採用） |
| `cwd` はホームディレクトリ固定（Phase 1-C） | 設定ファイル読み込みは Phase 1-D/2-F で実装 | プロジェクトルートを cwd に使う（PTY 起動前にツリーが未設定の場合がある） |

## 未解決事項

- [ ] `display: none` → `display: flex` 切り替え時の `fitAddon.fit()` タイミング（React の `useLayoutEffect` で対応予定）
