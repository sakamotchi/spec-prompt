# 要件定義書 - prompt-palette-history-template-p3-template

## 概要

プロンプトパレット履歴・テンプレート機能（プロジェクト `docs/projects/20260418-プロンプトパレット履歴テンプレート/`）のうち、**Phase 3: テンプレート機能**を実装する。Phase 1 で整備した `templates` ストアと `templatePlaceholders` ユーティリティを接続し、UI からテンプレートを作成・編集・呼び出し、プレースホルダを Tab で巡回しながら本文を埋めて送信できる状態を完成させる。

- 親プロジェクト: `docs/projects/20260418-プロンプトパレット履歴テンプレート/`
- WBS 対応: Phase 3（T3-1〜T3-6）
- ブランチ: `feature/prompt-palette-history-template`
- 前提コミット:
  - Phase 1 `31e8c1e` — ストア・永続化・プレースホルダユーティリティ・i18n 雛形
  - Phase 2 `3ef292f` — 履歴機能 UI 統合（送信時 push、`↑`/`↓` 巡回、履歴ドロップダウン、`⌘H`、Esc 段階剥離）

## 背景・目的

- Phase 2 で「過去の送信を呼び出す」導線が整ったが、**定型的なプロンプト**（「この設計書を要約」「このファイルのテストを書く」等）は依然として毎回打ち直しが必要
- テンプレートと `{{path}}` 等のプレースホルダを組み合わせることで、仕様駆動開発で頻用するルーチン入力を「呼び出し → 変数だけ差し替え → 送信」の最短導線に圧縮する
- 主動線は「テンプレ選択 → textarea 流し込み → プレースホルダを Tab で巡回しながら埋める → `⌘Enter` で送信」。選択＝即送信はしない

## 要件一覧

### 機能要件

#### F3-1: テンプレートドロップダウン（WBS T3-1）

- **説明**: パレット内のインライン・ドロップダウン（履歴と同じ配置・同じ操作規約）。`promptPaletteStore.dropdown === 'template'` のとき表示し、保存済みテンプレートを名前昇順で一覧
- **受け入れ条件**:
  - [ ] `PromptHistoryDropdown` と同じ操作セット: 検索 input、`↑`/`↓` 選択、`Enter` 流し込み、`Esc` でドロップダウンのみ閉じる
  - [ ] fuzzy 検索の対象は `name` と `body` の両方
  - [ ] 各行の表示: 左側にテンプレ名（強調）、右側に本文 1 行プレビュー（40 字でトリム、改行は `↵`）
  - [ ] テンプレ 0 件のとき `promptPalette.template.empty` メッセージと「新規作成」ボタンを表示
  - [ ] ドロップダウン下部に「+ 新規作成」アクション（常時表示）
  - [ ] 各行右端にホバー/選択中で表示される「編集」「削除」アイコン（`Pencil` / `Trash2`）
  - [ ] 「編集」クリックで `openEditor({ mode: 'edit', templateId })`
  - [ ] 「削除」クリックで確認ダイアログ → `removeTemplate(id)`
  - [ ] 選択で `setDraft(ptyId, body)` + `closeDropdown`、さらに FR3-2 でプレースホルダの最初を選択状態にする
  - [ ] ルート DOM に `data-palette-dropdown="template"` 属性を付与

#### F3-2: 流し込み時のプレースホルダ選択状態化（WBS T3-2）

- **説明**: テンプレを textarea に流し込んだ直後、本文に `{{name}}` が存在すれば最初のプレースホルダを `setSelectionRange` で選択状態にする。続く `Tab` で次のプレースホルダへ巡回できる土台を作る。ツリーからのパス挿入（`⌘+Click`〈macOS〉/ `Ctrl+Click`〈win/linux〉、右クリック「パスをターミナルに挿入」、`⌘P` パスパレット）は既存の `insertAtCaret` が選択範囲を置換する実装のため、選択された `{{path}}` などのプレースホルダにそのまま差し替えられる
- **受け入れ条件**:
  - [ ] `parsePlaceholders(body)` で得た最初のプレースホルダ位置 `{start, end}` を textarea の選択範囲にセット
  - [ ] プレースホルダが無いテンプレは従来どおり末尾にキャレットを置く
  - [ ] 選択状態化は `requestAnimationFrame` で textarea の value 更新後に実行（タイミング事故を防ぐ）
  - [ ] textarea にフォーカスが戻ること
  - [ ] プレースホルダ選択中にツリーで `⌘+Click`（macOS）/ `Ctrl+Click`（win/linux）でファイルをクリックすると、選択された `{{...}}` がそのパスで置換される（既存 `insertAtCaret` の選択範囲置換挙動を流用）
  - [ ] 右クリック「パスをターミナルに挿入」および `⌘P` パスパレット経由でも同様に置換される

#### F3-3: テンプレートエディタモーダル（WBS T3-3）

- **説明**: `PromptTemplateEditor` コンポーネント（Radix Dialog）。`promptPaletteStore.editorState !== null` のとき表示。新規作成・既存編集・削除確認を 1 モーダルで担当
- **受け入れ条件**:
  - [ ] `editorState = { mode: 'create', initialBody?: string }` で新規作成モード。`initialBody` 指定時は body の初期値としてセット（T3-6 履歴昇格で使用）
  - [ ] `editorState = { mode: 'edit', templateId }` で既存編集モード。ストアから該当テンプレを引き、name/body/tags を初期値に設定
  - [ ] 編集項目: `name`（必須・255 文字以内・ユニーク）、`body`（必須・10,000 文字以内・複数行 textarea）、`tags`（Phase 3 では UI 非表示、既存値だけ保持）
  - [ ] ユニークチェック: `name` が他のテンプレと重複する場合は保存ボタン disable + エラー文字列表示
  - [ ] `⌘Enter` / `Ctrl+Enter` で保存（ショートカット）
  - [ ] `Esc` でエディタのみ閉じる（パレット本体は残す。Phase 2 と同じ段階剥離パターン）
  - [ ] 編集モードに「このテンプレを削除」ボタン → AlertDialog 確認 → `removeTemplate`
  - [ ] 保存・キャンセル・削除いずれも `closeEditor()` を呼ぶ
  - [ ] ルート DOM に `data-palette-dropdown="editor"` 属性（Phase 2 と同じ外側クリック・Esc 例外判定に乗せる）

#### F3-4: Tab によるプレースホルダ遷移（WBS T3-4）

- **説明**: textarea にフォーカスがある状態で `Tab` を押すと、現在のキャレット位置以降の最初のプレースホルダを選択状態にする。既存プレースホルダを消費し切ったら通常の Tab 挙動（フォーカス移動）に戻す
- **受け入れ条件**:
  - [ ] `Tab` キー押下時に `findNextPlaceholder(value, caret)` で次を検索
  - [ ] 見つかった場合: `e.preventDefault()` + `setSelectionRange(start, end)`
  - [ ] 見つからない場合: preventDefault しない（通常の Tab 挙動にフォールスルー）
  - [ ] `Shift+Tab` は逆方向に最も近い `{{...}}` へ（簡易実装: caret より前の最後の placeholder）
  - [ ] IME 変換中は発動しない
  - [ ] `Shift+Tab` の見つからないケースも通常動作
  - [ ] プレースホルダが重複していても stable に進む（`start >= caret` で判定）

#### F3-5: `⌘T` と `/` インラインサジェスト（WBS T3-5）

- **説明**: パレット内スコープで `⌘T`（macOS）/ `Ctrl+T`（win/linux）でテンプレドロップダウンを開閉。textarea 先頭の `/` 入力でインライン候補ポップオーバー `SlashSuggest` を表示
- **受け入れ条件**:
  - [ ] `PromptPalette.tsx` の `handleKeyDown` で `⌘T` / `Ctrl+T` を処理し、グローバルな `newTerminalTab`（既存 `⌘T`）と衝突させない（パレット開中のみパレット内動作）
  - [ ] `IS_MAC` を考慮した tooltip（`⌘T` / `Ctrl+T`）
  - [ ] `SlashSuggest`: textarea 本文が `/` で始まり、そのトークンが改行を含まない場合のみ表示
  - [ ] サジェスト候補はテンプレ `name` を `/` 以降の文字列で fuzzy フィルタ（`/rev` → `review` 等）
  - [ ] `Enter` で選択 → textarea 全体を該当テンプレ本文で置換 → F3-2 のプレースホルダ選択状態化
  - [ ] `Esc` はサジェストのみ閉じる（テキストはそのまま）
  - [ ] 条件を満たさなくなれば（改行挿入、先頭の `/` を消すなど）自動で閉じる
  - [ ] `src/lib/shortcuts.ts` にヘルプ表示用エントリ追加（`promptTemplate`）

#### F3-6: 履歴→テンプレート昇格（WBS T3-6）

- **説明**: 履歴ドロップダウンの各行に「テンプレートとして保存」アクションを追加し、`PromptTemplateEditor` を `initialBody` 付きの create モードで起動する
- **受け入れ条件**:
  - [ ] `PromptHistoryDropdown` の行右端（あるいはコンテキストメニュー）に「テンプレに保存」アイコン `FilePlus` を配置
  - [ ] クリックで `openEditor({ mode: 'create', initialBody: entry.body })` を呼び、履歴ドロップダウンを閉じる
  - [ ] エディタで保存されると通常どおり `upsertTemplate`（id 自動生成）でテンプレに登録
  - [ ] キャンセル時は履歴ドロップダウンの状態を復元しない（再度開いてもらう）

### 非機能要件

- **パフォーマンス**: テンプレ 50 件・履歴 100 件規模で検索・レンダ 16ms 以下。Tab プレースホルダ遷移は 8ms 以下
- **ユーザビリティ**: 「F4 → `⌘T` → 選択 → Enter → Tab で変数埋め → `⌘Enter`」が 10 ストローク以内で完結
- **アクセシビリティ**:
  - ドロップダウン・エディタに適切な `role` / `aria-label`
  - エディタのフォームに `<label htmlFor>`
  - 削除確認は Radix `AlertDialog` を使用
- **保守性**:
  - Phase 2 の履歴ドロップダウンと UI 構造を揃える（将来の共通化余地を残す）
  - プレースホルダ関連のロジックは `templatePlaceholders.ts`（Phase 1 で新設済み）に追加する形で凝集
- **外観・デザイン**: 既存 CSS カスタムプロパティを使用。アイコンは `lucide-react` で統一（`Sparkles` や `BookTemplate` 等候補）

## スコープ

### 対象

- `PromptTemplateDropdown.tsx` / `.test.tsx` 新規実装
- `PromptTemplateEditor.tsx` / `.test.tsx` 新規実装
- `SlashSuggest.tsx` / `.test.tsx` 新規実装
- `templatePlaceholders.ts` に `findPreviousPlaceholder` を追加（Shift+Tab 用）
- `PromptPalette.tsx` 改修: `⌘T` ハンドラ、`Tab` 遷移、テンプレドロップダウン配置、SlashSuggest 配置、エディタ配置、onEscapeKeyDown/onPointerDownOutside 例外の拡張
- `PromptHistoryDropdown.tsx` 改修: 「テンプレに保存」アクション追加
- `shortcuts.ts` に `promptTemplate` エントリ追加
- i18n 翻訳文字列の確定（Phase 1 で雛形追加済み）

### 対象外

- テンプレートのクラウド同期・共有・インポート/エクスポート（将来）
- タグ編集 UI（データ構造としては保持するが UI は出さない）
- プレースホルダのデフォルト値機能（例: `{{project=unnamed}}`）は将来拡張
- `SlashSuggest` の高度な自動補完（Tab キーでの補完など）
- Phase 4（統合テスト・steering 更新・リリース準備）

## 実装対象ファイル（予定）

**新設**
- `src/components/PromptPalette/PromptTemplateDropdown.tsx` + `.test.tsx`
- `src/components/PromptPalette/PromptTemplateEditor.tsx` + `.test.tsx`
- `src/components/PromptPalette/SlashSuggest.tsx` + `.test.tsx`

**変更**
- `src/components/PromptPalette/PromptPalette.tsx` — `⌘T`/`Tab`/ドロップダウン/エディタ/SlashSuggest 統合
- `src/components/PromptPalette/PromptPalette.test.tsx` — 追加テスト
- `src/components/PromptPalette/PromptHistoryDropdown.tsx` — 「テンプレに保存」アクション追加
- `src/components/PromptPalette/PromptHistoryDropdown.test.tsx` — テスト追加
- `src/lib/templatePlaceholders.ts` — `findPreviousPlaceholder` 追加
- `src/lib/templatePlaceholders.test.ts` — テスト追加
- `src/lib/shortcuts.ts` — `promptTemplate` エントリ
- `src/i18n/locales/ja.json` / `en.json` — Phase 1 で雛形追加済みのキーコピーを必要に応じて調整

## 依存関係

- Phase 1 成果物:
  - `promptPaletteStore.templates`, `upsertTemplate`, `removeTemplate`, `editorState`, `openEditor`, `closeEditor`
  - `templatePlaceholders.parsePlaceholders` / `findNextPlaceholder`
  - i18n キー `promptPalette.template.*`, `promptPalette.hint.templateOpen`
- Phase 2 成果物:
  - `openDropdown` / `closeDropdown` パターン、`data-palette-dropdown` 例外判定
  - `onEscapeKeyDown` 段階剥離パターン
  - `PromptHistoryDropdown` のレイアウト・fuzzy 実装（コピー参考）
- 既存機能:
  - `@radix-ui/react-dialog`, `@radix-ui/react-alert-dialog`
  - `lucide-react`
  - `tauriApi.writePty`（`handleSubmit` から既存）

## 既知の制約

- `⌘T` はグローバルで `newTerminalTab` に割り当て済み（`src/lib/shortcuts.ts:12`）。Phase 3 ではパレット開中のみパレット内動作として両立させる。パレット閉中は従来どおり新規ターミナルタブが開く
- Tab キーは通常ブラウザのフォーカス移動。textarea 内で `Tab` を preventDefault するとフォーカストラップの副作用がありうるが、プレースホルダが存在する間のみ preventDefault する設計で回避
- localStorage 容量上限はテンプレ 50 件 × 2KB ≒ 100KB で十分余裕
- Phase 1 のプレースホルダパーサは `{{...}}` のエスケープ記法を非対応。Phase 3 でも未対応のまま（将来拡張）
- `PromptTemplateEditor` は Radix Dialog を `modal={true}` で重ねるが、親の `PromptPalette` の `modal={false}` との干渉は Radix 側で適切に扱われる想定。実装時に焦点を当てる
- ツリーのパス挿入操作キーは macOS で `⌘+Click`、Windows/Linux で `Ctrl+Click`（実装: `src/components/TreePanel/TreeNode.tsx:109` で `e.ctrlKey || e.metaKey` を受ける）。macOS の `Ctrl+Click` は OS 標準の右クリックメニュー扱いとなるため利用不可。CLAUDE.md は macOS 視点で表記が不正確なので、必要に応じて別途修正

## 参考資料

- `docs/projects/20260418-プロンプトパレット履歴テンプレート/01_要件定義書.md` §FR-03, FR-04, FR-05
- `docs/projects/20260418-プロンプトパレット履歴テンプレート/02_概要設計書.md` §3.4〜3.6, §5.3
- `docs/projects/20260418-プロンプトパレット履歴テンプレート/03_WBS.md` Phase 3（T3-1〜T3-6）
- `docs/working/20260418_prompt-palette-history-template-p1-foundation/` — Phase 1 API 一覧
- `docs/working/20260418_prompt-palette-history-template-p2-history/` — Phase 2 UI パターン
- `src/components/PromptPalette/PromptHistoryDropdown.tsx` — Phase 2 完成形（参考実装）
- `src/lib/templatePlaceholders.ts` — Phase 1 実装済みパーサ
- `docs/steering/features/prompt-palette.md` — 既存機能仕様
