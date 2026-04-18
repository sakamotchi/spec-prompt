# 設計書 - prompt-palette-f2

F2 のみに必要な変更点を詳細化する。全体設計の原典は `docs/local/20260415-プロンプト編集パレット/02_概要設計書.md` §2.2, §3.5。

## アーキテクチャ

### 対象コンポーネント

```
Tree Cmd+Click ──┐
TreeCtxMenu    ──┼─→ usePathInsertion.insertPath(paths)
PathPalette    ──┘            │
                              ▼
           ┌── パレット開 && targetPtyId あり? ──┐
           │                                    │
         Yes                                   No
           │                                    │
           ▼                                    ▼
promptPaletteStore.insertAtCaret(text)    tauriApi.writePty(ptyId, text)
           │                                    │
           ▼                                    ▼
   textarea を更新                        terminal:focus ディスパッチ
   drafts[ptyId] 同期
   フォーカスは textarea に維持
```

### 影響範囲

- **フロントエンド**: `promptPaletteStore` / `PromptPalette` / `usePathInsertion` / `PathPalette`
- **バックエンド（Rust）**: 変更なし

## 実装方針

### 概要

1. `promptPaletteStore` に textarea の ref と `insertAtCaret` を追加。ref は `PromptPalette` マウント時に登録、アンマウントで解除。
2. `usePathInsertion.insertPath` の先頭に「パレット開 && `targetPtyId` あり」分岐を追加。分岐一致時は `insertAtCaret(formatted)`、不一致時は従来どおり `writePty`。
3. `PathPalette`（`Ctrl+P`）の確定動作で、プロンプトパレット表示中の場合は `onCloseAutoFocus` での `terminal:focus` を抑止し、明示的に textarea にフォーカスを戻す。
4. ユニットテストで 2 つの分岐を担保。

### 詳細

1. **ストア拡張** — `src/stores/promptPaletteStore.ts`
2. **`PromptPalette` に ref 登録** — `useEffect` で登録・解除
3. **ディスパッチ分岐** — `src/hooks/usePathInsertion.ts` の `insertPath` 先頭に分岐
4. **`PathPalette` のフォーカス戻し** — `handleSelect` 後に `isOpen` を見て挙動切替
5. **テスト追加** — `promptPaletteStore.test.ts` / 新規 `usePathInsertion.test.ts`

## データ構造

### 型定義（TypeScript）

```typescript
// src/stores/promptPaletteStore.ts（F2 追加分）

import type { RefObject } from 'react'

export interface PromptPaletteState {
  // F1 から
  isOpen: boolean
  targetPtyId: string | null
  targetTabName: string | null
  drafts: Record<string, string>
  open: (ptyId: string, tabName: string) => void
  close: () => void
  setDraft: (ptyId: string, value: string) => void
  getDraft: (ptyId: string) => string
  clearDraft: (ptyId: string) => void

  // F2 追加
  textareaRef: RefObject<HTMLTextAreaElement | null> | null
  registerTextarea: (ref: RefObject<HTMLTextAreaElement | null> | null) => void
  insertAtCaret: (text: string) => void
}
```

### 型定義（Rust）

F2 では変更なし。

## API設計

### Tauriコマンド

F2 では新規追加なし。

### Tauriイベント

F2 では新規追加なし。

### フロントエンド API（ストア関数）

| 関数 | 引数 | 戻り値 | 説明 |
|---|---|---|---|
| `registerTextarea` | `ref: RefObject<HTMLTextAreaElement \| null> \| null` | `void` | textarea 参照を store に登録（null で解除） |
| `insertAtCaret` | `text: string` | `void` | キャレット位置（または選択範囲）を `text` で置換し drafts を同期 |

## UI設計

F2 では既存 UI を変更しない（`PromptPalette` の挙動のみ変わる）。

## 状態管理

### Zustandストア変更

- **`promptPaletteStore`**: `textareaRef`, `registerTextarea`, `insertAtCaret` を追加。
- `insertAtCaret` の擬似コード:

```typescript
insertAtCaret: (text) => {
  const state = get()
  const ptyId = state.targetPtyId
  const ta = state.textareaRef?.current
  if (!ptyId || !ta) return

  const start = ta.selectionStart ?? ta.value.length
  const end = ta.selectionEnd ?? ta.value.length
  const before = ta.value.slice(0, start)
  const after = ta.value.slice(end)
  const nextValue = before + text + after

  // drafts を同期し、textarea の value も更新
  set((s) => ({ drafts: { ...s.drafts, [ptyId]: nextValue } }))
  ta.value = nextValue
  const caret = before.length + text.length
  ta.setSelectionRange(caret, caret)
  ta.focus()

  // React controlled input の値と DOM の value が乖離するので input イベントも発火
  ta.dispatchEvent(new Event('input', { bubbles: true }))
}
```

> 実装時の注意: React 管理下の textarea を `ta.value = …` で直接書き換えると controlled 値との不整合が起きる。**drafts の setState を先に行い、textarea の `value` は React の再レンダで反映させる**のが第一選択。ただし `setSelectionRange` は再レンダ後に実行する必要があるため、`setState` 後に `requestAnimationFrame` でキャレットを合わせる方針に倒す。以下が実装形：

```typescript
insertAtCaret: (text) => {
  const state = get()
  const ptyId = state.targetPtyId
  const ta = state.textareaRef?.current
  if (!ptyId || !ta) return

  const start = ta.selectionStart ?? ta.value.length
  const end = ta.selectionEnd ?? ta.value.length
  const before = ta.value.slice(0, start)
  const after = ta.value.slice(end)
  const nextValue = before + text + after
  const caret = before.length + text.length

  set((s) => ({ drafts: { ...s.drafts, [ptyId]: nextValue } }))

  // 再レンダ後にキャレット位置を復元
  requestAnimationFrame(() => {
    const cur = get().textareaRef?.current
    if (!cur) return
    cur.focus()
    cur.setSelectionRange(caret, caret)
  })
}
```

### `usePathInsertion` 分岐（擬似コード）

```typescript
export function usePathInsertion() {
  const projectRoot = useAppStore((s) => s.projectRoot)
  const pathFormat = useAppStore((s) => s.pathFormat)

  const insertPath = useCallback(
    (filePath: string | string[]) => {
      const paths = Array.isArray(filePath) ? filePath : [filePath]
      const formatted = paths.map((p) => {
        if (pathFormat === 'relative' && projectRoot) {
          const prefix = projectRoot.endsWith('/') ? projectRoot : projectRoot + '/'
          return p.startsWith(prefix) ? p.slice(prefix.length) : p
        }
        return p
      })
      const text = formatted.join(' ') + ' '

      // ---- F2 追加: パレット分岐 ----
      const palette = usePromptPaletteStore.getState()
      if (palette.isOpen && palette.targetPtyId) {
        palette.insertAtCaret(text)
        return
      }
      // -------------------------------

      // 既存: PTY 直書き込み
      const { primary } = useTerminalStore.getState()
      const activeTab = primary.tabs.find((t) => t.id === primary.activeTabId)
      const ptyId = activeTab?.ptyId
      if (ptyId) {
        tauriApi.writePty(ptyId, text).catch(console.error)
        window.dispatchEvent(new CustomEvent('terminal:focus'))
      }
    },
    [projectRoot, pathFormat],
  )

  return { insertPath }
}
```

### `PathPalette` 確定時のフォーカス戻し（擬似コード）

```typescript
const handleSelect = useCallback(
  (item: PathItem) => {
    insertPath(item.path)
    onClose() // Ctrl+P を閉じる
  },
  [insertPath, onClose],
)

// Dialog.Content
onCloseAutoFocus={(e) => {
  e.preventDefault()
  // プロンプトパレット表示中なら textarea にフォーカスを戻す
  const palette = usePromptPaletteStore.getState()
  if (palette.isOpen && palette.textareaRef?.current) {
    palette.textareaRef.current.focus()
    return
  }
  window.dispatchEvent(new CustomEvent('terminal:focus'))
}}
```

## テストコード

### ストアテスト例（追記分）

```typescript
import { createRef } from 'react'

it('registerTextarea() で textarea ref が保存される', () => {
  const ref = createRef<HTMLTextAreaElement>()
  usePromptPaletteStore.getState().registerTextarea(ref)
  expect(usePromptPaletteStore.getState().textareaRef).toBe(ref)
})

it('insertAtCaret() でキャレット位置に text が挿入され drafts が同期する', async () => {
  const ta = document.createElement('textarea')
  ta.value = 'ab' + 'cd'
  ta.selectionStart = 2
  ta.selectionEnd = 2
  const ref = { current: ta }

  usePromptPaletteStore.setState({
    isOpen: true,
    targetPtyId: 'pty-1',
    targetTabName: 'zsh',
    drafts: { 'pty-1': 'abcd' },
  })
  usePromptPaletteStore.getState().registerTextarea(ref as any)

  usePromptPaletteStore.getState().insertAtCaret('XYZ')
  expect(usePromptPaletteStore.getState().drafts['pty-1']).toBe('abXYZcd')
})

it('insertAtCaret() は targetPtyId が null のとき no-op', () => {
  const ref = { current: document.createElement('textarea') }
  usePromptPaletteStore.setState({
    isOpen: false,
    targetPtyId: null,
    drafts: {},
  })
  usePromptPaletteStore.getState().registerTextarea(ref as any)
  usePromptPaletteStore.getState().insertAtCaret('X')
  expect(usePromptPaletteStore.getState().drafts).toEqual({})
})
```

### フックテスト例（新規）

```typescript
// src/hooks/usePathInsertion.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePathInsertion } from './usePathInsertion'
import { useAppStore } from '../stores/appStore'
import { useTerminalStore } from '../stores/terminalStore'
import { usePromptPaletteStore } from '../stores/promptPaletteStore'

const writePtyMock = vi.fn<(id: string, data: string) => Promise<void>>()
const insertAtCaretMock = vi.fn<(text: string) => void>()

vi.mock('../lib/tauriApi', () => ({
  tauriApi: { writePty: (id: string, data: string) => writePtyMock(id, data) },
}))

beforeEach(() => {
  writePtyMock.mockReset().mockResolvedValue(undefined)
  insertAtCaretMock.mockReset()
  useAppStore.setState({ projectRoot: '/proj', pathFormat: 'relative' } as any)
  useTerminalStore.setState((s) => ({
    primary: { ...s.primary, tabs: [{ ...s.primary.tabs[0], ptyId: 'pty-1' }] },
  }))
  usePromptPaletteStore.setState({
    isOpen: false,
    targetPtyId: null,
    targetTabName: null,
    drafts: {},
    textareaRef: null,
    registerTextarea: usePromptPaletteStore.getState().registerTextarea,
    insertAtCaret: insertAtCaretMock,
    open: usePromptPaletteStore.getState().open,
    close: usePromptPaletteStore.getState().close,
    setDraft: usePromptPaletteStore.getState().setDraft,
    getDraft: usePromptPaletteStore.getState().getDraft,
    clearDraft: usePromptPaletteStore.getState().clearDraft,
  })
})

describe('usePathInsertion ディスパッチ', () => {
  it('パレット閉時は writePty が呼ばれる', () => {
    const { result } = renderHook(() => usePathInsertion())
    act(() => result.current.insertPath('/proj/foo.md'))
    expect(writePtyMock).toHaveBeenCalledWith('pty-1', 'foo.md ')
    expect(insertAtCaretMock).not.toHaveBeenCalled()
  })

  it('パレット開時は insertAtCaret が呼ばれる', () => {
    usePromptPaletteStore.setState({ isOpen: true, targetPtyId: 'pty-1', targetTabName: 'zsh' })
    const { result } = renderHook(() => usePathInsertion())
    act(() => result.current.insertPath('/proj/foo.md'))
    expect(insertAtCaretMock).toHaveBeenCalledWith('foo.md ')
    expect(writePtyMock).not.toHaveBeenCalled()
  })

  it('複数パスはスペース区切りで挿入される', () => {
    usePromptPaletteStore.setState({ isOpen: true, targetPtyId: 'pty-1', targetTabName: 'zsh' })
    const { result } = renderHook(() => usePathInsertion())
    act(() => result.current.insertPath(['/proj/a.md', '/proj/b.md']))
    expect(insertAtCaretMock).toHaveBeenCalledWith('a.md b.md ')
  })
})
```

### Rustテスト

F2 では Rust 変更なし、追加テストなし。

## 設計上の決定事項

| 決定事項 | 理由 | 代替案 |
|---------|------|--------|
| `insertAtCaret` は drafts を先に更新し、キャレット位置は `requestAnimationFrame` で復元 | React controlled input との整合性確保。`ta.value =` で直書きすると controlled 値と DOM の差異で次のキーストロークが上書きされる | `flushSync` + 直接 DOM 操作（却下、React の内部最適化を阻害） |
| パレット開かつ `targetPtyId=null` は no-op（PTY へフォールバックしない） | この組み合わせは本来発生しない（`open` で必ずセット）。セーフティネットとして明示的に早期 return | PTY へフォールバック（却下、期待と逆方向の挙動になりうる） |
| `PathPalette` の `onCloseAutoFocus` でプロンプトパレット検出 | 確定 → `onClose()` → Dialog の `onCloseAutoFocus` が走るフローに乗るのが副作用最小 | `handleSelect` の末尾で直接 `ref.focus()`（却下、Dialog の close アニメーションと競合する可能性） |
| 呼び出し側（`TreeNode` / `ContextMenu`）は改修しない | F2 の要点は「ディスパッチの内部分岐」。外部 API を維持することで既存テスト・他の呼び出し経路への影響を遮断 | 各呼び出し側で分岐（却下、重複・漏れが発生） |

## 未解決事項

- [ ] `usePathInsertion` で secondary pane のアクティブタブを解決していない既存の制限は F2 でも据え置く。F3 / F4 で検討するか別 Issue 化するかを後続フェーズで判断。
- [ ] `insertAtCaret` で挿入した直後に `drafts[ptyId]` の setState に伴う再レンダで textarea の `selectionStart` がブラウザ次第で 0 に戻るケースがあるかを手動で確認（ケース 6 で検証）。
