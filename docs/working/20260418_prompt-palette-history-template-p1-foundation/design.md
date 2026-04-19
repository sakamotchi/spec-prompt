# 設計書 - prompt-palette-history-template-p1-foundation

## アーキテクチャ

### 対象コンポーネント

```
Frontend (React/TypeScript)
    ↓
src/stores/promptPaletteStore.ts  ← スキーマ拡張 + persist
    ↓ persist middleware
localStorage (spec-prompt:prompt-palette)

src/lib/templatePlaceholders.ts    ← 純関数ユーティリティ（UI 非依存）

src/i18n/locales/{ja,en}.json       ← キー雛形追加
```

本フェーズは **フロントエンド完結**。Tauri IPC・Rust バックエンドへの変更は一切ない。

### 影響範囲

- **フロントエンド**:
  - `src/stores/promptPaletteStore.ts`（改修、後方互換維持）
  - `src/stores/promptPaletteStore.test.ts`（テスト追加）
  - `src/lib/templatePlaceholders.ts`（新設）
  - `src/lib/templatePlaceholders.test.ts`（新設）
  - `src/i18n/locales/ja.json`, `src/i18n/locales/en.json`（キー追加）
- **バックエンド（Rust）**: なし

## 実装方針

### 概要

1. ストアに履歴/テンプレの型・状態・アクションを追加するが、**UI からは参照しない**（Phase 2 以降で利用）
2. `persist` middleware でラップし、`history` と `templates` のみ localStorage に書き出す。ランタイム状態（`isOpen`, `drafts`, `dropdown`, `editorState` 等）は永続化対象外
3. プレースホルダパーサは **純関数として独立**。Zustand にも React にも依存しない（引数で body と caret を受け、位置情報だけ返す）
4. i18n キーは **構造だけ確定**。文字列は暫定値で OK（P2/P3 で推敲）

### 詳細

1. 既存 `PromptPaletteState` インターフェースを拡張し、型 `PromptHistoryEntry` / `PromptTemplate` / `DropdownKind` / `PaletteEditorState` を新規 export
2. `create<PromptPaletteState>(...)` を `create<PromptPaletteState>()(persist((set, get) => ({...}), { ... }))` に置き換える
3. 初期値は空配列（`history: []`, `templates: []`）、`historyCursor: null`, `dropdown: 'none'`, `editorState: null`
4. `pushHistory(body)` 実装: `body === history[0]?.body` なら no-op。そうでなければ先頭に push、101 件目以降は末尾から破棄
5. `setHistoryCursor(index)` 実装: null / 0〜history.length-1 の範囲にクランプ。範囲外は null
6. `upsertTemplate(template)` 実装: id なしなら `crypto.randomUUID()` で生成 + updatedAt セット → push。id ありなら同 id を上書き。name の重複チェックは**ストアでは行わず UI 側で実施**（Phase 3）
7. `removeTemplate(id)` 実装: `templates.filter(t => t.id !== id)`
8. `templatePlaceholders.ts` は正規表現 `/\{\{([^{}]*)\}\}/g` でパース、空 `{{}}` は無視
9. i18n キーはテンプレート末尾で列挙（§I18N 設計参照）

## データ構造

### 型定義（TypeScript）

```typescript
// src/stores/promptPaletteStore.ts

export type PromptHistoryEntry = {
  id: string         // crypto.randomUUID()
  body: string
  createdAt: number  // Date.now()
}

export type PromptTemplate = {
  id: string
  name: string
  body: string
  tags?: string[]    // 将来拡張用フィールド。Phase 1 では UI から保存しない
  updatedAt: number
}

export type DropdownKind = 'none' | 'history' | 'template'

export type PaletteEditorState =
  | { mode: 'create' }
  | { mode: 'edit'; templateId: string }
  | null

export interface PromptPaletteState {
  // 既存（変更なし）
  isOpen: boolean
  targetPtyId: string | null
  targetTabName: string | null
  drafts: Record<string, string>
  textareaRef: PromptPaletteTextareaRef | null
  lastInsertAt: number

  // 追加
  history: PromptHistoryEntry[]
  templates: PromptTemplate[]
  historyCursor: number | null
  dropdown: DropdownKind
  editorState: PaletteEditorState

  // 既存アクション（変更なし）
  open: (ptyId: string, tabName: string) => void
  close: () => void
  setDraft: (ptyId: string, value: string) => void
  getDraft: (ptyId: string) => string
  clearDraft: (ptyId: string) => void
  registerTextarea: (ref: PromptPaletteTextareaRef | null) => void
  insertAtCaret: (text: string) => void

  // 追加アクション
  pushHistory: (body: string) => void
  setHistoryCursor: (index: number | null) => void
  openDropdown: (kind: Exclude<DropdownKind, 'none'>) => void
  closeDropdown: () => void
  upsertTemplate: (template: Omit<PromptTemplate, 'id' | 'updatedAt'> & Partial<Pick<PromptTemplate, 'id'>>) => PromptTemplate
  removeTemplate: (id: string) => void
  openEditor: (state: NonNullable<PaletteEditorState>) => void
  closeEditor: () => void
}
```

```typescript
// src/lib/templatePlaceholders.ts

export type Placeholder = {
  /** 0-indexed start offset within body */
  start: number
  /** 0-indexed end offset (exclusive) */
  end: number
  /** placeholder name (without {{ }}) */
  name: string
}

export function parsePlaceholders(body: string): Placeholder[]

export function findNextPlaceholder(
  body: string,
  caret: number,
): Placeholder | null
```

### 型定義（Rust）

本フェーズで Rust 側の追加・変更なし。

## API設計

### Tauriコマンド

追加なし。

### Tauriイベント

追加なし。

## UI設計

### UIライブラリ

本フェーズで新規 UI コンポーネントの追加なし。

### カラーパレット

本フェーズで UI 変更なし。

### 画面構成

本フェーズで UI 変更なし。

### コンポーネント構成

本フェーズで UI 変更なし。

## 状態管理

### Zustandストア変更

```typescript
// src/stores/promptPaletteStore.ts

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// ... 型定義（上記参照） ...

const HISTORY_LIMIT = 100

export const usePromptPaletteStore = create<PromptPaletteState>()(
  persist(
    (set, get) => ({
      // 既存の初期値 + 既存アクション（現行と同一）
      isOpen: false,
      targetPtyId: null,
      targetTabName: null,
      drafts: {},
      textareaRef: null,
      lastInsertAt: 0,

      // 追加の初期値
      history: [],
      templates: [],
      historyCursor: null,
      dropdown: 'none',
      editorState: null,

      // --- 既存アクション（変更なし、省略） ---
      open: (ptyId, tabName) => set({ isOpen: true, targetPtyId: ptyId, targetTabName: tabName }),
      close: () => set({ isOpen: false, targetPtyId: null, targetTabName: null }),
      // ... 他既存アクション

      // --- 追加アクション ---
      pushHistory: (body) =>
        set((s) => {
          const trimmed = body.replace(/\s+$/u, '')
          if (trimmed.length === 0) return s
          if (s.history[0]?.body === trimmed) return s
          const entry: PromptHistoryEntry = {
            id: crypto.randomUUID(),
            body: trimmed,
            createdAt: Date.now(),
          }
          const next = [entry, ...s.history].slice(0, HISTORY_LIMIT)
          return { history: next, historyCursor: null }
        }),

      setHistoryCursor: (index) =>
        set((s) => {
          if (index === null) return { historyCursor: null }
          if (index < 0 || index >= s.history.length) return { historyCursor: null }
          return { historyCursor: index }
        }),

      openDropdown: (kind) => set({ dropdown: kind }),
      closeDropdown: () => set({ dropdown: 'none' }),

      upsertTemplate: (input) => {
        const now = Date.now()
        const id = input.id ?? crypto.randomUUID()
        const template: PromptTemplate = {
          id,
          name: input.name,
          body: input.body,
          tags: input.tags,
          updatedAt: now,
        }
        set((s) => {
          const existing = s.templates.findIndex((t) => t.id === id)
          if (existing >= 0) {
            const next = s.templates.slice()
            next[existing] = template
            return { templates: next }
          }
          return { templates: [...s.templates, template] }
        })
        return template
      },

      removeTemplate: (id) =>
        set((s) => ({ templates: s.templates.filter((t) => t.id !== id) })),

      openEditor: (editorState) => set({ editorState }),
      closeEditor: () => set({ editorState: null }),
    }),
    {
      name: 'spec-prompt:prompt-palette',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        history: state.history,
        templates: state.templates,
      }),
    },
  ),
)
```

## テストコード

### Reactコンポーネントテスト例

本フェーズでコンポーネント追加なし。

### Vitest（ストア）

```typescript
// src/stores/promptPaletteStore.test.ts への追加分

import { describe, it, expect, beforeEach } from 'vitest'
import { usePromptPaletteStore } from './promptPaletteStore'

describe('promptPaletteStore — Phase 1', () => {
  beforeEach(() => {
    // テスト間の状態リセット。persist の storage もクリア
    localStorage.clear()
    const s = usePromptPaletteStore.getState()
    s.close()
    // 既存フィールドを初期化する API が無いので直接 setState で戻す
    usePromptPaletteStore.setState({
      history: [],
      templates: [],
      historyCursor: null,
      dropdown: 'none',
      editorState: null,
    })
  })

  describe('pushHistory', () => {
    it('直前と同じ値は追加しない', () => {
      const { pushHistory } = usePromptPaletteStore.getState()
      pushHistory('hello')
      pushHistory('hello')
      expect(usePromptPaletteStore.getState().history).toHaveLength(1)
    })

    it('100 件上限で古い側が破棄される', () => {
      const { pushHistory } = usePromptPaletteStore.getState()
      for (let i = 0; i < 101; i++) pushHistory(`p-${i}`)
      const { history } = usePromptPaletteStore.getState()
      expect(history).toHaveLength(100)
      expect(history[0].body).toBe('p-100')
      expect(history[99].body).toBe('p-1')
    })

    it('末尾空白は trim される', () => {
      usePromptPaletteStore.getState().pushHistory('hi\n\n')
      expect(usePromptPaletteStore.getState().history[0].body).toBe('hi')
    })
  })

  describe('setHistoryCursor', () => {
    it('範囲外は null にクランプ', () => {
      const { pushHistory, setHistoryCursor } = usePromptPaletteStore.getState()
      pushHistory('a')
      setHistoryCursor(5)
      expect(usePromptPaletteStore.getState().historyCursor).toBeNull()
    })
  })

  describe('upsertTemplate / removeTemplate', () => {
    it('id なしは新規作成される', () => {
      const t = usePromptPaletteStore.getState().upsertTemplate({ name: 'x', body: 'y' })
      expect(t.id).toBeDefined()
      expect(usePromptPaletteStore.getState().templates).toHaveLength(1)
    })

    it('id 指定は既存を上書きする', () => {
      const t = usePromptPaletteStore.getState().upsertTemplate({ name: 'x', body: 'y' })
      usePromptPaletteStore.getState().upsertTemplate({ id: t.id, name: 'x2', body: 'y2' })
      const tpls = usePromptPaletteStore.getState().templates
      expect(tpls).toHaveLength(1)
      expect(tpls[0].name).toBe('x2')
    })

    it('removeTemplate で対象のみ削除', () => {
      const a = usePromptPaletteStore.getState().upsertTemplate({ name: 'a', body: '1' })
      usePromptPaletteStore.getState().upsertTemplate({ name: 'b', body: '2' })
      usePromptPaletteStore.getState().removeTemplate(a.id)
      expect(usePromptPaletteStore.getState().templates).toHaveLength(1)
      expect(usePromptPaletteStore.getState().templates[0].name).toBe('b')
    })
  })
})
```

### Vitest（プレースホルダユーティリティ）

```typescript
// src/lib/templatePlaceholders.test.ts

import { describe, it, expect } from 'vitest'
import { parsePlaceholders, findNextPlaceholder } from './templatePlaceholders'

describe('parsePlaceholders', () => {
  it('複数のプレースホルダを位置付きで返す', () => {
    const body = 'Hello {{name}}, path: {{path}}'
    const result = parsePlaceholders(body)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ start: 6, end: 14, name: 'name' })
    expect(result[1]).toEqual({ start: 22, end: 30, name: 'path' })
  })

  it('空 {{}} は無視', () => {
    expect(parsePlaceholders('a{{}}b')).toEqual([])
  })

  it('閉じのない {{ は無視', () => {
    expect(parsePlaceholders('a{{name')).toEqual([])
  })

  it('ネストは外側だけ対象', () => {
    expect(parsePlaceholders('{{a{{b}}c}}')).toHaveLength(1)
  })
})

describe('findNextPlaceholder', () => {
  it('キャレット以降の次を返す', () => {
    const body = '{{a}} {{b}}'
    const next = findNextPlaceholder(body, 6)
    expect(next?.name).toBe('b')
  })

  it('見つからなければ null', () => {
    expect(findNextPlaceholder('no placeholders', 0)).toBeNull()
  })
})
```

### Rustテスト例

本フェーズで Rust の変更なし。

## I18N 設計

### ja.json 追加キー

```json
{
  "promptPalette": {
    "history": {
      "title": "履歴",
      "empty": "送信履歴はまだありません",
      "searchPlaceholder": "履歴を検索",
      "saveAsTemplate": "テンプレートとして保存",
      "ariaLabel": "送信履歴一覧",
      "openHint": "履歴を開く"
    },
    "template": {
      "title": "テンプレート",
      "empty": "テンプレートはまだ登録されていません",
      "searchPlaceholder": "テンプレートを検索",
      "new": "新規作成",
      "edit": "編集",
      "delete": "削除",
      "ariaLabel": "テンプレート一覧",
      "openHint": "テンプレートを開く",
      "editor": {
        "title": "テンプレート編集",
        "name": "名前",
        "body": "本文",
        "save": "保存",
        "cancel": "キャンセル",
        "deleteConfirm": "このテンプレートを削除しますか？"
      }
    },
    "hint": {
      "historyUp": "↑ で直近を呼び出し",
      "historyDown": "↓ で戻る",
      "historyOpen": "⌘H で履歴一覧",
      "templateOpen": "⌘T でテンプレート一覧"
    }
  }
}
```

### en.json 追加キー（構造は同一、文字列は暫定）

```json
{
  "promptPalette": {
    "history": {
      "title": "History",
      "empty": "No history yet",
      "searchPlaceholder": "Search history",
      "saveAsTemplate": "Save as template",
      "ariaLabel": "Send history list",
      "openHint": "Open history"
    },
    "template": {
      "title": "Templates",
      "empty": "No templates yet",
      "searchPlaceholder": "Search templates",
      "new": "New",
      "edit": "Edit",
      "delete": "Delete",
      "ariaLabel": "Templates list",
      "openHint": "Open templates",
      "editor": {
        "title": "Edit template",
        "name": "Name",
        "body": "Body",
        "save": "Save",
        "cancel": "Cancel",
        "deleteConfirm": "Delete this template?"
      }
    },
    "hint": {
      "historyUp": "↑ to recall last",
      "historyDown": "↓ to go back",
      "historyOpen": "⌘H for history",
      "templateOpen": "⌘T for templates"
    }
  }
}
```

## 設計上の決定事項

| 決定事項 | 理由 | 代替案 |
|---------|------|--------|
| 履歴は localStorage のみに保存 | プライバシー（端末ローカル閉域）と実装簡素化のため。Rust 側 I/O 不要 | `~/.config/spec-prompt/config.json` へ統合。将来テンプレ共有時に検討 |
| テンプレの name ユニーク性チェックは UI 側で実施 | ストアは低レベル API（UPSERT）に徹する。UI 側は編集中の name 衝突を即時バリデーションしたい | ストアで検証、重複時に例外を投げる |
| プレースホルダパーサは純関数 | UI 実装（Phase 3）を待たずにテスト可能にするため | Zustand selector で導出 |
| エスケープ `\{\{` は Phase 1 非対応 | Phase 1 スコープの限定と、実使用上の必要性が低いため | 正規表現を拡張（エスケープ対応） |
| i18n 文字列は暫定 OK | 構造が確定すれば UI 実装時に推敲できる | 今から確定する → 推敲コスト先払い |
| tags フィールドを型に含めるが UI 非対応 | 将来拡張時のスキーマ migration を避けるため、`version: 1` 時点で存在させる | 将来 `version: 2` で追加 |

## 未解決事項

- [ ] `crypto.randomUUID()` の Node.js（Vitest）環境での動作確認（`vitest` 20+ / Node 20+ で利用可）。非対応環境では `nanoid` をインストールする
- [ ] `persist` の `migrate` フックは Phase 1 で空実装のままで良いか（空 `{}` に戻す safety net を入れるかは Phase 4 で判断）
