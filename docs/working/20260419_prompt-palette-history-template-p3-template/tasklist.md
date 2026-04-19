# タスクリスト - prompt-palette-history-template-p3-template

## 進捗サマリー

| 状態 | 件数 |
|------|------|
| 完了 | 8 |
| 進行中 | 0 |
| 未着手 | 0 |

## タスク一覧

### T3-1: テンプレートドロップダウン

- [x] `src/components/PromptPalette/PromptTemplateDropdown.tsx` を新規作成
- [x] ストア購読: `templates`, `dropdown`, `targetPtyId`
- [x] 検索 input（`name` と `body` 両方で fuzzy）
- [x] 行表示: 左 name（強調）+ 右 body 1 行プレビュー（40 字 + `↵`）
- [x] `↑` / `↓` で `activeIndex` 更新、`Enter` で流し込み、`Esc` で dropdown 閉じる
- [x] 行右端に「編集」「削除」アイコン（選択中で表示強調）
- [x] 「編集」→ `openEditor({ mode: 'edit', templateId })`
- [x] 「削除」→ Radix `AlertDialog` 確認 → `removeTemplate(id)`
- [x] 下部に「+ 新規作成」アクション（常時表示、クリックで `openEditor({ mode: 'create' })`）
- [x] 0 件状態は empty メッセージ + 新規作成ボタン
- [x] ルート DOM に `data-palette-dropdown="template"` 属性
- [x] `role="listbox"` / `aria-selected` / `aria-label`
- [x] 選択時: Phase 3-2 のプレースホルダ選択状態化を呼ぶ
- [x] `src/components/PromptPalette/PromptTemplateDropdown.test.tsx` を新規作成
- [x] テスト: 0 件 empty、一覧表示、name/body fuzzy、`Enter` 選択、行アクション（Edit/Delete）、新規作成ボタン
- [x] `npm run test -- PromptTemplateDropdown` がパス

### T3-2: プレースホルダ選択状態化

- [x] 共通関数 `applyTemplateBodyToDraft(body)` を `src/lib/templateApply.ts` に新設
- [x] `setDraft(ptyId, body)` → `closeDropdown()` → `requestAnimationFrame` で textarea 選択状態化
- [x] `parsePlaceholders(body)[0]` があれば `setSelectionRange(start, end)`、無ければ末尾にキャレット
- [x] textarea にフォーカス復帰
- [x] 単体テストで body に `{{path}}` を含む場合の挙動を検証（`PromptTemplateDropdown.test.tsx` / `PromptHistoryDropdown.test.tsx`）
- [x] 手動確認: プレースホルダ選択状態でツリー `⌘+Click`（macOS）/ `Ctrl+Click`（win/linux）・右クリック挿入・`⌘P` パスパレットから選択範囲が置換されること（testing.md ケース 2-A / 2-B / 2-C）
- [x] `⌘P` 経由の保険対応（`lastSelection` 保持）は**不要と判断**（textarea の選択範囲は `PathPalette` の `onCloseAutoFocus` で textarea にフォーカス復帰しても保持されることを実機確認）

### T3-3: テンプレートエディタ

- [x] `src/components/PromptPalette/PromptTemplateEditor.tsx` を新規作成
- [x] Radix `Dialog`（modal=true、子 Dialog）で配置
- [x] 表示条件: `editorState !== null`
- [x] create モード: name/body 空、`initialBody` があれば本文に流し込む
- [x] edit モード: 該当テンプレを引いて name/body/tags を初期値にセット
- [x] バリデーション: name 必須・255 字以内・ユニーク、body 必須・10,000 字以内（`src/lib/templateValidation.ts` に純関数化）
- [x] 重複チェック: 他のテンプレの name と照合（自分自身は除外）
- [x] `⌘Enter`/`Ctrl+Enter` で保存（有効時）
- [x] `Esc` でエディタのみ閉じる（親パレットは残す）
- [x] 保存で `upsertTemplate` + `closeEditor()`
- [x] edit モードで「削除」ボタン → `AlertDialog` 確認 → `removeTemplate` + `closeEditor()`
- [x] ルート DOM に `data-palette-dropdown="editor"` 属性
- [x] `src/components/PromptPalette/PromptTemplateEditor.test.tsx` を新規作成
- [x] テスト: create 保存、edit モード初期値、name 重複 disable、`initialBody` 反映、削除確認、⌘Enter 保存、validateTemplate 純関数
- [x] **i18n エラーキー追加**: `promptPalette.template.editor.error.{nameEmpty,nameTooLong,nameDuplicate,bodyEmpty,bodyTooLong}` を ja/en に追加（手動確認で raw key 表示に気付き後追い対応）
- [x] `npm run test -- PromptTemplateEditor` がパス

### T3-4: Tab プレースホルダ遷移

- [x] `src/lib/templatePlaceholders.ts` に `findPreviousPlaceholder(body, caret)` を追加
- [x] `src/lib/templatePlaceholders.test.ts` に `findPreviousPlaceholder` のテスト追加（5 テスト）
- [x] `PromptPalette.tsx` の `handleKeyDown` に `Tab`/`Shift+Tab` ハンドラ追加（`handleTabPlaceholder`）
- [x] `Tab`: `findNextPlaceholder(value, caret)` があれば選択状態化 + `preventDefault`、無ければフォールスルー
- [x] `Shift+Tab`: `findPreviousPlaceholder(value, caret)` があれば選択状態化、無ければフォールスルー
- [x] IME 変換中は発動しない
- [x] ドロップダウン/SlashSuggest 表示中は発動しない（誤爆防止）

### T3-5: `⌘T` と `/` サジェスト

- [x] `PromptPalette.tsx` の `handleKeyDown` に `⌘T`/`Ctrl+T` 処理追加（IME・修飾組み合わせガード）
- [x] `toggleTemplateDropdown` 関数を追加
- [x] ヘッダに `TemplateButton`（`BookTemplate` アイコン + tooltip）を追加
- [x] `src/components/PromptPalette/SlashSuggest.tsx` を新規作成
- [x] textarea draft が `/` で始まるかを props で受け、query（`/` 以降のトークン）と candidates を管理
- [x] 候補は `templates` を name で fuzzy、上位 10 件
- [x] `↑`/`↓`/`Enter` 操作、条件喪失で自動クローズ
- [x] 選択で全文置換 → F3-2 のプレースホルダ選択状態化（`applyTemplateBodyToDraft`）
- [x] 条件喪失（改行挿入、先頭 `/` 削除、空文字）で自動クローズ
- [x] `src/components/PromptPalette/SlashSuggest.test.tsx` を新規作成（13 テスト）
- [x] テスト: 表示条件、fuzzy 絞り込み、`Enter` 選択、条件喪失
- [x] `parseSlashQuery` を `src/lib/slashQuery.ts` に分離（fast-refresh 警告回避）
- [x] `src/lib/shortcuts.ts` に `shortcuts.label.promptTemplate` エントリ追加
- [x] i18n に `shortcuts.label.promptTemplate`（ja/en）追加
- [x] **将来の Claude Code スラッシュコマンド統合**: 現状は `/` → テンプレのみ。将来 CC コマンドを統合する際は `SlashSuggest` に kind 別の候補表示を追加する方針（Phase 3 スコープ外）

### T3-6: 履歴→テンプレ昇格

- [x] `PromptHistoryDropdown.tsx` の各行右端に「テンプレに保存」アイコン（`FilePlus`）追加
- [x] クリックで `openEditor({ mode: 'create', initialBody: entry.body })` + `closeDropdown()`
- [x] ストア型: `PaletteEditorState.create` に `initialBody?: string` を追加
- [x] エディタで `initialBody` を受け取って本文初期値にセット（T3-3 の一部）
- [x] `PromptHistoryDropdown.test.tsx` に昇格アクションのテスト追加
- [x] `PromptTemplateEditor.test.tsx` に `initialBody` 反映テスト追加

### T3-7: 既存パレット統合と外側クリック例外拡張

- [x] `PromptPalette.tsx` の `onPointerDownOutside` 例外判定に `[data-palette-dropdown]` すべてを含める（template / editor / slash を内包）
- [x] `PromptPalette.tsx` の `onEscapeKeyDown` 判定に `editorState !== null` を加える（エディタ表示中は Esc でパレットを閉じない）
- [x] テンプレドロップダウン表示中に `⌘T` を押すと閉じるトグル動作
- [x] `⌘H` と `⌘T` の排他（`openDropdown` が `dropdown` を上書きするため、一方押下で他方に切り替わる）
- [x] **AppLayout.tsx のグローバル `⌘T` guard は不要**と判明（既存の `AppLayout.tsx:43-48` に「パレット開中は allow-list 以外を握り潰す」実装あり、`⌘T` は自動で抑制される）

### T3-F: 最終確認・コミット

- [x] `npm run lint` 本変更分でエラーなし
- [x] `npm run test` 全件 pass（292 / 292）
- [x] `npm run build` 型エラーなし
- [x] `testing.md` の手動確認ケースを実施・OK
- [x] ユーザーに確認を依頼してからコミット
- [x] コミットメッセージ案: `feat(prompt-palette): テンプレート機能の UI 統合（Phase 3）`
- [x] 完了後、プロジェクトドキュメント `03_WBS.md` の Phase 3 タスクを `[x]` に更新

## 完了条件

- [x] 全タスクが完了
- [x] `npm run lint` がエラーなし（本変更分）
- [x] `npm run test` が全件 pass
- [x] `npm run build` が型エラーなし
- [x] 手動テスト（ドロップダウン・エディタ・Tab 遷移・`⌘T`・`/` サジェスト・昇格）が全件 OK
- [x] 既存パレット UX（送信・IME・挿入フラッシュ・履歴・`⌘H`・Esc 段階剥離）にリグレッションなし
- [x] マイルストーン M3 達成: テンプレ新規作成・選択・プレースホルダ Tab 遷移・`/` サジェスト・履歴昇格が全て動作
