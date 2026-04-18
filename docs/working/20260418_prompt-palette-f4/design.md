# 設計書 - prompt-palette-f4

F4（任意、v1.1 候補）の 2 項目を詳細化する。F1〜F3 の設計原典は `docs/local/20260415-プロンプト編集パレット/02_概要設計書.md`。

## アーキテクチャ

### 対象コンポーネント

```
TerminalTabs.tsx
  └─ TerminalPane
       └─ <TerminalBodyContextMenu ptyId={tab.ptyId} tabTitle={...}>  ← F4-1 新設
             └─ <TerminalPanel tabId ... />
                   └─ <TerminalRenderer ... />  （変更なし）

promptPaletteStore
  ├─ lastInsertAt: number  ← F4-2 追加（挿入シグナル）
  └─ insertAtCaret(text) — set({ lastInsertAt: state.lastInsertAt + 1 })

PromptPalette.tsx
  └─ useEffect([lastInsertAt]) → flashClass を 300ms 付与
                                 prefers-reduced-motion で短縮 / スキップ
```

### 影響範囲

- **フロントエンド**: `TerminalBodyContextMenu`（新規）, `TerminalTabs.tsx`（または `TerminalPanel.tsx`）, `promptPaletteStore`, `PromptPalette.tsx`, i18n
- **バックエンド（Rust）**: 変更なし

## 実装方針

### 概要

1. **F4-1**: `TerminalBodyContextMenu.tsx` を新設し、Radix ContextMenu で子要素をラップ。項目は「プロンプトを編集...」1 つ。`TerminalTabs` で `<TerminalPanel />` をラップする形で使う。`ptyId` が null のときは disabled。
2. **F4-2**: `promptPaletteStore` に `lastInsertAt: number` を追加し、`insertAtCaret` 実行時に単調増加させる。`PromptPalette.tsx` 側で `useEffect` + state で「直近の挿入から 300ms」の flash class を textarea に付与し、CSS アニメーションで見せる。`prefers-reduced-motion` を `window.matchMedia` で判定。

### 詳細

1. **新規コンポーネント `TerminalBodyContextMenu.tsx`**
   - props: `children`, `ptyId: string | null`, `tabTitle: string`
   - Radix `ContextMenu.Root` + `Trigger` + `Portal` + `Content` + `Item`
   - `onSelect`: `if (ptyId) usePromptPaletteStore.getState().open(ptyId, tabTitle)`
   - スタイルは `TabContextMenu` と揃える（既存の `menuItemClass` / `MenuItem` を共通化するなら別タスク。F4 ではコピーでも可）
2. **`TerminalTabs.tsx` でラップ**
   - 現状 `<TerminalPanel tabId cwd isActive />` をそのまま表示している部分を `<TerminalBodyContextMenu>` で包む
   - `ptyId` は `tab.ptyId`、`tabTitle` は `computeDisplayTitle(tab)` を使う
3. **`promptPaletteStore` 拡張**
   - `lastInsertAt: number` を state に追加（初期値 0）
   - `insertAtCaret` 内で `set({ lastInsertAt: get().lastInsertAt + 1 })` を追加
   - ref null / targetPtyId null で早期 return するケースはカウントしない
4. **`PromptPalette.tsx` でフラッシュ**
   - `const lastInsertAt = usePromptPaletteStore((s) => s.lastInsertAt)`
   - `const [flashing, setFlashing] = useState(false)`
   - `useEffect(() => { if (!lastInsertAt) return; ...; setFlashing(true); const id = setTimeout(() => setFlashing(false), duration); return () => clearTimeout(id) }, [lastInsertAt])`
   - `duration` は `prefers-reduced-motion: reduce` のとき 0（スキップ）ないし 100ms。通常は 300ms。
   - textarea の style に `flashing ? { boxShadow: '0 0 0 2px var(--color-accent)', transition: 'box-shadow 100ms' } : {}` を混ぜる（または CSS class 切替）

## データ構造

### 型定義（TypeScript）

```ts
// src/stores/promptPaletteStore.ts（F4 追加分）
export interface PromptPaletteState {
  // 既存...
  lastInsertAt: number  // F4: 挿入シグナル（単調増加）
}
```

### 型定義（Rust）

F4 では変更なし。

## API設計

### Tauriコマンド

F4 では新規追加なし。

### Tauriイベント

F4 では新規追加なし。

### フロントエンド API（新規コンポーネント）

| コンポーネント | Props | 説明 |
|---|---|---|
| `TerminalBodyContextMenu` | `{ children, ptyId, tabTitle }` | ターミナル本体をラップし右クリックで「プロンプトを編集...」を表示 |

## UI設計

### UIライブラリ

| ライブラリ | 用途 | 備考 |
|---|---|---|
| `@radix-ui/react-context-menu` | ターミナル本体右クリックメニュー | 既存 `TabContextMenu` と同ライブラリ |

### カラーパレット

- 挿入フラッシュは `--color-accent` を用いた `box-shadow` で表現
- メニュー本体のスタイルは `TabContextMenu` と同じ CSS 変数

### 画面構成

- メニュー項目は 1 つだけ。アイコン `MessageSquarePlus`（`TabContextMenu` と揃える）
- キーヒントはプラットフォーム別に `⌘⇧P` / `Ctrl+⇧+P`

### コンポーネント構成

```tsx
// TerminalBodyContextMenu.tsx（抜粋）
import * as RadixContextMenu from '@radix-ui/react-context-menu'
import { MessageSquarePlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { usePromptPaletteStore } from '../../stores/promptPaletteStore'

const IS_MAC =
  typeof navigator !== 'undefined' && /Mac|iP(hone|od|ad)/.test(navigator.platform)

interface Props {
  children: React.ReactNode
  ptyId: string | null
  tabTitle: string
}

export function TerminalBodyContextMenu({ children, ptyId, tabTitle }: Props) {
  const { t } = useTranslation()
  const shortcut = IS_MAC ? '⌘⇧P' : 'Ctrl+⇧+P'

  return (
    <RadixContextMenu.Root>
      <RadixContextMenu.Trigger asChild>{children}</RadixContextMenu.Trigger>
      <RadixContextMenu.Portal>
        <RadixContextMenu.Content
          className="min-w-[220px] rounded py-1 shadow-lg z-50"
          style={{
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border)',
          }}
        >
          <RadixContextMenu.Item
            disabled={!ptyId}
            onSelect={() => {
              if (!ptyId) return
              usePromptPaletteStore.getState().open(ptyId, tabTitle)
            }}
            className="flex items-center gap-2 px-3 h-7 cursor-pointer outline-none select-none text-xs"
            style={{ color: 'var(--color-text-primary)' }}
          >
            <MessageSquarePlus size={12} />
            <span className="flex-1">{t('promptPalette.menu.openPalette')}</span>
            <span className="ml-4 font-mono" style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem' }}>
              {shortcut}
            </span>
          </RadixContextMenu.Item>
        </RadixContextMenu.Content>
      </RadixContextMenu.Portal>
    </RadixContextMenu.Root>
  )
}
```

## 状態管理

### Zustandストア変更

```ts
// src/stores/promptPaletteStore.ts（F4 変更分のみ抜粋）
export interface PromptPaletteState {
  // 既存...
  lastInsertAt: number
}

export const usePromptPaletteStore = create<PromptPaletteState>((set, get) => ({
  // 既存初期値...
  lastInsertAt: 0,

  insertAtCaret: (text) => {
    const state = get()
    const ptyId = state.targetPtyId
    const ta = state.textareaRef?.current
    if (!ptyId || !ta) return
    // ... 既存の挿入処理 ...
    set((s) => ({
      drafts: { ...s.drafts, [ptyId]: nextValue },
      lastInsertAt: s.lastInsertAt + 1,
    }))
    // ... rAF でキャレット復元 ...
  },
}))
```

### フラッシュ実装（PromptPalette.tsx 追記）

```tsx
const lastInsertAt = usePromptPaletteStore((s) => s.lastInsertAt)
const [flashing, setFlashing] = useState(false)
const prefersReduced = typeof window !== 'undefined'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches

useEffect(() => {
  if (!lastInsertAt) return
  if (prefersReduced) return // 動きを減らす設定はスキップ
  setFlashing(true)
  const id = setTimeout(() => setFlashing(false), 300)
  return () => clearTimeout(id)
}, [lastInsertAt, prefersReduced])

// textarea の style
style={{
  // 既存 ...
  boxShadow: flashing ? '0 0 0 2px var(--color-accent)' : 'none',
  transition: 'box-shadow 120ms ease-out',
}}
```

## テストコード

### ストアテスト（`promptPaletteStore.test.ts` 追記）

```ts
it('insertAtCaret() で lastInsertAt がインクリメントされる', () => {
  const { ref } = makeTextareaRef('', [0, 0])
  usePromptPaletteStore.setState({
    isOpen: true,
    targetPtyId: 'pty-1',
    targetTabName: 'zsh',
    drafts: { 'pty-1': '' },
    lastInsertAt: 0,
  })
  usePromptPaletteStore.getState().registerTextarea(ref)
  usePromptPaletteStore.getState().insertAtCaret('X')
  expect(usePromptPaletteStore.getState().lastInsertAt).toBe(1)
  usePromptPaletteStore.getState().insertAtCaret('Y')
  expect(usePromptPaletteStore.getState().lastInsertAt).toBe(2)
})

it('insertAtCaret() が no-op のとき lastInsertAt は変わらない', () => {
  usePromptPaletteStore.setState({
    isOpen: false,
    targetPtyId: null,
    lastInsertAt: 5,
  })
  usePromptPaletteStore.getState().insertAtCaret('X')
  expect(usePromptPaletteStore.getState().lastInsertAt).toBe(5)
})
```

### コンポーネントテスト（`TerminalBodyContextMenu.test.tsx` 新規・必要に応じて）

- 項目クリックで `promptPaletteStore.open(ptyId, tabTitle)` が呼ばれる
- `ptyId=null` のときメニュー項目が disabled

### Rustテスト

F4 では Rust 変更なし。

## 設計上の決定事項

| 決定事項 | 理由 | 代替案 |
|---------|------|--------|
| 挿入ハイライトは textarea 全体フラッシュ（簡易版） | 文字単位ハイライトは textarea では DOM 的に実現困難。オーバーレイ実装は工数が v1.1 に収まらない | CodeMirror/Monaco へ置換（却下、スコープ爆発） |
| `lastInsertAt` は単調増加カウンタ（timestamp ではない） | 連続挿入で値が変わることを保証しやすく、テストも安定 | `Date.now()`（却下、同一 tick で値が変わらないケースがある） |
| ターミナル本体メニューは項目 1 つ | v1.1 のスコープを最小にする。コピー・ペースト・Clear はユーザー要望次第で v2 以降 | 複数項目を一度に追加（却下、右クリック既存挙動との調整コストが増える） |
| `TerminalBodyContextMenu` は新規ファイル（共通化しない） | `TabContextMenu` との共通化は v1.2 以降で検討。F4 では複製でシンプルに | 共通の `MenuItem` コンポーネントを抽出（却下、スコープ外） |
| `prefers-reduced-motion: reduce` のときはフラッシュをスキップ | アクセシビリティ配慮。既存プロジェクトに同設定を読むコードがないため新規対応 | 常時フラッシュ（却下、NFR の観点から不可） |

## 未解決事項

- [ ] ターミナル内でテキスト選択中に右クリックした場合、macOS では標準のコンテキストメニュー（コピー等）が出る環境もある。Radix ContextMenu は `onContextMenu` を `preventDefault` するため、今後コピー項目を追加するか別途検討する。
- [ ] F4-1 のテスト戦略：Radix ContextMenu の Trigger は実 DOM での右クリックイベントが必要で、jsdom でのテストは不安定。手動 E2E を主とし、最低限ストア連携部分（`open` 呼び出し）のみ自動化する方針。
