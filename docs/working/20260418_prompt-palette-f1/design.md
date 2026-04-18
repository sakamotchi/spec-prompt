# 設計書 - prompt-palette-f1

F1（MVP）に必要な部分のみを抜粋して詳細化する。全体設計の原典は `docs/local/20260415-プロンプト編集パレット/02_概要設計書.md` を参照。

## アーキテクチャ

### 対象コンポーネント

```
Frontend (React/TypeScript)
  ├─ AppLayout.tsx
  │    ├─ keydown: Cmd+Shift+P → promptPaletteStore.open(ptyId, tabName)
  │    └─ <PromptPalette /> をマウント
  ├─ TabContextMenu.tsx
  │    └─ 「プロンプトを編集...」→ promptPaletteStore.open(ptyId, tabName)
  ├─ <PromptPalette>
  │    ├─ Radix Dialog.Root（open = isOpen）
  │    ├─ <textarea>（8 行、resize vertical）
  │    └─ handleSubmit → tauriApi.writePty(targetPtyId, body + "\n")
  └─ stores/promptPaletteStore.ts（Zustand、persist 不使用）

  既存呼び出し: tauriApi.writePty → invoke("write_pty", …) → Rust（変更なし）
```

### 影響範囲

- **フロントエンド**: 新規ストア 1、新規コンポーネント 1、`AppLayout` / `TabContextMenu` / i18n の軽微変更
- **バックエンド（Rust）**: 変更なし

## 実装方針

### 概要

1. `promptPaletteStore` に開閉状態・送信先・タブ別下書きを集約する（`insertAtCaret` は F2 で追加、F1 ではプレースホルダを置かない）。
2. `<PromptPalette>` は Radix Dialog の `open` 属性にストアの `isOpen` を束ね、`onOpenChange(false)` で `close()` を呼ぶ。
3. 送信は `Cmd/Ctrl+Enter` と「送信」ボタンの 2 経路から同一の `handleSubmit` を呼び、成功時は `clearDraft` → `close` の順で実行する。
4. 起動トリガーは (a) `AppLayout` のグローバル `Cmd+Shift+P`、(b) `TabContextMenu` の新規メニュー項目の 2 系統。どちらも `open(ptyId, tabName)` を呼ぶだけ。
5. パス挿入ディスパッチ、IME 抑止、グローバルショートカット skip 共通ガード、送信失敗トーストは **F1 では実装しない**（F2 / F3）。

### 詳細

1. **ストア新設** — `src/stores/promptPaletteStore.ts`
2. **ストアテスト** — `src/stores/promptPaletteStore.test.ts`
3. **UI 骨格** — `src/components/PromptPalette/PromptPalette.tsx`
4. **UI テスト** — `src/components/PromptPalette/PromptPalette.test.tsx`
5. **レイアウト統合** — `AppLayout.tsx` に keydown リスナ追加・`<PromptPalette />` をマウント
6. **メニュー拡張** — `TabContextMenu.tsx` に項目追加
7. **i18n** — `promptPalette.*` 名前空間（ja / en）
8. **動作確認** — `testing.md` に沿った手動 E2E

## データ構造

### 型定義（TypeScript）

```typescript
// src/stores/promptPaletteStore.ts
import { create } from 'zustand'

export type PromptPaletteState = {
  isOpen: boolean
  targetPtyId: string | null
  targetTabName: string | null
  drafts: Record<string, string>

  open: (ptyId: string, tabName: string) => void
  close: () => void
  setDraft: (ptyId: string, value: string) => void
  getDraft: (ptyId: string) => string
  clearDraft: (ptyId: string) => void
}

export const usePromptPaletteStore = create<PromptPaletteState>((set, get) => ({
  isOpen: false,
  targetPtyId: null,
  targetTabName: null,
  drafts: {},

  open: (ptyId, tabName) =>
    set({ isOpen: true, targetPtyId: ptyId, targetTabName: tabName }),

  close: () =>
    set({ isOpen: false, targetPtyId: null, targetTabName: null }),

  setDraft: (ptyId, value) =>
    set((s) => ({ drafts: { ...s.drafts, [ptyId]: value } })),

  getDraft: (ptyId) => get().drafts[ptyId] ?? '',

  clearDraft: (ptyId) =>
    set((s) => {
      const next = { ...s.drafts }
      delete next[ptyId]
      return { drafts: next }
    }),
}))
```

> F2 で `textareaRef` / `registerTextarea` / `insertAtCaret` を追加する。F1 時点では **このフィールドを敢えて置かない**（ダミー実装は残留コード化するため）。

### 型定義（Rust）

F1 では変更なし。

## API設計

### Tauriコマンド

F1 では新規追加なし。既存 `write_pty` を流用する。

| コマンド名 | 引数 | 戻り値 | 説明 |
|-----------|------|--------|------|
| `write_pty` | `{ id: string, data: string }` | `Result<(), String>` | 既存。`body + "\n"` を 1 回で書き込む |

### Tauriイベント

F1 では新規追加なし。

## UI設計

### UIライブラリ

| ライブラリ | 用途 | 備考 |
|-----------|------|------|
| `@radix-ui/react-dialog` | モーダル本体 | `PathPalette` / `ShortcutsModal` と同パターン |
| `lucide-react` | 送信/閉じるアイコン（任意） | 既存プロジェクトで採用済み |

### カラーパレット

`src/index.css` の CSS カスタムプロパティを使用：

- 背景: `--color-bg-elevated`（モーダル本体）、`--color-bg-panel`（textarea 背景）
- ボーダー: `--color-border`
- テキスト: `--color-text-primary`（本文）、`--color-text-muted`（キーヒント）
- アクセント: `--color-accent`（送信ボタン有効時）

### 画面構成

```
┌─ Radix Dialog.Overlay ─────────────────────────────┐
│                                                    │
│  ┌─ Dialog.Content (中央) ─────────────────────┐   │
│  │ プロンプトを編集  →  {targetTabName} に送信 │   │
│  │ ──────────────────────────────────────────  │   │
│  │ ┌──────────────────────────────────────┐   │   │
│  │ │ <textarea rows={8}                   │   │   │
│  │ │          style="resize: vertical">   │   │   │
│  │ │                                      │   │   │
│  │ │                                      │   │   │
│  │ │                                      │   │   │
│  │ └──────────────────────────────────────┘   │   │
│  │                                             │   │
│  │ Enter: 改行 · ⌘Enter: 送信 · Esc: 閉じる    │   │
│  │                       [キャンセル] [ 送信 ] │   │
│  └─────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────┘
```

### コンポーネント構成

- `PromptPalette.tsx`（`src/components/PromptPalette/`）
  - ストアから `isOpen`, `targetPtyId`, `targetTabName`, `drafts` を購読
  - ローカル state: `body`（textarea value）— ストアの `drafts` と双方向バインディング
  - ハンドラ: `handleChange`, `handleKeyDown`, `handleSubmit`, `handleCancel`
  - 送信可否: `body.trim().length > 0`
- `TabContextMenu.tsx`
  - 既存メニューの先頭に `<ContextMenu.Item onSelect={() => open(ptyId, tabName)}>` を追加
  - キーヒント: `Cmd+Shift+P` / `Ctrl+Shift+P`（プラットフォーム分岐）
- `AppLayout.tsx`
  - `useEffect` で `keydown` リスナを追加
  - 判定: `(e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'p' || e.key === 'P')`
  - アクティブ `ptyId` は `useTerminalStore.getState().primary.activeTabId ?? secondary.activeTabId` で解決
  - タブ名は `terminalStore` のタブリストから lookup
  - `<PromptPalette />` をマウント（常時マウント、`isOpen` で表示制御）

## 状態管理

### Zustandストア変更

- **新設**: `src/stores/promptPaletteStore.ts`（上記 TypeScript 型定義参照）
- **変更なし**: `appStore`, `terminalStore`, `contentStore`

## テストコード

### Reactコンポーネントテスト例

```typescript
// src/components/PromptPalette/PromptPalette.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PromptPalette } from './PromptPalette'
import { usePromptPaletteStore } from '../../stores/promptPaletteStore'

vi.mock('../../lib/tauriApi', () => ({
  writePty: vi.fn(async () => {}),
}))

beforeEach(() => {
  usePromptPaletteStore.setState({
    isOpen: false,
    targetPtyId: null,
    targetTabName: null,
    drafts: {},
  })
})

describe('PromptPalette', () => {
  it('初期値を drafts からロードする', async () => {
    usePromptPaletteStore.setState({
      isOpen: true,
      targetPtyId: 'pty-1',
      targetTabName: 'zsh',
      drafts: { 'pty-1': 'hello' },
    })
    render(<PromptPalette />)
    expect(await screen.findByRole('textbox')).toHaveValue('hello')
  })

  it('Enter では送信しない（改行のみ）', async () => {
    const { writePty } = await import('../../lib/tauriApi')
    usePromptPaletteStore.setState({ isOpen: true, targetPtyId: 'pty-1', targetTabName: 'zsh' })
    render(<PromptPalette />)
    await userEvent.type(screen.getByRole('textbox'), 'line1{Enter}line2')
    expect(writePty).not.toHaveBeenCalled()
  })

  it('Cmd+Enter で writePty が呼ばれる', async () => {
    const { writePty } = await import('../../lib/tauriApi')
    usePromptPaletteStore.setState({ isOpen: true, targetPtyId: 'pty-1', targetTabName: 'zsh' })
    render(<PromptPalette />)
    const ta = screen.getByRole('textbox')
    await userEvent.type(ta, 'hello')
    await userEvent.keyboard('{Meta>}{Enter}{/Meta}')
    expect(writePty).toHaveBeenCalledWith('pty-1', 'hello\n')
  })

  it('空本文で送信ボタンが disable', () => {
    usePromptPaletteStore.setState({ isOpen: true, targetPtyId: 'pty-1', targetTabName: 'zsh' })
    render(<PromptPalette />)
    expect(screen.getByRole('button', { name: /送信|send/i })).toBeDisabled()
  })

  it('Esc でパレットが閉じる', async () => {
    usePromptPaletteStore.setState({ isOpen: true, targetPtyId: 'pty-1', targetTabName: 'zsh' })
    render(<PromptPalette />)
    await userEvent.keyboard('{Escape}')
    expect(usePromptPaletteStore.getState().isOpen).toBe(false)
  })
})
```

### ストアテスト例

```typescript
// src/stores/promptPaletteStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { usePromptPaletteStore } from './promptPaletteStore'

beforeEach(() => {
  usePromptPaletteStore.setState({
    isOpen: false,
    targetPtyId: null,
    targetTabName: null,
    drafts: {},
  })
})

describe('promptPaletteStore', () => {
  it('open でフラグと送信先がセットされる', () => {
    usePromptPaletteStore.getState().open('pty-1', 'zsh')
    const s = usePromptPaletteStore.getState()
    expect(s.isOpen).toBe(true)
    expect(s.targetPtyId).toBe('pty-1')
    expect(s.targetTabName).toBe('zsh')
  })

  it('setDraft / getDraft がタブごとに独立', () => {
    const { setDraft, getDraft } = usePromptPaletteStore.getState()
    setDraft('pty-1', 'A')
    setDraft('pty-2', 'B')
    expect(getDraft('pty-1')).toBe('A')
    expect(getDraft('pty-2')).toBe('B')
  })

  it('clearDraft で該当タブの下書きが消える', () => {
    const s = usePromptPaletteStore.getState()
    s.setDraft('pty-1', 'A')
    s.clearDraft('pty-1')
    expect(usePromptPaletteStore.getState().drafts['pty-1']).toBeUndefined()
  })

  it('close で送信先がリセットされる', () => {
    const s = usePromptPaletteStore.getState()
    s.open('pty-1', 'zsh')
    s.close()
    const r = usePromptPaletteStore.getState()
    expect(r.isOpen).toBe(false)
    expect(r.targetPtyId).toBeNull()
    expect(r.targetTabName).toBeNull()
  })
})
```

### Rustテスト

F1 では Rust 側変更なし、追加テストなし。

## 設計上の決定事項

| 決定事項 | 理由 | 代替案 |
|---------|------|--------|
| F1 では `insertAtCaret` を実装しない | F2 で `usePathInsertion` のディスパッチ改修とセットで導入するほうが責務と PR 粒度が自然。F1 に前倒しするとデッドコードが混入 | F1 で no-op の `insertAtCaret` を置く（却下） |
| `write_pty` 失敗時のトーストは F3 で対応 | F1 の焦点は「誤送信の構造防止」。失敗時 UX の磨き込みは F3 の仕上げタスクに集約するほうが認知負荷が低い | F1 でトースト実装（受け入れ基準 15 を前倒し） |
| `Ctrl+Tab` / `F2` の skip 共通ガードは F3 で対応 | F1 の段階ではパレットが開いたまま画面遷移しても致命ではなく、F3 で一括整理するのが効率的。F1 のスコープを広げると PR が肥大化 | F1 で早期 return を先行実装 |
| 常時 `<PromptPalette />` をマウントし `isOpen` で表示制御 | Radix Dialog の標準パターン。フォーカストラップと `onOpenChange` の挙動が安定 | `isOpen` 時のみ条件レンダリング（却下、フォーカストラップの初期化差異が出やすい） |

## 未解決事項

- [ ] F1 段階では `AppLayout.tsx` のどこに `<PromptPalette />` をマウントするか（既存 `ShortcutsModal` と同じ箇所に並べるのが順当）。実装着手時に現行ツリーで決定。
- [ ] `TabContextMenu.tsx` のキーヒント表示要素を、他メニュー項目のスタイルと揃える方法（既存実装を確認してから決定）。
