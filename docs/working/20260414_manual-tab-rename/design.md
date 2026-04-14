# 設計書 - manual-tab-rename（P3: 手動リネーム UI）

## アーキテクチャ

### 対象コンポーネント

```
ユーザー操作
 ├─ ダブルクリック（タブラベル上）
 │    ↓
 │  TerminalTabs.tsx: editingTabId ステートをセット
 │    ↓
 │  TabInlineRenameInput をインライン描画
 │    ↓  Enter / blur で確定  /  Esc でキャンセル
 │    ↓
 │  useTerminalStore.renameTab(tabId, manualTitle)
 │    └→ pinned=true, manualTitle=trimmed
 │  もしくは
 │  useTerminalStore.unpinTab(tabId)  ← 空文字での確定時
 │
 └─ 右クリック（タブ上）
      ↓
    Radix ContextMenu (TabContextMenu)
      ├─ "タブ名を変更"      → editingTabId をセット
      ├─ "自動タイトルに戻す" → unpinTab  (pinned 時のみ活性)
      └─ "タブを閉じる"      → closeTab

renameTab / unpinTab → Zustand 更新
    ↓
computeDisplayTitle(tab) が新しい値を返す
    ↓
既存の AppLayout subscribe（P2）が差分を検出
    ↓
tauriApi.setPtyDisplayTitle(ptyId, display) で Rust キャッシュ更新
    ↓
OSC 9 通知発火時のタイトル差し込みにも反映される
```

### 影響範囲

- **フロントエンド**:
  - `src/stores/terminalStore.ts` — 型拡張 + アクション追加
  - `src/stores/terminalStore.test.ts` — ユニットテスト追加
  - `src/components/TerminalPanel/TabInlineRenameInput.tsx`（新規）
  - `src/components/TerminalPanel/TabContextMenu.tsx`（新規）
  - `src/components/TerminalPanel/TerminalTabs.tsx` — 編集モード統合
  - `src/i18n/locales/ja/common.json` / `en/common.json` — メニュー文言
- **バックエンド（Rust）**:
  - 変更なし（P2 の `terminal-title-changed` 経路と `DisplayTitleCache` 同期で吸収される）

## 実装方針

### 概要

P2 で整備した「表示タイトル = `computeDisplayTitle(tab)`」という設計を **そのまま拡張** することで、実装の大半がフロントに閉じる。Rust 側の変更はゼロ。

データモデル上は `manualTitle` と `pinned` の 2 つを追加するだけで済む。なぜ `pinned` を boolean として別に持つか:
- `manualTitle != null` だけでピン留めを判定すると、ユーザーが空文字で確定したときに "pinned=true かつ manualTitle=''" という曖昧な状態になる
- ユーザーの意図を「空文字＝ピン解除（自動に戻す）」として扱うため、`pinned=false` を明示的に落とす必要がある
- `pinned=false` でも過去の `manualTitle` を残すべきかという議論はあるが、P3 では **unpin 時に manualTitle を null に戻す**（履歴として残さない）方針を取る

### 詳細

1. **型拡張**
   ```typescript
   export interface TerminalTab {
     id: string
     ptyId: string | null
     fallbackTitle: string
     oscTitle: string | null
     manualTitle: string | null   // 新規
     pinned: boolean              // 新規
   }
   ```

2. **`computeDisplayTitle` の優先順位拡張**
   ```typescript
   export function computeDisplayTitle(tab: TerminalTab): string {
     if (tab.pinned && tab.manualTitle) return tab.manualTitle
     return tab.oscTitle ?? tab.fallbackTitle
   }
   ```

3. **新規アクション**
   ```typescript
   renameTab: (tabId, title) => /* pinned=true, manualTitle=trimmed */
   unpinTab:  (tabId)        => /* pinned=false, manualTitle=null */
   ```
   内部では `primary` / `secondary` 両方のペインを走査して該当 `tabId` のタブを更新する（既存の `setPtyId` と同じパターン）。

4. **インライン編集コンポーネント**
   新規 `TabInlineRenameInput`。ツリー用 `InlineInput` は depth 前提があるため流用せず、タブ向けの薄い実装を作る。
   - `defaultValue` は現在の表示タイトル
   - Enter / blur 確定、Esc キャンセル
   - mount 時に input を select + focus
   - width は最小 80px 〜 最大 12rem でタブ内に収まるサイズ

5. **コンテキストメニュー**
   新規 `TabContextMenu`（`@radix-ui/react-context-menu` ベース）。`TreeContextMenu` のスタイル（`var(--color-bg-elevated)` 等）を踏襲。
   - 「タブ名を変更」（常時活性）
   - 「自動タイトルに戻す」（`pinned` の場合のみ。disabled 時はグレーアウト）
   - 「タブを閉じる」（複数タブの場合のみ活性、既存の閉じるボタンと同じ処理）

6. **タブの編集モード切替**
   `TerminalTabs.tsx` の `TerminalPane` コンポーネントにローカル state `editingTabId: string | null` を保持。
   - ダブルクリック or メニュー "タブ名を変更" → `editingTabId = tab.id`
   - `TabInlineRenameInput` から onCommit / onCancel で state を解除
   - 編集中はタブクリック（activeTab 切替）や draggable を抑止（`editingTabId === tab.id` なら button を label 形式で描画、もしくは `draggable={false}` + クリックハンドラ抑止）

### ドラッグ競合の回避

既存のタブは `draggable` 属性が付与されている。ダブルクリックの 1 回目のマウスダウンがドラッグ開始として扱われる可能性がある。以下のいずれかで回避する:

- **案 A**: `onMouseDown` でドラッグ開始を遅延させ、`onDoubleClick` が先に発火した場合は `draggable={false}` に切り替える
- **案 B**: 編集モードに入った瞬間に `draggable={false}` を適用（既にドラッグ開始されていれば効果がないが、ダブルクリックのタイミングでは通常ドラッグはまだ未開始）

→ **案 B を採用**。実装がシンプルで、ダブルクリック検知は OS/ブラウザ標準のタイミングで安定。

## データ構造

### 型定義（TypeScript）

```typescript
// src/stores/terminalStore.ts

export interface TerminalTab {
  id: string
  ptyId: string | null
  fallbackTitle: string
  oscTitle: string | null
  manualTitle: string | null
  pinned: boolean
}

interface TerminalState {
  // ...existing...
  renameTab: (tabId: string, title: string) => void
  unpinTab: (tabId: string) => void
}

// 既存の computeDisplayTitle を拡張
export function computeDisplayTitle(tab: TerminalTab): string {
  if (tab.pinned && tab.manualTitle) return tab.manualTitle
  return tab.oscTitle ?? tab.fallbackTitle
}
```

```typescript
// makeTab 初期化
const makeTab = (index: number): TerminalTab => ({
  id: crypto.randomUUID(),
  ptyId: null,
  fallbackTitle: `Terminal ${index}`,
  oscTitle: null,
  manualTitle: null,
  pinned: false,
})
```

### 型定義（Rust）

変更なし（既存 `DisplayTitleCache` にフロントが送り込む文字列が変わるだけ）。

## API設計

### Tauriコマンド

新規なし。既存の `set_pty_display_title` を利用。

### Tauriイベント

新規なし。

### Zustand アクション（新規）

```typescript
renameTab: (tabId, title) =>
  set((state) => {
    const trimmed = title.trim()
    if (!trimmed) return state // 呼び出し側で unpinTab に振り分ける想定
    let changed = false
    const updateGroup = (g: TerminalGroup): TerminalGroup => {
      const tabs = g.tabs.map((t) => {
        if (t.id !== tabId) return t
        if (t.pinned && t.manualTitle === trimmed) return t // no-op
        changed = true
        return { ...t, pinned: true, manualTitle: trimmed }
      })
      return changed ? { ...g, tabs } : g
    }
    const primary = updateGroup(state.primary)
    const secondary = updateGroup(state.secondary)
    if (!changed) return state
    return { primary, secondary }
  }),

unpinTab: (tabId) =>
  set((state) => {
    let changed = false
    const updateGroup = (g: TerminalGroup): TerminalGroup => {
      const tabs = g.tabs.map((t) => {
        if (t.id !== tabId) return t
        if (!t.pinned && t.manualTitle === null) return t // no-op
        changed = true
        return { ...t, pinned: false, manualTitle: null }
      })
      return changed ? { ...g, tabs } : g
    }
    const primary = updateGroup(state.primary)
    const secondary = updateGroup(state.secondary)
    if (!changed) return state
    return { primary, secondary }
  }),
```

## UI設計

### UIライブラリ

| ライブラリ | 用途 | 備考 |
|-----------|------|------|
| `@radix-ui/react-context-menu` | タブの右クリックメニュー | 既存 `TreeContextMenu` と同一 |
| `lucide-react` | `Pencil` / `RotateCcw` / `X` のアイコン | 既存と統一 |
| `react-i18next` | メニュー文言の翻訳 | 既存パターンに合わせる |

### カラーパレット

既存の CSS カスタムプロパティを踏襲（変更なし）:
- `--color-bg-base` / `--color-bg-elevated` — 入力欄背景、メニュー背景
- `--color-border` — 入力欄枠線、メニュー枠線
- `--color-accent` — フォーカス時の枠線、ホバー時の背景
- `--color-text-primary` / `--color-text-muted` — テキスト

### 画面構成

**編集モードに入ったときの差分**:

```
[通常]  (span) Terminal 1   (span x)
          ^^^^^^^^^^^^^^^
          ← ダブルクリック

[編集]  (input[value="Terminal 1", selected]) ← 自動フォーカス
```

**右クリックメニュー**:

```
┌─────────────────────────────┐
│ ✏️  タブ名を変更               │
│ 🔄  自動タイトルに戻す        │ ← pinned 時のみ活性
│ ─────────────────────────── │
│ ✕  タブを閉じる               │ ← 複数タブの場合のみ活性
└─────────────────────────────┘
```

### コンポーネント構成

**新規 `TabInlineRenameInput.tsx`**:

```tsx
interface Props {
  defaultValue: string
  onCommit: (title: string) => void  // 空文字が来たら呼び出し側で unpinTab に振り分ける
  onCancel: () => void
}

export function TabInlineRenameInput({ defaultValue, onCommit, onCancel }: Props) {
  const [value, setValue] = useState(defaultValue)
  const ref = useRef<HTMLInputElement>(null)
  const committedRef = useRef(false)

  useEffect(() => {
    const t = setTimeout(() => {
      ref.current?.focus()
      ref.current?.select()
    }, 50)
    return () => clearTimeout(t)
  }, [])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      committedRef.current = true
      onCommit(value)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      committedRef.current = true
      onCancel()
    }
  }

  const handleBlur = () => {
    if (committedRef.current) return
    committedRef.current = true
    onCommit(value)
  }

  return (
    <input
      ref={ref}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKey}
      onBlur={handleBlur}
      onClick={(e) => e.stopPropagation()}
      className="text-xs rounded px-1 h-5 outline-none min-w-[80px] max-w-[12rem]"
      style={{
        background: 'var(--color-bg-base)',
        border: '1px solid var(--color-accent)',
        color: 'var(--color-text-primary)',
      }}
    />
  )
}
```

**新規 `TabContextMenu.tsx`**:

```tsx
import * as RadixContextMenu from '@radix-ui/react-context-menu'
import { Pencil, RotateCcw, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface Props {
  children: React.ReactNode
  pinned: boolean
  canClose: boolean
  onRename: () => void
  onUnpin: () => void
  onClose: () => void
}

export function TabContextMenu({ children, pinned, canClose, onRename, onUnpin, onClose }: Props) {
  const { t } = useTranslation()
  // Radix Root / Trigger / Portal / Content / Item 構造（TreeContextMenu と同パターン）
  // ...
}
```

### `TerminalTabs.tsx` の統合

```tsx
const [editingTabId, setEditingTabId] = useState<string | null>(null)

const commitRename = (tabId: string, title: string) => {
  const trimmed = title.trim()
  if (trimmed.length === 0) {
    useTerminalStore.getState().unpinTab(tabId)
  } else {
    useTerminalStore.getState().renameTab(tabId, trimmed)
  }
  setEditingTabId(null)
}

// 各タブ描画:
{group.tabs.map((tab) => {
  const isActive = tab.id === group.activeTabId
  const isEditing = tab.id === editingTabId
  const display = computeDisplayTitle(tab)

  return (
    <TabContextMenu
      key={tab.id}
      pinned={tab.pinned}
      canClose={group.tabs.length > 1}
      onRename={() => setEditingTabId(tab.id)}
      onUnpin={() => useTerminalStore.getState().unpinTab(tab.id)}
      onClose={() => closeTab(tab.id, pane)}
    >
      <button
        draggable={!isEditing}
        onDoubleClick={() => setEditingTabId(tab.id)}
        onDragStart={!isEditing ? (e) => handleDragStart(e, tab.id) : undefined}
        onClick={!isEditing ? () => setActiveTab(tab.id, pane) : undefined}
        title={display}
        /* ...既存スタイル... */
      >
        {isEditing ? (
          <TabInlineRenameInput
            defaultValue={display}
            onCommit={(t) => commitRename(tab.id, t)}
            onCancel={() => setEditingTabId(null)}
          />
        ) : (
          <span className="max-w-[12rem] truncate">{display}</span>
        )}
        {/* × ボタン: 編集中は非表示 */}
      </button>
    </TabContextMenu>
  )
})}
```

## 状態管理

### Zustand ストア変更

上記「Zustand アクション（新規）」を参照。

### 永続化

本フェーズでは `persist` の導入は行わない。`manualTitle` / `pinned` はセッション内のみ。

## テストコード

### Reactコンポーネント / ストアテスト例

```typescript
// src/stores/terminalStore.test.ts に追加

describe('renameTab', () => {
  beforeEach(resetStore)

  it('pinned=true, manualTitle=<trimmed> が設定される', () => {
    const { primary } = useTerminalStore.getState()
    useTerminalStore.getState().renameTab(primary.tabs[0].id, '  watcher  ')
    const tab = useTerminalStore.getState().primary.tabs[0]
    expect(tab.pinned).toBe(true)
    expect(tab.manualTitle).toBe('watcher')
  })

  it('空文字では何も変更しない（呼び出し側で unpinTab に振り分ける想定）', () => {
    const { primary } = useTerminalStore.getState()
    useTerminalStore.getState().renameTab(primary.tabs[0].id, '   ')
    const tab = useTerminalStore.getState().primary.tabs[0]
    expect(tab.pinned).toBe(false)
    expect(tab.manualTitle).toBeNull()
  })
})

describe('unpinTab', () => {
  beforeEach(resetStore)

  it('pinned=false, manualTitle=null に戻る', () => {
    const { primary } = useTerminalStore.getState()
    const tabId = primary.tabs[0].id
    useTerminalStore.getState().renameTab(tabId, 'watcher')
    useTerminalStore.getState().unpinTab(tabId)
    const tab = useTerminalStore.getState().primary.tabs[0]
    expect(tab.pinned).toBe(false)
    expect(tab.manualTitle).toBeNull()
  })
})

describe('computeDisplayTitle — 3 段優先順位', () => {
  it('pinned + manualTitle が最優先', () => {
    const tab: TerminalTab = {
      id: '1', ptyId: 'p', fallbackTitle: 'Terminal 1',
      oscTitle: 'vim', manualTitle: 'watcher', pinned: true,
    }
    expect(computeDisplayTitle(tab)).toBe('watcher')
  })

  it('pinned=false のとき manualTitle は無視される', () => {
    const tab: TerminalTab = {
      id: '1', ptyId: 'p', fallbackTitle: 'Terminal 1',
      oscTitle: 'vim', manualTitle: 'watcher', pinned: false,
    }
    expect(computeDisplayTitle(tab)).toBe('vim')
  })

  it('pinned=true でも manualTitle が null なら oscTitle を使う（ガード）', () => {
    const tab: TerminalTab = {
      id: '1', ptyId: 'p', fallbackTitle: 'Terminal 1',
      oscTitle: 'vim', manualTitle: null, pinned: true,
    }
    expect(computeDisplayTitle(tab)).toBe('vim')
  })
})

describe('pinned と setOscTitle の共存', () => {
  beforeEach(resetStore)

  it('pinned=true のタブに OSC が届いても manualTitle が優先される', () => {
    const { primary } = useTerminalStore.getState()
    const tabId = primary.tabs[0].id
    useTerminalStore.getState().setPtyId(tabId, 'pty-0')
    useTerminalStore.getState().renameTab(tabId, 'watcher')
    useTerminalStore.getState().setOscTitle('pty-0', 'vim foo.ts')
    const tab = useTerminalStore.getState().primary.tabs[0]
    // 内部的には oscTitle が記録される
    expect(tab.oscTitle).toBe('vim foo.ts')
    // しかし表示上は manualTitle が優先される
    expect(computeDisplayTitle(tab)).toBe('watcher')
  })

  it('unpin 後は最新の oscTitle が即座に表示される', () => {
    const { primary } = useTerminalStore.getState()
    const tabId = primary.tabs[0].id
    useTerminalStore.getState().setPtyId(tabId, 'pty-0')
    useTerminalStore.getState().renameTab(tabId, 'watcher')
    useTerminalStore.getState().setOscTitle('pty-0', 'vim foo.ts')
    useTerminalStore.getState().unpinTab(tabId)
    const tab = useTerminalStore.getState().primary.tabs[0]
    expect(computeDisplayTitle(tab)).toBe('vim foo.ts')
  })
})
```

### Rustテスト例

本フェーズでは Rust 側変更なし（既存テスト 99 件がそのままパスすればよい）。

## 設計上の決定事項

| 決定事項 | 理由 | 代替案 |
|---------|------|--------|
| `pinned` を boolean として明示保持 | 「空文字でピン解除」の意図を型で表現。`manualTitle === null` だけで判定すると曖昧になる | `manualTitle: string \| null` のみ。空文字とピン解除の区別がコード散在 |
| unpin 時に `manualTitle = null` に戻す | 状態がシンプル。ユーザーは意図的にピン解除したので過去名は不要 | `pinned=false` のまま `manualTitle` を保持。再ピン時に復元できるが、複雑化するため不採用 |
| `renameTab` が空文字を no-op（呼び出し側で振り分け） | アクションを純粋に保つ。`renameTab` は「名前を付ける」意味 | `renameTab` 内で空文字なら自動 unpin。アクション API が密結合で使いにくい |
| インライン編集は独立コンポーネント `TabInlineRenameInput` | ツリー用 `InlineInput` は depth 前提。タブは制約が違う | 既存 InlineInput を流用。引数の意味が変わり保守性が落ちる |
| `draggable={!isEditing}` で競合回避 | 実装がシンプル、競合の発生するケースが稀 | MouseDown でドラッグ遅延。実装が複雑で壊れやすい |
| Rust 側の変更なし | P2 の `subscribe → setPtyDisplayTitle` 経路がそのまま機能する | Rust にも手動タイトルを送るコマンドを追加。二重経路で複雑化 |

## 未解決事項

- [ ] i18n キー命名（`terminal.contextMenu.rename` / `terminal.contextMenu.unpinTitle` / `terminal.contextMenu.close` など、既存の `contextMenu.*` と名前衝突しないよう確認）
- [ ] ダブルクリック時の `activateTab` 抑止が必要か（クリックと区別がつくか実機で確認）
- [ ] 編集中の input を含むタブで ContextMenu のキーボード操作が期待どおりか
- [ ] 長い手動タイトル（100 文字超）の入力時の挙動（UI 崩れ回避は `max-w-[12rem] truncate` で実施済）
