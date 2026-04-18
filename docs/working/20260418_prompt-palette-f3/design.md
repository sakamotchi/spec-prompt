# 設計書 - prompt-palette-f3

F3（体験の仕上げ）で必要な変更を詳細化する。全体設計の原典は `docs/local/20260415-プロンプト編集パレット/02_概要設計書.md` §2.4〜§2.6, §7。

## アーキテクチャ

### 対象コンポーネント

```
terminalStore.closeTab / handlePtyExited / closeActiveTab
    │
    │ (getState 経由で一方向参照)
    ▼
promptPaletteStore.clearDraft(ptyId)
promptPaletteStore.close()         ← targetPtyId === 閉じる ptyId なら

AppLayout.keydown リスナ
    │
    ├─ [先頭] if (promptPaletteStore.isOpen) { allow list 以外は早期 return }
    └─ 既存の Ctrl+P / Cmd+T / ... 分岐

PromptPalette.textarea
    ├─ onCompositionStart → setIsComposing(true)
    ├─ onCompositionEnd   → setIsComposing(false)
    └─ onKeyDown: Enter 送信判定時に (isComposing || e.nativeEvent.isComposing) を除外

PromptPalette.handleSubmit
    └─ await writePty 失敗時: toast.error(...) を呼び、close() / clearDraft() は呼ばない
```

### 影響範囲

- **フロントエンド**: `terminalStore`, `terminalStore.test.ts`, `PromptPalette.tsx`, `PromptPalette.test.tsx`, `AppLayout.tsx`, i18n
- **バックエンド（Rust）**: 変更なし

## 実装方針

### 概要

1. `terminalStore` のタブ閉鎖系 3 アクション（`closeTab` / `handlePtyExited` / `closeActiveTab`）で閉じられた `ptyId` を特定し、`promptPaletteStore.clearDraft` と、必要なら `close()` を呼ぶ。
2. `PromptPalette` に `isComposing` ローカル state を導入し、`compositionstart/end` と `e.nativeEvent.isComposing` の 2 段ガードで送信抑止。
3. `AppLayout` の keydown リスナ冒頭に `isOpen` 早期 return を配置し、allow list（`Ctrl+P` / `Cmd+Shift+P` / `Ctrl+Shift+P`）以外はスキップ。textarea 自体のキー入力は既存の `INPUT / TEXTAREA` 判定で通す。
4. `handleSubmit` の `await writePty(...)` を try/catch で包み、失敗時は `toast.error` を呼び、本文・パレットを維持。
5. テスト追加とドキュメント更新。

### 詳細

1. **terminalStore の閉鎖フック** — `closeTab` / `handlePtyExited` / `closeActiveTab` の返却前に該当 `ptyId` を決定し、`usePromptPaletteStore.getState()` 経由で `clearDraft`。`targetPtyId` 一致時は `close()`。
2. **IME 二重ガード** — `PromptPalette` の textarea に `onCompositionStart={() => setIsComposing(true)}` / `onCompositionEnd={() => setIsComposing(false)}` を付与。`handleKeyDown` の送信条件に `!(isComposing || e.nativeEvent.isComposing)` を追加。
3. **keydown 早期 return** — `AppLayout.useEffect` 内の `handler` 冒頭：
   ```ts
   if (usePromptPaletteStore.getState().isOpen) {
     const isCtrlP = ctrl && !meta && !shift && key === 'p'
     const isCmdShiftP = (meta || ctrl) && shift && (key === 'p' || key === 'P')
     if (!isCtrlP && !isCmdShiftP) return
   }
   ```
4. **トースト** — `handleSubmit` の既存 `catch (err) { console.error(...) }` を `toast.error(t('promptPalette.error.sendFailed', { message: String(err) }))` に置き換え。成功時のみ `clearDraft` / `close`。

## データ構造

### 型定義（TypeScript）

F3 で新規の型はなし。`terminalStore` / `promptPaletteStore` の既存型を使う。

### 型定義（Rust）

F3 では変更なし。

## API設計

### Tauriコマンド

F3 では新規追加なし。

### Tauriイベント

F3 では新規追加なし。

## UI設計

F3 では UI の追加は無し。既存 `ToastHost` を流用する。

## 状態管理

### Zustandストア変更

#### `terminalStore.ts` の閉鎖フック追加

```ts
import { usePromptPaletteStore } from './promptPaletteStore'

// ptyId を受け取り、下書き削除 + パレット close（targetPtyId 一致時）を行うヘルパー
function notifyPromptPaletteOfPtyClosed(ptyId: string | null | undefined) {
  if (!ptyId) return
  const palette = usePromptPaletteStore.getState()
  palette.clearDraft(ptyId)
  if (palette.targetPtyId === ptyId) {
    palette.close()
  }
}
```

呼び出し箇所（擬似コード）:

```ts
closeTab: (id, pane) =>
  set((state) => {
    const group = state[pane]
    if (group.tabs.length <= 1) return state
    const closing = group.tabs.find((t) => t.id === id)
    const newTabs = group.tabs.filter((t) => t.id !== id)
    const fallback = newTabs[newTabs.length - 1].id
    notifyPromptPaletteOfPtyClosed(closing?.ptyId)
    return { /* ... */ }
  }),
```

- `handlePtyExited` では「実際にタブが削除されたケース」でのみ呼ぶ（最後の 1 枚のシェル再起動ではタブ自体が存在し続けるので対象外、ただし古い ptyId は使われなくなるため `clearDraft(oldPtyId)` は呼んでよい）。安全側で「対象の ptyId」に対し無条件 `clearDraft` を呼ぶ設計で十分。
- `closeActiveTab` も同様に閉じる前の `activeTabId` の `ptyId` を取得して呼ぶ。

### `PromptPalette` の IME state 追加

```tsx
const [isComposing, setIsComposing] = useState(false)

// textarea props
onCompositionStart={() => setIsComposing(true)}
onCompositionEnd={() => setIsComposing(false)}

// handleKeyDown
if (
  e.key === 'Enter' &&
  (e.metaKey || e.ctrlKey) &&
  !e.shiftKey &&
  !e.altKey &&
  !(isComposing || e.nativeEvent.isComposing)
) {
  e.preventDefault()
  e.stopPropagation()
  void handleSubmit()
}
```

### `handleSubmit` のエラー処理

```tsx
const handleSubmit = useCallback(async () => {
  const state = usePromptPaletteStore.getState()
  const ptyId = state.targetPtyId
  if (!ptyId) return
  const body = (state.drafts[ptyId] ?? '').replace(/\s+$/u, '')
  if (body.length === 0) return
  try {
    await tauriApi.writePty(ptyId, body + '\n')
    state.clearDraft(ptyId)
    state.close()
    window.dispatchEvent(new CustomEvent('terminal:focus'))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    toast.error(t('promptPalette.error.sendFailed', { message }))
    // パレット・本文は維持
  }
}, [t])
```

## テストコード

### ストアテスト（`terminalStore.test.ts` 追記）

```ts
import { usePromptPaletteStore } from './promptPaletteStore'

beforeEach(() => {
  usePromptPaletteStore.setState({
    isOpen: false, targetPtyId: null, targetTabName: null,
    drafts: {}, textareaRef: null,
  })
})

it('closeTab でタブの ptyId に対応する下書きが破棄される', () => {
  const { setDraft } = usePromptPaletteStore.getState()
  setDraft('pty-1', 'A')
  setDraft('pty-2', 'B')
  // primary に pty-1/pty-2 を持つタブを仕込んでから closeTab
  // ...
  expect(usePromptPaletteStore.getState().drafts['pty-1']).toBeUndefined()
  expect(usePromptPaletteStore.getState().drafts['pty-2']).toBe('B')
})

it('closeTab が targetPtyId のタブを閉じたらパレットが close される', () => {
  usePromptPaletteStore.getState().open('pty-1', 'zsh')
  // ... closeTab で pty-1 を閉じる
  expect(usePromptPaletteStore.getState().isOpen).toBe(false)
})
```

### コンポーネントテスト（`PromptPalette.test.tsx` 追記）

```tsx
vi.mock('../Toast', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}))

it('compositionstart 中の Cmd+Enter は送信しない', async () => {
  // ...
  fireEvent.compositionStart(ta)
  fireEvent.keyDown(ta, { key: 'Enter', metaKey: true })
  expect(writePtyMock).not.toHaveBeenCalled()
  fireEvent.compositionEnd(ta)
  fireEvent.keyDown(ta, { key: 'Enter', metaKey: true })
  await Promise.resolve()
  expect(writePtyMock).toHaveBeenCalled()
})

it('writePty が reject した場合、toast.error が呼ばれパレットは開いたまま', async () => {
  const { toast } = await import('../Toast')
  writePtyMock.mockRejectedValueOnce(new Error('boom'))
  // ...
  expect(toast.error).toHaveBeenCalled()
  expect(usePromptPaletteStore.getState().isOpen).toBe(true)
  expect(usePromptPaletteStore.getState().drafts['pty-1']).toBe('echo hi')
})
```

### Rustテスト

F3 では Rust 変更なし、追加テストなし。

## 設計上の決定事項

| 決定事項 | 理由 | 代替案 |
|---------|------|--------|
| `terminalStore` → `promptPaletteStore` は import + `getState()` 参照 | 一方向依存で循環を回避。購読パターンよりシンプル | `promptPaletteStore` 側で `terminalStore` を subscribe（却下、閉じたタブの判定が複雑化） |
| `AppLayout` keydown 冒頭に allow list で早期 return | すべてのショートカット分岐に if を足すより一括ガードの方が保守性が高い | 個別に `if (isOpen) return` を散らす（却下、分岐漏れリスク） |
| IME ガードは state + `e.nativeEvent.isComposing` の OR で判定 | Safari / Firefox / Chromium で `isComposing` の発火タイミングに差があるため、state 側で保険をかける | state のみ / nativeEvent のみ（却下、確定直後の Enter を取りこぼす可能性） |
| 送信失敗時は toast のみで、再試行 UI は持たない | v1 スコープ外の体験。ユーザーは本文が残っていれば自分で Cmd+Enter を押せる | 自動リトライ or 再試行ボタン（却下、送信失敗の原因が特定できないため自動化は危険） |
| `handlePtyExited` でも `clearDraft` を呼ぶ（最後の 1 枚再起動でも） | ptyId が切り替わる前後で同じ ID は使われないので、古い ptyId の下書きを消して問題ない | 条件分岐で「タブが削除されたときだけ」（却下、ロジック複雑化・効果は同じ） |

## 未解決事項

- [ ] `AppLayout.tsx` の `Cmd+Shift+P` 自体の allow list 入り：重複起動防止の `isOpen` チェックは起動側ですでに実装済みだが、allow list に入れるかどうかの整合確認（入れなくても発火しないが、入れないとパレット表示中は Prompt Palette 側のショートカットが既存 keydown リスナを無視する挙動になる）。→ **allow list に入れる** 方針で実装する。
- [ ] IME 確認は macOS 日本語 IME（ことえり）で実施。Win/Linux の追加確認は `testing.md` の余力次第。
