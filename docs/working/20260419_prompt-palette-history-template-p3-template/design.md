# 設計書 - prompt-palette-history-template-p3-template

## アーキテクチャ

### 対象コンポーネント

```
Frontend (React/TypeScript)
    ↓
PromptPalette.tsx (Radix Dialog, modal=false)
  ├─ ヘッダ
  │   ├─ HistoryButton (Phase 2)
  │   └─ TemplateButton (新: BookTemplate アイコン)
  ├─ 本文
  │   ├─ SlashSuggest (新・条件表示: textarea 先頭 /)
  │   ├─ PromptHistoryDropdown (Phase 2, 改修: 昇格アクション)
  │   ├─ PromptTemplateDropdown (新・条件表示)
  │   └─ textarea
  │       ├─ usePromptHistoryCursor (Phase 2)
  │       ├─ handleKeyDown → Tab プレースホルダ遷移 (新)
  │       └─ handleChange → historyCursor + slashSuggest 更新 (新)
  ├─ PromptTemplateEditor (新・条件表示: editorState !== null)
  └─ フッタ

promptPaletteStore (Phase 1 拡張済)
  ├─ templates / editorState / dropdown
  └─ upsertTemplate / removeTemplate / openEditor / closeEditor

templatePlaceholders (Phase 1)
  ├─ parsePlaceholders / findNextPlaceholder
  └─ findPreviousPlaceholder (新)
```

### 影響範囲

- **フロントエンド**:
  - 新設 3 コンポーネント + テスト
  - `PromptPalette.tsx` 改修
  - `PromptHistoryDropdown.tsx` 改修（昇格アクション追加）
  - `templatePlaceholders.ts` 拡張（`findPreviousPlaceholder`）
  - `shortcuts.ts` / i18n 更新
- **バックエンド（Rust）**: なし

## 実装方針

### 概要

1. Phase 2 の `PromptHistoryDropdown` / `usePromptHistoryCursor` と同構造でテンプレ側を実装し、UI パターンを揃える
2. テンプレエディタは Radix `Dialog`（子 Dialog）を使用。親 `PromptPalette` の `onPointerDownOutside` / `onEscapeKeyDown` 例外判定に `data-palette-dropdown="editor"` を追加
3. プレースホルダ Tab 遷移は `PromptPalette.tsx` の `handleKeyDown` に純関数ベースで実装（`templatePlaceholders` の find 系を使う）
4. `⌘T` / `Ctrl+T` はパレット内スコープのみ（`⌘H` と同じ段階剥離）
5. `SlashSuggest` は inline popover として textarea 直下に配置。クリップ表示や仮想スクロールはしない（上位 N=10 程度で打ち切り）
6. 履歴昇格は既存の `PromptHistoryDropdown` にアクションを足すだけで、エディタ側に `initialBody` を渡す経路を新設

### 詳細

1. **T3-1 テンプレドロップダウン**:
   - 構造は `PromptHistoryDropdown` のコピー起点で開始。差分は name + body の 2 フィールドの fuzzy 検索、行の二段表示、右端のアクションアイコン 3 種（Edit / Delete / Plus）
   - 「削除」は Radix `AlertDialog` を行内で開く（確認ダイアログ）
2. **T3-2 プレースホルダ選択状態化**:
   - 共通関数 `applyTemplateBody(ptyId, body)` を新設（または `PromptTemplateDropdown` の内部関数）
   - `setDraft(ptyId, body)` → `requestAnimationFrame` で textarea の `setSelectionRange(start, end)`
   - プレースホルダが無ければ末尾キャレット
3. **T3-3 エディタ**:
   - `Dialog.Root` をモーダル化して配置。内部に名前入力 + 本文 textarea + 保存・キャンセル・削除ボタン
   - バリデーションは `useMemo` で計算: `name` 空/長さ/重複、`body` 空/長さ
   - 重複は `templates` 配列から `id !== currentId && name === input.name` を検索
4. **T3-4 Tab 遷移**:
   - `handleKeyDown` に先頭付近で `Tab` を拾う。ただし他のキーハンドラ（`↑`/`↓`, `⌘H`, `⌘T`, `⌘Enter`）より後に判定
   - `templatePlaceholders.findNextPlaceholder(value, caret)` と `findPreviousPlaceholder(value, caret)` を利用
5. **T3-5 `⌘T` + SlashSuggest**:
   - `⌘T` は `handleKeyDown` で `⌘H` と並列実装。テンプレドロップダウンをトグル
   - `SlashSuggest` は `PromptPalette.tsx` 内部で `draft` を監視。先頭が `/` かつ最初の改行・空白までの文字列を query にする。候補 0 件でも UI は表示しない
6. **T3-6 昇格**:
   - 履歴行右端にアクションアイコンを追加（Phase 2 のレイアウト拡張）
   - クリック時に `openEditor({ mode: 'create', initialBody: entry.body })` + `closeDropdown()`
   - エディタ側で `initialBody` を受け取って本文の初期値にセット

## データ構造

### 型定義（TypeScript）

```typescript
// src/stores/promptPaletteStore.ts への追加（Phase 1 の PaletteEditorState を拡張）

export type PaletteEditorState =
  | { mode: 'create'; initialBody?: string }
  | { mode: 'edit'; templateId: string }
  | null
```

```typescript
// src/lib/templatePlaceholders.ts への追加

export function findPreviousPlaceholder(
  body: string,
  caret: number,
): Placeholder | null
```

```typescript
// src/components/PromptPalette/PromptTemplateDropdown.tsx

interface PromptTemplateDropdownProps {
  /** テスト用フック: テンプレ選択直後、流し込み前後で呼ばれる */
  onAfterSelect?: (template: PromptTemplate) => void
}
```

```typescript
// src/components/PromptPalette/PromptTemplateEditor.tsx

interface PromptTemplateEditorProps {
  /** テスト用フック: 保存ボタン押下で呼ばれる */
  onAfterSave?: (template: PromptTemplate) => void
}

type ValidationError =
  | { kind: 'nameEmpty' }
  | { kind: 'nameTooLong'; max: number }
  | { kind: 'nameDuplicate' }
  | { kind: 'bodyEmpty' }
  | { kind: 'bodyTooLong'; max: number }
```

```typescript
// src/components/PromptPalette/SlashSuggest.tsx

interface SlashSuggestProps {
  /** 親側で draft を管理しているため、サジェスト結果だけ返す */
  onSelect: (template: PromptTemplate) => void
  onClose: () => void
}
```

### 型定義（Rust）

本フェーズで Rust の変更なし。

## API設計

### Tauriコマンド

追加なし。

### Tauriイベント

追加なし。

## UI設計

### UIライブラリ

| ライブラリ | 用途 | 備考 |
|-----------|------|------|
| `@radix-ui/react-dialog` | エディタモーダル | 子 Dialog、`modal={true}` |
| `@radix-ui/react-alert-dialog` | 削除確認 | `dnd` の移動確認で既存実績あり |
| `lucide-react` | アイコン | `BookTemplate` / `Pencil` / `Trash2` / `FilePlus` / `Plus` / `Sparkles` |

### カラーパレット

既存 CSS カスタムプロパティ:
- `--color-bg-elevated` — ドロップダウン・エディタ背景
- `--color-bg-panel` — 入力フィールド背景
- `--color-border` — 境界・区切り
- `--color-accent` — 選択中行・保存ボタン
- `--color-text-primary` / `--color-text-muted` — テキスト色

プレースホルダ選択状態のハイライトはブラウザ標準の selection 色を利用（`::selection` でカスタマイズしない）。

### 画面構成

**テンプレドロップダウン表示時:**

```
┌───────────────────────────────────────┐
│ プロンプトを編集  → pty-1 に送信 [H][T]│
├───────────────────────────────────────┤
│ ┌─ テンプレート ───────────────────┐ │
│ │🔍 テンプレートを検索             │ │
│ │──────────────────────────────────│ │
│ │ 要約テンプレ    「{{path}}を要約」│ │ ← accent selected
│ │ テスト生成      「{{path}}のテスト…│ │
│ │ ...                              │ │
│ │ + 新規作成                        │ │
│ └──────────────────────────────────┘ │
│ [textarea]                           │
└───────────────────────────────────────┘
```

**エディタモーダル:**

```
┌── テンプレート編集 ──────────────────┐
│                                      │
│ 名前                                 │
│ [ 要約テンプレ              ]        │
│                                      │
│ 本文                                 │
│ ┌──────────────────────────────┐     │
│ │ 以下のファイルを要約してください│     │
│ │ {{path}}                      │     │
│ │ ...                           │     │
│ └──────────────────────────────┘     │
│                                      │
│ [削除]           [キャンセル] [保存]  │
└──────────────────────────────────────┘
```

**SlashSuggest:**

```
[textarea: /rev  ]
           ┌────────────────────────┐
           │ review       レビューし…│  ← selected
           │ review-pr    PR をレビ…│
           └────────────────────────┘
```

### コンポーネント構成

```
<PromptPalette>                                     (改修)
  <Dialog.Root modal={false}>
    <Dialog.Content
      onEscapeKeyDown={/* dropdown または editor があれば preventDefault */}
      onPointerDownOutside={/* data-palette-dropdown 全種を例外 */}
    >
      <Header>
        <HistoryButton />           (Phase 2)
        <TemplateButton />          (新)
      </Header>
      <Body>
        {slashSuggestOpen && <SlashSuggest />}      (新)
        {dropdown === 'history'  && <PromptHistoryDropdown />}   (Phase 2 改修)
        {dropdown === 'template' && <PromptTemplateDropdown />}  (新)
        <textarea onKeyDown={handleKeyDown + Tab 遷移} />
      </Body>
      <Footer />
    </Dialog.Content>
  </Dialog.Root>
  {editorState && <PromptTemplateEditor />}         (新, 子 Dialog)
</PromptPalette>
```

## 状態管理

### Zustandストア変更

**小幅な拡張のみ**。Phase 1 で導入済みの以下に加え、`PaletteEditorState.create` に `initialBody?: string` フィールドを追加する:

```typescript
// 変更前（Phase 1）
export type PaletteEditorState =
  | { mode: 'create' }
  | { mode: 'edit'; templateId: string }
  | null

// 変更後
export type PaletteEditorState =
  | { mode: 'create'; initialBody?: string }
  | { mode: 'edit'; templateId: string }
  | null
```

アクションや他の型は変更なし。

## テストコード

### Reactコンポーネントテスト例（PromptTemplateEditor）

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PromptTemplateEditor } from './PromptTemplateEditor'
import { usePromptPaletteStore } from '../../stores/promptPaletteStore'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))

function resetStore() {
  localStorage.removeItem('spec-prompt:prompt-palette')
  usePromptPaletteStore.setState({
    isOpen: true,
    targetPtyId: 'pty-1',
    drafts: {},
    history: [],
    templates: [],
    historyCursor: null,
    dropdown: 'none',
    editorState: { mode: 'create' },
  })
}

describe('PromptTemplateEditor', () => {
  beforeEach(() => {
    cleanup()
    resetStore()
  })

  it('create モードで保存するとテンプレが追加される', async () => {
    const user = userEvent.setup()
    render(<PromptTemplateEditor />)
    await user.type(screen.getByLabelText('promptPalette.template.editor.name'), 'test')
    await user.type(screen.getByLabelText('promptPalette.template.editor.body'), 'hello {{path}}')
    await user.click(screen.getByRole('button', { name: 'promptPalette.template.editor.save' }))
    const tpls = usePromptPaletteStore.getState().templates
    expect(tpls).toHaveLength(1)
    expect(tpls[0].name).toBe('test')
    expect(tpls[0].body).toBe('hello {{path}}')
  })

  it('name 重複のとき保存ボタンが disable', async () => {
    const user = userEvent.setup()
    usePromptPaletteStore.getState().upsertTemplate({ name: 'dup', body: '1' })
    render(<PromptTemplateEditor />)
    await user.type(screen.getByLabelText('promptPalette.template.editor.name'), 'dup')
    expect(screen.getByRole('button', { name: 'promptPalette.template.editor.save' })).toBeDisabled()
  })

  it('edit モードで初期値が設定される', () => {
    const t = usePromptPaletteStore.getState().upsertTemplate({ name: 'orig', body: 'orig-body' })
    usePromptPaletteStore.setState({
      editorState: { mode: 'edit', templateId: t.id },
    })
    render(<PromptTemplateEditor />)
    expect(screen.getByLabelText('promptPalette.template.editor.name')).toHaveValue('orig')
    expect(screen.getByLabelText('promptPalette.template.editor.body')).toHaveValue('orig-body')
  })

  it('create モードで initialBody が本文初期値になる', () => {
    usePromptPaletteStore.setState({
      editorState: { mode: 'create', initialBody: 'from history' },
    })
    render(<PromptTemplateEditor />)
    expect(screen.getByLabelText('promptPalette.template.editor.body')).toHaveValue('from history')
  })
})
```

### Vitest（templatePlaceholders 拡張）

```typescript
import { describe, it, expect } from 'vitest'
import { findPreviousPlaceholder } from './templatePlaceholders'

describe('findPreviousPlaceholder', () => {
  it('キャレット未満の最も近いプレースホルダを返す', () => {
    const body = '{{a}} {{b}} {{c}}'
    const p = findPreviousPlaceholder(body, 10)
    expect(p?.name).toBe('b')
  })

  it('キャレットが全プレースホルダより前なら null', () => {
    expect(findPreviousPlaceholder('{{a}}', 0)).toBeNull()
  })

  it('キャレットが最後のプレースホルダ後なら最後を返す', () => {
    const body = '{{a}} {{b}}'
    const p = findPreviousPlaceholder(body, body.length)
    expect(p?.name).toBe('b')
  })
})
```

### Rustテスト例

本フェーズで Rust の変更なし。

## 設計上の決定事項

| 決定事項 | 理由 | 代替案 |
|---------|------|--------|
| `⌘T` はパレット内スコープ限定 | グローバル `newTerminalTab` との衝突回避。Phase 2 の `⌘H` と一貫 | `⌘⇧T` に変更 |
| テンプレドロップダウンは履歴と別ファイル | UI が履歴と違う（2 フィールド検索・行内アクション・新規作成ボタン）。共通化は Phase 4 以降で検討 | 単一 `PromptPaletteDropdown` を generic に |
| `name` ユニーク検証はストアではなく UI | ストアは低レベル API（UPSERT）に徹する | ストアで例外 |
| プレースホルダ Tab 遷移は textarea 内限定 | フォーカストラップを避けるため、プレースホルダが無いときは通常 Tab | Dialog 内にフォーカスループを仕込む |
| SlashSuggest は先頭 `/` のみ | 誤爆防止（CLI オプション `--flag /path/to` と衝突しない） | 任意位置で発動 |
| 削除確認は `AlertDialog` | Radix が提供するアクセシブルなパターン | 独自モーダル |
| エディタは `modal={true}` の子 Dialog | 親パレットと操作を分離（背景への入力を明確にブロック） | Popover でインライン表示 |
| `initialBody` フィールドを `editorState.create` に追加 | 履歴昇格で再利用性の高い API | 履歴→テンプレ用に専用 action を新設 |

## 未解決事項

- [ ] SlashSuggest の表示位置（textarea の真下 / 右寄り）: 実装時に UI 調整。初期は textarea 直下中央寄せで試行
- [ ] Radix の `modal={true}` 子 Dialog を `modal={false}` 親 Dialog 内で使う際の focus trap 挙動: 実装時に確認、問題があれば `onInteractOutside` で対処
- [ ] テンプレ名の一覧ソート: 名前昇順を基本とするが、`updatedAt` 降順のオプションは将来検討
- [ ] プレースホルダ内に `{{path=foo}}` のようなデフォルト値記法: Phase 3 では未対応（将来拡張のメモ）
