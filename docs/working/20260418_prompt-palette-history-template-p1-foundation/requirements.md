# 要件定義書 - prompt-palette-history-template-p1-foundation

## 概要

プロンプトパレット履歴・テンプレート機能（プロジェクト `docs/projects/20260418-プロンプトパレット履歴テンプレート/`）のうち、**Phase 1: 基盤整備** に相当する作業。UI は追加せず、後続フェーズ（P2: 履歴 / P3: テンプレート / P4: 統合・仕上げ）で必要となる**ストア拡張・永続化・共通ユーティリティ・i18n 雛形**だけを先行して導入する。本フェーズ完了時点では既存 UX に変化は出ない。

- 親プロジェクト: `docs/projects/20260418-プロンプトパレット履歴テンプレート/`
- WBS 対応: Phase 1（T1-1〜T1-5）
- ブランチ: `feature/prompt-palette-history-template`

## 背景・目的

- Phase 2 以降で UI 実装に入る前に、データ構造・永続化の器を確定させておくことで、UI 実装時のストア API の揺れを最小化する
- `promptPaletteStore` は現状 `persist` が未適用。履歴とテンプレートを localStorage へ自動保存するために Phase 1 で middleware を差し込み、スキーマバージョンを立ち上げる
- プレースホルダ展開（`{{path}}` 等）は P3 のテンプレート機能の中核だが、パース・位置計算のロジックは UI から独立して純関数化できるため、ここで切り出してユニットテスト込みで完成させておく
- i18n キーは P2/P3 で多数追加する。事前に名前空間（`promptPalette.history.*` / `promptPalette.template.*` / `promptPalette.hint.*`）の雛形を用意しておけば、翻訳文字列の追加だけで UI 実装が進む

## 要件一覧

### 機能要件

#### F1-1: promptPaletteStore のスキーマ拡張（WBS T1-1）

- **説明**: 既存 `promptPaletteStore` に履歴・テンプレート・ドロップダウン表示・エディタ状態を管理するためのフィールドとアクションを追加する。UI からはまだ呼ばない
- **受け入れ条件**:
  - [ ] 型 `PromptHistoryEntry` / `PromptTemplate` / `DropdownKind` が追加されている
  - [ ] 状態に `history: PromptHistoryEntry[]`, `templates: PromptTemplate[]`, `historyCursor: number | null`, `dropdown: DropdownKind`, `editorState: ...` が追加されている
  - [ ] アクション `pushHistory(body)`, `setHistoryCursor(index)`, `openDropdown(kind)`, `closeDropdown()`, `upsertTemplate(template)`, `removeTemplate(id)`, `openEditor(mode, id?)`, `closeEditor()` が追加されている
  - [ ] `pushHistory` は直前の履歴と完全一致した場合は追加しない（連続重複排除）
  - [ ] `pushHistory` は 100 件を超えた場合、古い側から自動で削除する
  - [ ] 既存の `open` / `close` / `setDraft` / `insertAtCaret` / `registerTextarea` / `lastInsertAt` の挙動に変更がない（既存テスト全件グリーン）

#### F1-2: persist middleware の適用（WBS T1-2）

- **説明**: `promptPaletteStore` を `persist(..., { name: 'spec-prompt:prompt-palette', version: 1, partialize: ... })` でラップし、`history` と `templates` のみ localStorage に永続化する。ランタイム状態（`isOpen`, `targetPtyId`, `drafts`, `dropdown`, `editorState` 等）は永続化対象から除外する
- **受け入れ条件**:
  - [ ] `createJSONStorage(() => localStorage)` を明示的に指定（`appStore` と同じパターン）
  - [ ] `partialize` が `history` と `templates` のみ返す
  - [ ] `version: 1` が設定され、将来の `migrate` フックを受け入れる形になっている
  - [ ] 再起動後 `history` と `templates` が復元される（手動確認）
  - [ ] ランタイム状態は再起動時に初期値（例: `isOpen: false`）になる

#### F1-3: ストアテストの拡張（WBS T1-3）

- **説明**: `promptPaletteStore.test.ts` に Phase 1 で追加したロジックのテストを追加する
- **受け入れ条件**:
  - [ ] `pushHistory` の連続重複排除テスト（同じ値を 2 連続で push しても 1 件）
  - [ ] `pushHistory` の 100 件上限テスト（101 件目追加で最古の 1 件が消える）
  - [ ] `setHistoryCursor` の境界テスト（0 未満、履歴数以上の値は null にクランプ）
  - [ ] `upsertTemplate` の新規作成テスト（id 未指定 → 生成）
  - [ ] `upsertTemplate` の更新テスト（id 指定済み → 同 id を上書き）
  - [ ] `removeTemplate` の削除テスト
  - [ ] 既存テストが全件グリーンのまま

#### F1-4: プレースホルダユーティリティ（WBS T1-4）

- **説明**: テンプレート本文中の `{{...}}` を検出し、textarea の `setSelectionRange` に渡せる位置情報に変換する純関数モジュールを新規実装する。UI からの利用は P3 で行う
- **受け入れ条件**:
  - [ ] `src/lib/templatePlaceholders.ts` が新規作成されている
  - [ ] `parsePlaceholders(body: string): Placeholder[]` — 本文中の `{{...}}` の位置 `{ start, end, name }` のリストを返す
  - [ ] `findNextPlaceholder(body, caret): Placeholder | null` — 現在のキャレット位置以降で次の `{{...}}` を返す
  - [ ] 不正な記法（`{{` の閉じがない、`}}` のみ、空 `{{}}`）は無視する
  - [ ] エスケープ `\{\{` は将来拡張として**Phase 1 では未対応**（対応しない旨をコメントで明記）
  - [ ] `src/lib/templatePlaceholders.test.ts` がパース・次位置検索・不正記法の 3 系統をカバー

#### F1-5: i18n キー雛形の追加（WBS T1-5）

- **説明**: P2/P3 で使うキー名前空間を `ja.json` と `en.json` の両方に追加する。文字列は Phase 1 の時点で確定させる必要はないが、UI 実装開始時に追加作業が最小になるよう**構造だけは確定**させる
- **受け入れ条件**:
  - [ ] `promptPalette.history` 名前空間にキー `title` / `empty` / `searchPlaceholder` / `saveAsTemplate` / `ariaLabel` / `openHint` を追加
  - [ ] `promptPalette.template` 名前空間にキー `title` / `empty` / `searchPlaceholder` / `new` / `edit` / `delete` / `ariaLabel` / `openHint` / `editor.title` / `editor.name` / `editor.body` / `editor.save` / `editor.cancel` / `editor.deleteConfirm` を追加
  - [ ] `promptPalette.hint` 既存の `newline` / `submit` / `submitCtrl` / `cancel` に加え、`historyUp` / `historyDown` / `historyOpen` / `templateOpen` を追加
  - [ ] ja / en の双方にキーが揃っている（片方だけの漏れがない）
  - [ ] 文字列は初期値として埋めるが、後工程で見直す前提で OK（変更可能な暫定値）

### 非機能要件

- **パフォーマンス**: 本フェーズはロジックの下地のみ。追加されるストアフィールドは高々 100 件×1KB 程度（= 100KB 前後）で、既存レンダリングへの影響なし
- **保守性**: プレースホルダユーティリティは UI 非依存の純関数とし、Phase 3 でテンプレ UI を差し込む際に引数だけで完結するよう設計
- **後方互換**: 既存の `PromptPalette.tsx` は改変しない（追加フィールドは UI では参照しない）。Phase 2 以降で差分が発生する
- **外観・デザイン**: 本フェーズで UI 変更なし

## スコープ

### 対象

- `src/stores/promptPaletteStore.ts` の型・状態・アクション拡張、`persist` middleware 適用
- `src/stores/promptPaletteStore.test.ts` のテスト追加
- `src/lib/templatePlaceholders.ts` と `src/lib/templatePlaceholders.test.ts` の新規作成
- `src/i18n/locales/ja.json` と `src/i18n/locales/en.json` のキー追加（構造のみ確定）

### 対象外

- `PromptPalette.tsx` / `PromptHistoryDropdown.tsx` / `PromptTemplateDropdown.tsx` / `PromptTemplateEditor.tsx` / `SlashSuggest.tsx` の UI 実装（Phase 2 / Phase 3 以降）
- `src/hooks/usePromptHistoryCursor.ts` の実装（Phase 2 / T2-2）
- `src/lib/shortcuts.ts` の変更（Phase 2 以降）
- Rust バックエンドの変更（本プロジェクト全体で追加予定なし）

## 実装対象ファイル（予定）

**新設**
- `src/lib/templatePlaceholders.ts` — `{{...}}` パース・位置計算の純関数モジュール
- `src/lib/templatePlaceholders.test.ts` — 上記のユニットテスト

**変更**
- `src/stores/promptPaletteStore.ts` — 型・状態・アクション追加、`persist` middleware 適用
- `src/stores/promptPaletteStore.test.ts` — 新規アクションのテスト追加
- `src/i18n/locales/ja.json` — `promptPalette.history.*` / `promptPalette.template.*` / `promptPalette.hint.*` キー雛形追加
- `src/i18n/locales/en.json` — 同上（ja と同じキー構造）

## 依存関係

- Zustand `persist` middleware（`src/stores/appStore.ts` で既に利用中）
- `nanoid` などの ID 生成（既存依存があればそれを利用、なければ `crypto.randomUUID()` で代替可）
- i18next（既存）

## 既知の制約

- localStorage は 5〜10 MB 程度の容量制限がある。Phase 1 の想定規模（履歴 100×1KB + テンプレ 50×2KB ≒ 200KB）では問題ないが、`persist` の書き込み失敗時のエラーハンドリングは Phase 4 に持ち越す（本フェーズでは最低限のコンソールログで OK）
- プレースホルダのエスケープ記法（`\{\{`）は将来拡張。Phase 1 はエスケープなしのシンプルパースに限定
- i18n 文字列の英文は暫定値。P2/P3 の UI 実装時にコピーライティングを調整する

## 参考資料

- `docs/projects/20260418-プロンプトパレット履歴テンプレート/01_要件定義書.md` — プロジェクト全体の要件（FR-02, FR-03, FR-05, FR-07, FR-09）
- `docs/projects/20260418-プロンプトパレット履歴テンプレート/02_概要設計書.md` §5（データ構造）, §6（既存コードとの統合方針）
- `docs/projects/20260418-プロンプトパレット履歴テンプレート/03_WBS.md` Phase 1（T1-1〜T1-5）
- `src/stores/appStore.ts` — `persist` + `createJSONStorage` の既存パターン
- `src/stores/promptPaletteStore.ts` — 現行実装
- `docs/steering/features/prompt-palette.md` — 既存機能仕様
