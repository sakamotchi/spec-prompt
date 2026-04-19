# 設計書 - prompt-palette-history-template-p2-history

## アーキテクチャ

### 対象コンポーネント

```
Frontend (React/TypeScript)
    ↓
PromptPalette.tsx (Radix Dialog)
  ├─ ヘッダ
  │   └─ HistoryButton (新: lucide History アイコン)
  ├─ 本文
  │   ├─ textarea (既存)
  │   │   ├─ usePromptHistoryCursor hook (新)
  │   │   └─ handleChange → historyCursor リセット
  │   └─ PromptHistoryDropdown (新・条件表示)
  └─ フッタ (既存)

promptPaletteStore (Phase 1 拡張済み)
  ├─ history / historyCursor / dropdown
  ├─ pushHistory / setHistoryCursor
  └─ openDropdown / closeDropdown

tauriApi.writePty (既存、無改修)
```

### 影響範囲

- **フロントエンド**:
  - `src/components/PromptPalette/PromptPalette.tsx`（改修）
  - `src/components/PromptPalette/PromptPalette.test.tsx`（改修）
  - `src/components/PromptPalette/PromptHistoryDropdown.tsx`（新設）
  - `src/components/PromptPalette/PromptHistoryDropdown.test.tsx`（新設）
  - `src/hooks/usePromptHistoryCursor.ts`（新設）
  - `src/hooks/usePromptHistoryCursor.test.ts`（新設）
  - `src/lib/shortcuts.ts`（表示用エントリ追加）
  - `src/i18n/locales/ja.json` / `en.json`（コピー調整）
- **バックエンド（Rust）**: なし

## 実装方針

### 概要

1. 既存 `PromptPalette.tsx` の制御を壊さないよう、履歴関連ロジックは **hooks とサブコンポーネントに外出し**
2. ドロップダウンは別モーダルではなく Dialog 内の条件付き子要素として配置（`PathPalette` の構造に近い）
3. 送信後 `pushHistory` の追加は `clearDraft` 直前の 1 行追加のみ。他挙動は維持
4. ショートカット `⌘H` / `Ctrl+H` は `PromptPalette.tsx` の `handleKeyDown` 内でのみ処理（グローバル登録なし）
5. `↑` / `↓` 巡回は `usePromptHistoryCursor` でロジックをテスト可能な形に切り出し

### 詳細

1. `usePromptHistoryCursor` hook:
   - 引数: `{ textareaRef, isComposing }` — UI 側の状態を受け取るのみ、ストアアクセスはフック内で完結
   - 戻り値: `handleArrowKey(e: KeyboardEvent) => boolean`（処理した場合 true、プライマリイベントを preventDefault すべきフラグ）
   - 内部処理: ストアから `history`, `historyCursor`, `targetPtyId`, `drafts` を取得し、条件を満たせば `setDraft` / `setHistoryCursor` を呼ぶ
2. `PromptHistoryDropdown`:
   - Props: なし（ストア購読のみ）。あるいは `onSelect?: () => void` でテスト用フックを残す
   - 構造: 検索 input → リスト（`role="listbox"`、各行 `role="option"`）
   - 選択時: `setDraft(ptyId, entry.body)` → `closeDropdown()` → textarea にフォーカス戻し（既存 `registerTextarea` の ref 経由）
3. `PromptPalette.tsx` への組み込み:
   - ヘッダ末尾に `HistoryButton`（クリックで `openDropdown('history')`）
   - 本文領域に `{dropdown === 'history' && <PromptHistoryDropdown />}` を配置
   - `handleKeyDown` で `⌘H` / `Ctrl+H` と `↑` / `↓` のイベントを処理
   - `handleSubmit` 成功ブロックに `pushHistory(body)` を追加

## データ構造

### 型定義（TypeScript）

```typescript
// src/hooks/usePromptHistoryCursor.ts
import type { RefObject } from 'react'

export type UsePromptHistoryCursorArgs = {
  textareaRef: RefObject<HTMLTextAreaElement | null>
  isComposing: boolean
}

export type HistoryArrowHandler = (
  event: React.KeyboardEvent<HTMLTextAreaElement>,
) => boolean

export function usePromptHistoryCursor(
  args: UsePromptHistoryCursorArgs,
): { handleArrowKey: HistoryArrowHandler; resetCursor: () => void }
```

```typescript
// src/components/PromptPalette/PromptHistoryDropdown.tsx
import type { PromptHistoryEntry } from '../../stores/promptPaletteStore'

interface PromptHistoryDropdownProps {
  /** テストからの選択ハンドラ注入（省略時は流し込み→ドロップダウン閉のみ）*/
  onAfterSelect?: (entry: PromptHistoryEntry) => void
}
```

### 型定義（Rust）

本フェーズで Rust の変更なし。

## API設計

### Tauriコマンド

追加なし（`tauriApi.writePty` を既存の通り使用）。

### Tauriイベント

追加なし。

## UI設計

### UIライブラリ

| ライブラリ | 用途 | 備考 |
|-----------|------|------|
| `@radix-ui/react-dialog` | パレット本体（既存） | 改修なし |
| `lucide-react` | `History` アイコン | `TabContextMenu` と同じサイズ感（14〜16px） |
| 既存 `PathPalette` パターン | fuzzy + ↑↓Enter | 実装を流用（ロジックは重複 OK、Phase 4 以降で共通化検討） |

### カラーパレット

既存 CSS カスタムプロパティを使用:
- `--color-bg-elevated` — ドロップダウン背景
- `--color-border` — ドロップダウンの境界・区切り
- `--color-accent` — 選択中行のハイライト
- `--color-text-primary` / `--color-text-muted` — テキスト色

### 画面構成

履歴ドロップダウンが開いているとき:

```
┌───────────────────────────────────────┐
│ プロンプトを編集  → pty-1 に送信   [H] │ ← ヘッダ（Hは履歴アイコン）
├───────────────────────────────────────┤
│ ┌─ 履歴 ─────────────────────────────┐ │
│ │🔍 履歴を検索                      │ │ ← 検索 input
│ │───────────────────────────────────│ │
│ │ echo hello                        │ │ ← 選択中（accent）
│ │ ls -la                            │ │
│ │ git status                        │ │
│ │  …                                │ │
│ └───────────────────────────────────┘ │
│                                       │
│  [textarea]                           │
│                                       │
├───────────────────────────────────────┤
│ Enter: 改行 · ⌘Enter: 送信 · Esc: 閉│
└───────────────────────────────────────┘
```

※ ドロップダウンが閉じているときは既存の見た目と変わらず。

### コンポーネント構成

```
<PromptPalette>                          ← 既存（改修）
  <Dialog.Root>
    <Dialog.Content>
      <Header>
        <Title />
        <TargetBadge />
        <HistoryButton onClick={openDropdown('history')} />   ← 新
      </Header>
      <Body>
        {dropdown === 'history' && <PromptHistoryDropdown />} ← 新
        <textarea ref={textareaRef} ... />
      </Body>
      <Footer />
    </Dialog.Content>
  </Dialog.Root>
</PromptPalette>
```

## 状態管理

### Zustandストア変更

**追加なし**。Phase 1 で導入した以下を利用:
- `history: PromptHistoryEntry[]`
- `historyCursor: number | null`
- `dropdown: DropdownKind`
- `pushHistory(body)`
- `setHistoryCursor(index)`
- `openDropdown(kind)` / `closeDropdown()`
- `setDraft(ptyId, value)`

## テストコード

### Reactコンポーネントテスト例

```typescript
// src/components/PromptPalette/PromptHistoryDropdown.test.tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PromptHistoryDropdown } from './PromptHistoryDropdown'
import { usePromptPaletteStore } from '../../stores/promptPaletteStore'

describe('PromptHistoryDropdown', () => {
  beforeEach(() => {
    localStorage.removeItem('spec-prompt:prompt-palette')
    usePromptPaletteStore.setState({
      history: [],
      dropdown: 'history',
      drafts: {},
      targetPtyId: 'pty-1',
      targetTabName: 'zsh',
      isOpen: true,
      historyCursor: null,
      templates: [],
      editorState: null,
    })
  })

  it('履歴 0 件のとき empty メッセージを表示', () => {
    render(<PromptHistoryDropdown />)
    expect(screen.getByText(/送信履歴はまだありません/)).toBeInTheDocument()
  })

  it('Enter で選択した履歴が textarea draft に流し込まれる', async () => {
    const user = userEvent.setup()
    usePromptPaletteStore.getState().pushHistory('echo hello')
    usePromptPaletteStore.getState().pushHistory('ls -la')
    render(<PromptHistoryDropdown />)
    await user.keyboard('{Enter}')
    expect(usePromptPaletteStore.getState().drafts['pty-1']).toBe('ls -la')
    expect(usePromptPaletteStore.getState().dropdown).toBe('none')
  })

  it('検索で絞り込める', async () => {
    const user = userEvent.setup()
    usePromptPaletteStore.getState().pushHistory('echo hello')
    usePromptPaletteStore.getState().pushHistory('ls -la')
    render(<PromptHistoryDropdown />)
    await user.type(screen.getByRole('textbox'), 'ls')
    expect(screen.getByText('ls -la')).toBeInTheDocument()
    expect(screen.queryByText('echo hello')).not.toBeInTheDocument()
  })
})
```

### Vitest（フック）

```typescript
// src/hooks/usePromptHistoryCursor.test.ts
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { usePromptHistoryCursor } from './usePromptHistoryCursor'
import { usePromptPaletteStore } from '../stores/promptPaletteStore'

describe('usePromptHistoryCursor', () => {
  beforeEach(() => {
    localStorage.removeItem('spec-prompt:prompt-palette')
    usePromptPaletteStore.setState({
      isOpen: true,
      targetPtyId: 'pty-1',
      targetTabName: 'zsh',
      drafts: {},
      history: [],
      historyCursor: null,
      templates: [],
      dropdown: 'none',
      editorState: null,
      lastInsertAt: 0,
      textareaRef: null,
    })
  })

  it('textarea が空のとき ↑ で直近履歴が流し込まれる', () => {
    const ta = document.createElement('textarea')
    const textareaRef = { current: ta }
    usePromptPaletteStore.getState().pushHistory('first')
    usePromptPaletteStore.getState().pushHistory('latest')

    const { result } = renderHook(() =>
      usePromptHistoryCursor({ textareaRef, isComposing: false }),
    )

    act(() => {
      result.current.handleArrowKey({
        key: 'ArrowUp',
        shiftKey: false,
        altKey: false,
        metaKey: false,
        ctrlKey: false,
        nativeEvent: { isComposing: false } as unknown as KeyboardEvent,
        preventDefault: () => {},
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>)
    })
    expect(usePromptPaletteStore.getState().drafts['pty-1']).toBe('latest')
    expect(usePromptPaletteStore.getState().historyCursor).toBe(0)
  })

  it('IME 変換中は発動しない', () => {
    const ta = document.createElement('textarea')
    const textareaRef = { current: ta }
    usePromptPaletteStore.getState().pushHistory('hello')
    const { result } = renderHook(() =>
      usePromptHistoryCursor({ textareaRef, isComposing: true }),
    )
    act(() => {
      result.current.handleArrowKey({
        key: 'ArrowUp',
        shiftKey: false,
        altKey: false,
        metaKey: false,
        ctrlKey: false,
        nativeEvent: { isComposing: true } as unknown as KeyboardEvent,
        preventDefault: () => {},
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>)
    })
    expect(usePromptPaletteStore.getState().drafts['pty-1']).toBeUndefined()
  })

  it('textarea が空でないときは発動しない', () => {
    const ta = document.createElement('textarea')
    ta.value = 'typing'
    const textareaRef = { current: ta }
    usePromptPaletteStore.getState().pushHistory('hello')
    usePromptPaletteStore.setState({ drafts: { 'pty-1': 'typing' } })

    const { result } = renderHook(() =>
      usePromptHistoryCursor({ textareaRef, isComposing: false }),
    )
    act(() => {
      result.current.handleArrowKey({
        key: 'ArrowUp',
        shiftKey: false,
        altKey: false,
        metaKey: false,
        ctrlKey: false,
        nativeEvent: { isComposing: false } as unknown as KeyboardEvent,
        preventDefault: () => {},
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>)
    })
    expect(usePromptPaletteStore.getState().drafts['pty-1']).toBe('typing')
  })

  it('最新より新しい側で ↓ を押すと空に戻る', () => {
    const ta = document.createElement('textarea')
    const textareaRef = { current: ta }
    usePromptPaletteStore.getState().pushHistory('a')
    usePromptPaletteStore.getState().pushHistory('b')
    const { result } = renderHook(() =>
      usePromptHistoryCursor({ textareaRef, isComposing: false }),
    )
    const makeEvent = (key: 'ArrowUp' | 'ArrowDown') =>
      ({
        key,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        ctrlKey: false,
        nativeEvent: { isComposing: false } as unknown as KeyboardEvent,
        preventDefault: () => {},
      }) as unknown as React.KeyboardEvent<HTMLTextAreaElement>

    act(() => result.current.handleArrowKey(makeEvent('ArrowUp'))) // cursor 0 = 'b'
    act(() => result.current.handleArrowKey(makeEvent('ArrowDown'))) // cursor null = ''
    expect(usePromptPaletteStore.getState().historyCursor).toBeNull()
    expect(usePromptPaletteStore.getState().drafts['pty-1']).toBe('')
  })
})
```

### Rustテスト例

本フェーズで Rust の変更なし。

## 設計上の決定事項

| 決定事項 | 理由 | 代替案 |
|---------|------|--------|
| `↑`/`↓` 巡回は textarea 値が空のときのみ発動 | 入力中の誤爆を避けるため。Bash/Zsh のヒストリ動作と近い | 常時発動し、編集中は警告表示 |
| 巡回ロジックを hook に分離 | UI テストを避けてロジック単独でテスト可能にするため | PromptPalette.tsx にインライン実装 |
| 選択＝即送信にはしない | 誤爆防止と一貫 UX（編集の余地を残す）のため | 履歴ドロップダウンでは Enter = 送信 |
| ドロップダウンは Dialog 内の子要素として配置 | `modal={false}` の Radix Dialog と相性が良く、別モーダルより UX が軽い | 別の Radix Popover を開く |
| `⌘H` はパレット内スコープ限定 | macOS の「ウィンドウを隠す」との衝突回避 | 廃止してアイコンクリックのみにする |
| 履歴 push は送信成功後の副作用 | 失敗時の誤登録防止 | 送信前に push、失敗時は pop |
| fuzzy 実装は `PathPalette` からコピー | 単純で信頼できる（既存パターン踏襲） | 共通 util 化 — Phase 4 で検討 |

## 未解決事項

- [ ] 相対日時の表示フォーマット（`1 分前` `2 時間前` `昨日` `3/14`）は簡易関数として実装するか、`Intl.RelativeTimeFormat` を使うか（実装時判断）
- [ ] `PromptHistoryDropdown` の表示幅: パレット幅（`w-[640px]`）いっぱいにするか、やや内寄せ（左右 12px マージン）にするか（UI 実装時判断、後者で開始）
- [ ] 1 行プレビューの最大長: 80 文字でトリム、改行を `↵` 記号に変換するか、スペースで置換するか（実装時判断、`↵` が可読性高そう）
