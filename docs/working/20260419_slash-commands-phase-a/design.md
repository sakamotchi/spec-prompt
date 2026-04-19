# 設計書 - Claude Code スラッシュコマンドサジェスト統合 Phase A

## アーキテクチャ

### 対象コンポーネント

```
Frontend (React/TypeScript)
    │
    ├── src/lib/slashSuggestItem.ts        ← 新規（型 + 合成関数）
    ├── src/lib/builtInCommands.ts         ← 新規（静的リスト）
    ├── src/components/PromptPalette/
    │    ├── SlashSuggest.tsx              ← 改修（セクション/バッジ）
    │    └── PromptPalette.tsx             ← 改修（handleSlashSelect 分岐）
    └── src/i18n/locales/{ja,en}.json      ← キー追加

Rust Backend — 変更なし
Tauri IPC — 追加なし
```

### 影響範囲

- **フロントエンド**:
  - `src/lib/` に 2 ファイル新規追加、テスト 2 ファイル
  - `src/components/PromptPalette/SlashSuggest.tsx` の候補レンダリング部を書き換え
  - `src/components/PromptPalette/PromptPalette.tsx` の `handleSlashSelect` を差し替え
  - i18n JSON に 4 キー追加
- **バックエンド（Rust）**: なし

---

## 実装方針

### 概要

1. まず **型基盤** を固める（`SlashSuggestItem` + `getSlashSuggestCandidates`）。Phase B 追加予定の `user-skill` / `project-skill` も型に含め、合成関数は空配列を受けても動く形にする
2. 次に **静的リスト** を用意（`BUILT_IN_COMMANDS`）
3. 合成関数の単体テストを先に書き切って**型と挙動を固定**する
4. 最後に **UI** と **選択時挙動** を実装。既存のキー操作・fuzzy ロジックを踏襲しつつセクション対応に書き換える

### 詳細

1. `SlashSuggestItem` と `getSlashSuggestCandidates` を定義（F-1）
2. `BUILT_IN_COMMANDS` を `builtInCommands.ts` に定義（F-2）
3. `getSlashSuggestCandidates` の単体テスト（fuzzy・衝突解決・順序・maxPerSection）
4. `SlashSuggest.tsx` を書き換え、セクション見出しとバッジを描画（F-3）
5. `PromptPalette.tsx` の `handleSlashSelect` を kind 分岐に改修（F-4）
6. `templateApply.ts` に `insertInlineCommand(name)` ヘルパ追加
7. i18n キー追加（F-5）
8. 既存テストの更新 + 新規テスト追加
9. `npx tauri dev` で手動動作確認

---

## データ構造

### 型定義（TypeScript）

```typescript
// src/lib/slashSuggestItem.ts

import type { PromptTemplate } from '../stores/promptPaletteStore'

export type SlashSuggestKind =
  | 'template'
  | 'builtin'
  | 'user-skill'       // Phase B で使用
  | 'project-skill'    // Phase B で使用

export type SlashSuggestItem =
  | {
      kind: 'template'
      id: string
      name: string
      body: string
      description?: string
    }
  | {
      kind: 'builtin'
      name: string
      description: string
    }
  | {
      kind: 'user-skill'
      name: string
      description?: string
      argumentHint?: string
      path: string
    }
  | {
      kind: 'project-skill'
      name: string
      description?: string
      argumentHint?: string
      path: string
    }

export interface SlashSuggestSection {
  kind: SlashSuggestKind
  labelKey: string  // i18n キー
  badgeKey: string  // i18n キー
  items: SlashSuggestItem[]
}

export interface GetCandidatesInput {
  templates: PromptTemplate[]
  builtIns: BuiltInCommand[]
  // Phase B 予約（Phase A では空配列が渡される想定）
  userSkills?: SkillMetadata[]
  projectSkills?: SkillMetadata[]
  query: string
  maxPerSection?: number
}

export function getSlashSuggestCandidates(
  input: GetCandidatesInput,
): SlashSuggestSection[]
```

```typescript
// src/lib/builtInCommands.ts

export interface BuiltInCommand {
  name: string
  description: string
}

export const BUILT_IN_COMMANDS: BuiltInCommand[] = [
  // 組み込みコマンド
  { name: 'resume',      description: 'Resume a previous session' },
  { name: 'clear',       description: 'Clear the current conversation' },
  { name: 'compact',     description: 'Compact conversation history' },
  { name: 'help',        description: 'Show help' },
  { name: 'model',       description: 'Change the model' },
  { name: 'config',      description: 'Open settings' },
  { name: 'context',     description: 'Show context usage' },
  { name: 'cost',        description: 'Show session cost' },
  { name: 'usage',       description: 'Show usage statistics' },
  { name: 'doctor',      description: 'Run diagnostics' },
  { name: 'feedback',    description: 'Send feedback' },
  { name: 'login',       description: 'Log in to Anthropic' },
  { name: 'logout',      description: 'Log out' },
  { name: 'exit',        description: 'Exit Claude Code' },
  { name: 'permissions', description: 'Manage tool permissions' },
  { name: 'effort',      description: 'Change reasoning effort' },
  { name: 'theme',       description: 'Change color theme' },
  { name: 'rename',      description: 'Rename the current session' },
  { name: 'rewind',      description: 'Rewind to a checkpoint' },
  { name: 'branch',      description: 'Branch the conversation' },
  { name: 'diff',        description: 'Show conversation diff' },
  { name: 'desktop',     description: 'Switch to desktop app' },
  { name: 'teleport',    description: 'Pull web session into terminal' },
  // バンドル Skill
  { name: 'debug',       description: 'Enable debug logging and diagnostics' },
  { name: 'simplify',    description: 'Review code quality and auto-fix' },
  { name: 'batch',       description: 'Large-scale parallel changes' },
  { name: 'loop',        description: 'Run a prompt on a recurring interval' },
  { name: 'claude-api',  description: 'Load Claude API reference automatically' },
]
```

### 型定義（Rust）

Phase A では Rust 変更なし。

---

## API設計

### Tauriコマンド

Phase A では追加なし。

### Tauriイベント

Phase A では追加なし。

---

## UI設計

### UIライブラリ

| ライブラリ | 用途 | 備考 |
|-----------|------|------|
| （既存のみ、追加なし） | — | `SlashSuggest` は既存の `div` ベース実装を継続 |

### カラーパレット

既存のみ使用：
- セクション見出し: `--color-text-muted` 文字
- バッジ背景: `--color-bg-panel`
- バッジ文字: `--color-text-muted`
- アクティブ行: 既存の `--color-accent` 背景 + 白文字

### 画面構成

`SlashSuggest` のレイアウト（モックアップ）：

```
┌─ /rev ──────────────────────────────┐
│  CLAUDE CODE                         │  ← セクション見出し (i18n)
│  [CMD] review       Review a session │  ← activeIndex 非選択
│  [CMD] rewind       Rewind to ...    │
│                                      │
│  TEMPLATES                           │
│  [TPL] review-pr    Review PR #{{n}} │  ← activeIndex 選択（--color-accent）
└──────────────────────────────────────┘
```

- 各セクションは `role="group"` + `aria-label` 付き
- セクション間にマージンなし（既存の縦リズムを維持）
- 空セクションは非表示
- セクション見出しは `aria-hidden="true"`（スクリーンリーダ向けには role=group の label を使う）

### コンポーネント構成

`SlashSuggest.tsx` の内部構造：

```tsx
<div role="listbox" aria-label="slash-suggest">
  <div role="note">{title}</div>
  {sections.map((section) => (
    <div key={section.kind} role="group" aria-label={t(section.labelKey)}>
      <div aria-hidden="true" className="section-header">
        {t(section.labelKey)}
      </div>
      {section.items.map((item, i) => (
        <div role="option" aria-selected={globalIndex === activeIndex}>
          <Badge kind={item.kind} />
          <span>{item.name}</span>
          <span>{item.description}</span>
        </div>
      ))}
    </div>
  ))}
</div>
```

`activeIndex` は **セクションを跨いだグローバルインデックス**で管理（既存と同じ）。

---

## 状態管理

### Zustandストア変更

Phase A では `promptPaletteStore` に変更を加えない。Phase B で `skills` / `skillsLoadedAt` / `loadSkills` を追加する予定。

---

## テストコード

### Reactコンポーネントテスト例

```typescript
// src/lib/slashSuggestItem.test.ts
import { describe, it, expect } from 'vitest'
import { getSlashSuggestCandidates } from './slashSuggestItem'
import { BUILT_IN_COMMANDS } from './builtInCommands'

describe('getSlashSuggestCandidates', () => {
  const templates = [
    { id: 't1', name: 'review-pr', body: 'body' },
  ]

  it('空クエリで commands と templates を両方返す', () => {
    const sections = getSlashSuggestCandidates({
      templates,
      builtIns: BUILT_IN_COMMANDS,
      query: '',
    })
    expect(sections.map((s) => s.kind)).toEqual(['builtin', 'template'])
    expect(sections[0].items.length).toBeGreaterThan(0)
    expect(sections[1].items.length).toBe(1)
  })

  it('fuzzy クエリで横断マッチする', () => {
    const sections = getSlashSuggestCandidates({
      templates,
      builtIns: BUILT_IN_COMMANDS,
      query: 'rev',
    })
    const names = sections.flatMap((s) => s.items.map((i) => i.name))
    expect(names).toContain('review-pr')
    // 'review' / 'rewind' のどちらかは含まれる
  })

  it('maxPerSection でセクション毎に上限適用', () => {
    const sections = getSlashSuggestCandidates({
      templates,
      builtIns: BUILT_IN_COMMANDS,
      query: '',
      maxPerSection: 3,
    })
    sections.forEach((s) => expect(s.items.length).toBeLessThanOrEqual(3))
  })

  it('空セクションは結果に含めない', () => {
    const sections = getSlashSuggestCandidates({
      templates: [],
      builtIns: [],
      query: '',
    })
    expect(sections).toEqual([])
  })
})
```

```typescript
// src/components/PromptPalette/SlashSuggest.test.tsx（追加分）
it('セクション見出しとバッジが表示される', () => {
  // テンプレと BUILT_IN_COMMANDS 混在で render
  // "Claude Code" / "Templates" 見出しが出ること
  // 各行に "CMD" / "TPL" バッジが出ること
})

it('↓ キーでセクション境界を越える', () => {
  // activeIndex=0 (builtin 最後) で ↓ 押下 → activeIndex=1 (template 先頭)
})
```

### Rustテスト例

Phase A では Rust 変更なし。

---

## 設計上の決定事項

| 決定事項 | 理由 | 代替案 |
|---------|------|--------|
| Phase B の型 `user-skill` / `project-skill` も Phase A の時点で定義 | Phase B マージ時に型破壊を起こさず、合成関数の if 分岐も先取りで書ける | Phase A では 2 種別のみ定義し B で拡張 → 結合時の差分が大きくなる |
| 組み込みとバンドル Skill を同じ `builtin` kind で扱う | ユーザーから見てどちらも「常時サジェストされる Claude Code 機能」で区別する意味が薄い | 別 kind に分離 → 複雑化 + i18n/UI が膨張 |
| 選択時の挿入は `/<name> `（末尾スペース）のみ | 引数付きコマンド (`/review foo`) の入力余地を残す | `/<name>` のみ → 続けて引数を打つ際に手数が増える |
| `activeIndex` はセクション跨ぎのグローバル index | 既存実装の最小差分で ↑↓/Enter を維持できる | セクション内 index + section index の 2 軸管理 → ロジックが肥大化 |
| セクション見出しは i18n 化 | 将来の多言語対応のため。既存ドロップダウンも i18n 化されている | ハードコード → 既存方針と不整合 |
| バッジは `CMD` / `TPL` の 3 文字固定 | 横幅を一定に保ち、行の整列が崩れない | アイコン化 → 装飾コストが増える |

---

## 未解決事項

- [ ] 組み込みコマンド `/usage` は 2026-04 時点の公式 docs に記載があるが、バージョンによっては `/cost` に統合されている可能性 → 実機確認で有効なもののみ残すか全件残すかを TA-9 で判断
- [ ] バッジのカラーを kind 毎に変える案（CMD=青, TPL=緑）はスコープ外として初版ではすべて muted 系で統一。UX 評価後に Phase B 以降で再検討

## 追加変更（実装中に判明 / v1.2 反映）

### 1. キー委譲（PE-47）

初期設計では `SlashSuggest` の `onKeyDown` を自身のルート `<div>` に付けるだけだったが、実機では textarea にフォーカスがあり、keydown イベントが兄弟要素の SlashSuggest にはバブルしないことが判明。`forwardRef` + `useImperativeHandle` で `SlashSuggestHandle.handleKeyDown(e): boolean` を公開し、`PromptPalette.handleKeyDown` が textarea 上で最優先に委譲する構成に変更。これにより `↑`/`↓`/`Enter`/`Tab` すべてが textarea フォーカス時も動作する。副次的に **Tab で確定** のリクエストも同一経路で実現。

### 2. オーバーフロー抑止（PE-48）

候補が多い（組み込み 10 件 + テンプレ複数）と SlashSuggest が縦方向に伸び、`top: 1/3` に位置するパレットの下端がウィンドウ外に切れる問題が発生。候補リスト（ルート `<div>`）に `max-height: 40vh` + `overflow-y: auto` を付与し、`activeIndex` 変更時に該当行へ `scrollIntoView({ block: 'nearest' })` で可視範囲を追従させる実装を追加。各行には `data-slash-index={globalIndex}` を付けてクエリ対象にする。
