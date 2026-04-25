# 設計書 - タブ一括クローズアクション

## アーキテクチャ

### 対象コンポーネント

```
Frontend (React/TypeScript)
  ├─ ContentTabBar  ──┐
  │   └─ ContentTabContextMenu (新規)        ──→ contentStore (新規アクション)
  │
  └─ TerminalTabs ──┐
      └─ TabContextMenu (項目追加)            ──→ terminalStore (新規アクション)
                                                       │
                                                       ↓ invoke()
                                                Tauri IPC: close_pty
                                                       ↓
                                                  Rust Backend
                                                       ↓
                                                  PTY (portable-pty)
```

### 影響範囲

- **フロントエンド**:
  - コンテンツタブ：`ContentTabBar.tsx` をラップする ContextMenu の新設、メニュー定義の新規ファイル化、`contentStore` の新規アクション 3 つ。
  - ターミナルタブ：`TabContextMenu.tsx` のメニュー項目追加、`TerminalTabs.tsx` でハンドラ配線、`terminalStore` の新規アクション 3 つ。
  - i18n：ja/en ロケールへ計 6 キー × 2 言語 = 12 エントリ追加。
- **バックエンド（Rust）**: 変更なし。既存 `close_pty` を使い回す。

## 実装方針

### 概要

1. **コンテンツとターミナルでコンテキストメニューを意図的に共通化しない**：両者は持つ追加メニュー項目（ターミナル側はリネーム／ピン解除／プロンプトパレット起動などドメイン固有のものが多い）が大きく異なる。共通化すると props の union 型が肥大し将来の拡張時に分岐が増えるため、**コピー寛容（DRY より整合性）** の方針で 2 ファイル並立とする。
2. **新規ストアアクションは既存 `closeTab` のセマンティクスを忠実に踏襲**：
   - 最後の 1 枚は **削除せず空タブに差し替え**（content）／**新シェルを再起動**（terminal）。
   - ターミナルでは閉じる各 PTY について `notifyPromptPaletteOfPtyClosed` を呼ぶ。
3. **メニュー表示順**は VS Code 慣習に合わせる：
   - 右側のタブを閉じる
   - その他のタブを閉じる
   - すべてのタブを閉じる

### 詳細

1. `contentStore` / `terminalStore` に 3 アクションずつ追加。すべて単一 `set()` で完結し、UI スレッドはブロックしない。
2. `ContentTabBar.tsx` の各タブボタンを `<ContentTabContextMenu>` でラップ。`<RadixContextMenu.Trigger asChild>` を使うため、既存の `draggable` / `onDragStart` / `onClick` は維持される。
3. ターミナル側は既存 `<TabContextMenu>` に props（`onCloseAll` / `onCloseOthers` / `onCloseToRight` / `canCloseToRight`）を追加し、`TerminalTabs.tsx` から配線。
4. 「右側のタブを閉じる」は基準タブが最右端のとき disabled。「その他のタブを閉じる」「すべてのタブを閉じる」はタブが 1 枚しかないとき disabled（実質 noop）。

## データ構造

### 型定義（TypeScript）

新規型は不要。既存の `ContentTab` / `TerminalTab` / `ContentGroup` / `TerminalGroup` を使用する。

ストアアクションのシグネチャのみ追加：

```typescript
// src/stores/contentStore.ts に追加
interface ContentState {
  // ...既存
  closeAllTabs: (pane: 'primary' | 'secondary') => void
  closeOtherTabs: (id: string, pane: 'primary' | 'secondary') => void
  closeTabsToRight: (id: string, pane: 'primary' | 'secondary') => void
}

// src/stores/terminalStore.ts に追加
interface TerminalState {
  // ...既存
  closeAllTabs: (pane: 'primary' | 'secondary') => void
  closeOtherTabs: (id: string, pane: 'primary' | 'secondary') => void
  closeTabsToRight: (id: string, pane: 'primary' | 'secondary') => void
}
```

### 型定義（Rust）

変更なし。

## API設計

### Tauriコマンド

新規追加なし。既存 `close_pty` を使用する。

| コマンド名 | 引数 | 戻り値 | 説明 |
|-----------|------|--------|------|
| `close_pty` | `{ id: string }` | `Result<(), String>` | 既存。閉じる各タブの ptyId について個別に呼び出す。 |

### Tauriイベント

変更なし。

## UI設計

### UIライブラリ

| ライブラリ | 用途 | 備考 |
|-----------|------|------|
| `@radix-ui/react-context-menu` | コンテンツ／ターミナル両方のタブ右クリックメニュー | 既存依存。`Root` / `Trigger asChild` / `Portal` / `Content` / `Item` / `Separator` を使用 |
| `lucide-react` | アイコン（`X`, `XCircle`, `ArrowRightFromLine` 等） | 既存依存 |

### カラーパレット

`src/index.css` の既存 CSS カスタムプロパティを使用：
- `--color-bg-elevated` — メニュー背景
- `--color-border` — メニューボーダー・セパレーター
- `--color-text-primary` / `--color-text-muted` — テキスト・無効化テキスト
- `--color-accent` — ホバー背景

危険操作（クローズ系）の色は既存 `TabContextMenu` で使用している `#ef4444` を踏襲。

### 画面構成

#### コンテンツタブ右クリックメニュー（新規）

```
┌─────────────────────────────────┐
│  右側のタブを閉じる              │
│  その他のタブを閉じる            │
│  すべてのタブを閉じる            │
│  ─────────────────────────────  │
│  タブを閉じる                    │
└─────────────────────────────────┘
```

#### ターミナルタブ右クリックメニュー（拡張）

```
┌─────────────────────────────────┐
│  プロンプトパレット      ⌘⇧P    │
│  ─────────────────────────────  │
│  名前を変更                      │
│  ピンを解除                      │
│  ─────────────────────────────  │
│  右側のタブを閉じる              │← 新規
│  その他のタブを閉じる            │← 新規
│  すべてのタブを閉じる            │← 新規
│  ─────────────────────────────  │
│  タブを閉じる                    │
└─────────────────────────────────┘
```

### コンポーネント構成

- `src/components/ContentView/ContentTabContextMenu.tsx`（**新規**）
  - props: `children`, `canCloseToRight`, `canCloseOthers`, `onClose`, `onCloseAll`, `onCloseOthers`, `onCloseToRight`
  - `TabContextMenu.tsx`（ターミナル用）と同じ Radix パターンで実装。**ファイルは独立**。
- `src/components/TerminalPanel/TabContextMenu.tsx`（**拡張**）
  - props に `canCloseToRight`, `canCloseOthers`, `onCloseAll`, `onCloseOthers`, `onCloseToRight` を追加。
  - メニュー項目 3 つを `Separator` 区切りで挿入。

## 状態管理

### Zustandストア変更

#### `contentStore.ts`（追加するアクション）

```typescript
closeAllTabs: (pane) =>
  set((state) => {
    const empty = makeTab()
    return { [pane]: { tabs: [empty], activeTabId: empty.id } }
  }),

closeOtherTabs: (id, pane) =>
  set((state) => {
    const group = state[pane]
    const target = group.tabs.find((t) => t.id === id)
    if (!target) return state
    return { [pane]: { tabs: [target], activeTabId: target.id } }
  }),

closeTabsToRight: (id, pane) =>
  set((state) => {
    const group = state[pane]
    const idx = group.tabs.findIndex((t) => t.id === id)
    if (idx < 0 || idx === group.tabs.length - 1) return state
    const newTabs = group.tabs.slice(0, idx + 1)
    const stillActive = newTabs.some((t) => t.id === group.activeTabId)
    return {
      [pane]: {
        tabs: newTabs,
        activeTabId: stillActive ? group.activeTabId : id,
      },
    }
  }),
```

#### `terminalStore.ts`（追加するアクション）

PTY 終了通知が必要な点だけ contentStore と異なる。

```typescript
closeAllTabs: (pane) =>
  set((state) => {
    const group = state[pane]
    group.tabs.forEach((t) => notifyPromptPaletteOfPtyClosed(t.ptyId))
    const fresh = makeTab(1)
    return { [pane]: { tabs: [fresh], activeTabId: fresh.id } }
  }),

closeOtherTabs: (id, pane) =>
  set((state) => {
    const group = state[pane]
    const target = group.tabs.find((t) => t.id === id)
    if (!target) return state
    group.tabs.forEach((t) => {
      if (t.id !== id) notifyPromptPaletteOfPtyClosed(t.ptyId)
    })
    return { [pane]: { tabs: [target], activeTabId: target.id } }
  }),

closeTabsToRight: (id, pane) =>
  set((state) => {
    const group = state[pane]
    const idx = group.tabs.findIndex((t) => t.id === id)
    if (idx < 0 || idx === group.tabs.length - 1) return state
    const closing = group.tabs.slice(idx + 1)
    closing.forEach((t) => notifyPromptPaletteOfPtyClosed(t.ptyId))
    const newTabs = group.tabs.slice(0, idx + 1)
    const stillActive = newTabs.some((t) => t.id === group.activeTabId)
    return {
      [pane]: {
        tabs: newTabs,
        activeTabId: stillActive ? group.activeTabId : id,
      },
    }
  }),
```

実 PTY プロセスの終了は、既存の `useTerminalLifecycle` がタブ消滅を検知して `close_pty` を invoke するか、または各アクション内から直接 `invoke('close_pty', { id: ptyId })` を呼ぶ。前者で吸収できることを実装時にまず確認し、無理なら後者にフォールバックする。

## テストコード

### Reactコンポーネントテスト例

`ContentTabContextMenu` 単体のレンダリングテストは Radix のポータル＆実 DOM 依存が大きいため、**ストアレベルのアクションテストを主軸**とする。コンポーネント側はスモークテスト程度に留める。

### Vitest（ストア）

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { useContentStore } from './contentStore'

describe('contentStore - bulk close', () => {
  beforeEach(() => {
    useContentStore.getState().resetAllTabs()
  })

  it('closeAllTabs: ペイン内タブを空タブ1枚にリセットする', () => {
    const { openFile, closeAllTabs } = useContentStore.getState()
    openFile('/a.md', 'primary')
    openFile('/b.md', 'primary')
    closeAllTabs('primary')
    const { tabs } = useContentStore.getState().primary
    expect(tabs).toHaveLength(1)
    expect(tabs[0].filePath).toBeNull()
  })

  it('closeOtherTabs: 基準タブのみを残す', () => {
    const { openFile, closeOtherTabs } = useContentStore.getState()
    openFile('/a.md', 'primary')
    openFile('/b.md', 'primary')
    openFile('/c.md', 'primary')
    const target = useContentStore.getState().primary.tabs[1] // /b.md
    closeOtherTabs(target.id, 'primary')
    const { tabs, activeTabId } = useContentStore.getState().primary
    expect(tabs).toHaveLength(1)
    expect(tabs[0].filePath).toBe('/b.md')
    expect(activeTabId).toBe(target.id)
  })

  it('closeTabsToRight: 基準より右のタブを削除する', () => {
    const { openFile, closeTabsToRight } = useContentStore.getState()
    openFile('/a.md', 'primary')
    openFile('/b.md', 'primary')
    openFile('/c.md', 'primary')
    const target = useContentStore.getState().primary.tabs[1] // /b.md
    closeTabsToRight(target.id, 'primary')
    const { tabs, activeTabId } = useContentStore.getState().primary
    expect(tabs).toHaveLength(2)
    expect(tabs.map((t) => t.filePath)).toEqual(['/a.md', '/b.md'])
    expect(activeTabId).toBe(target.id) // c.md がアクティブだったため b.md にフォールバック
  })

  it('closeTabsToRight: 基準が最右端なら no-op', () => {
    const { openFile, closeTabsToRight } = useContentStore.getState()
    openFile('/a.md', 'primary')
    const target = useContentStore.getState().primary.tabs[0]
    const before = useContentStore.getState().primary
    closeTabsToRight(target.id, 'primary')
    expect(useContentStore.getState().primary).toBe(before)
  })
})
```

terminalStore のテストも同様。プロンプトパレット側との連携（`notifyPromptPaletteOfPtyClosed` が呼ばれること）は、`usePromptPaletteStore.getState().clearDraft` を spy する形で確認する。

### Rustテスト例

変更なし。

## 設計上の決定事項

| 決定事項 | 理由 | 代替案 |
|---------|------|--------|
| ContextMenu はコンテンツ／ターミナルで共通化しない | 両者の追加メニュー項目（ターミナル側のリネーム・ピン解除・プロンプトパレット起動）が大きく異なり、共通化すると props の union 型が肥大して将来分岐が増える。タブの種別ごとに今後も独自拡張が見込まれる。 | `TabContextMenu` を共通コンポーネント化し props に `extraItems` を渡す案 |
| 「すべて閉じる」は最後の 1 枚を空タブに差し替える | 既存 `closeTab` / `handlePtyExited` のセマンティクスと整合させ、ユーザーが操作後に常に 1 枚は使える状態を保証する。 | タブ 0 枚の空状態を許容する案（ContentArea のレイアウト変更が必要） |
| メニュー項目順は「右→その他→すべて」 | VS Code・主要ブラウザの慣習。 | アルファベット順／登場頻度順 |
| 一括 PTY 終了用の Rust コマンドは追加しない | 個別 `close_pty` の逐次 invoke で実用上の遅延は無視できる範囲。新コマンドはコスト対効果が低い。 | `close_ptys` バッチコマンドを新設する案 |
| 「右側のタブを閉じる」のアクティブ復帰は基準タブにフォールバック | 閉じる前に右側にあったアクティブタブは消滅するため、もっとも自然な復帰先は基準タブ。 | 左隣タブにフォールバック |

## 未解決事項

- [ ] コンテンツタブで「保存していない変更」の概念は現状なし（読み取り専用ビューア）。将来編集機能が入った場合、「すべて閉じる」で confirm ダイアログを挟むかどうかは別途検討。
- [ ] ターミナル側「すべて閉じる」で実 PTY を終了する経路として、`useTerminalLifecycle` の自動検知に任せるか、ストアアクション内で直接 `invoke('close_pty')` するかは実装着手時に最終決定する。
