# タスクリスト - prompt-palette-history-template-p2-history

## 進捗サマリー

| 状態 | 件数 |
|------|------|
| 完了 | 7 |
| 進行中 | 0 |
| 未着手 | 0 |

## タスク一覧

### T2-1: 送信成功時の履歴 push

- [x] `PromptPalette.tsx` の `handleSubmit` 成功ブロックで `pushHistory(body)` を呼ぶ（`clearDraft` より前）
- [x] 送信失敗時（catch 節）は push しないことを確認
- [x] `PromptPalette.test.tsx` に送信成功時 push テストを追加
- [x] `PromptPalette.test.tsx` に送信失敗時非 push テストを追加
- [x] `npm run test -- PromptPalette` がパス

### T2-2: usePromptHistoryCursor フック新規実装

- [x] `src/hooks/usePromptHistoryCursor.ts` を新規作成
- [x] 引数 `{ textareaRef, isComposing }` と戻り値 `{ handleArrowKey, resetCursor }` の型を定義
- [x] `handleArrowKey` 内で以下を判定:
  - IME 変換中は発動しない（`isComposing` と `nativeEvent.isComposing` の OR）
  - 修飾キー（Shift/Alt/Meta/Ctrl）押下時は発動しない
  - `textarea.value` が空または履歴由来の値のみ発動
  - `↑` は `historyCursor` を +1（上限 `history.length - 1`）
  - `↓` は `historyCursor` を -1、0 未満で null・draft 空へ戻す
- [x] 流し込み時に `setDraft` で drafts 更新 → textarea 末尾にキャレット移動
- [x] `resetCursor()` で `setHistoryCursor(null)` を呼ぶユーティリティ
- [x] `src/hooks/usePromptHistoryCursor.test.ts` を新規作成
- [x] 以下のテスト追加:
  - `↑` で直近履歴が流し込まれる（空 textarea 前提）
  - IME 変換中は発動しない
  - 修飾キー付きは発動しない
  - textarea が空でないときは発動しない（ただし履歴由来の値は例外）
  - 最新より新しい側で `↓` を押すと空に戻る
  - 履歴 0 件では発動しない
- [x] `npm run test -- usePromptHistoryCursor` がパス

### T2-3: PromptPalette.tsx への巡回ハンドラ統合

- [x] `PromptPalette.tsx` で `usePromptHistoryCursor` を呼び出し
- [x] `handleKeyDown` の先頭で `↑` / `↓` を処理（処理した場合は他のハンドラをスキップ）
- [x] `handleChange` で `resetCursor()` を呼ぶ（ユーザー編集で巡回解除）
- [x] 履歴巡回で流し込まれた直後はカーソル末尾に移動（フック内で `requestAnimationFrame` + `setSelectionRange`）
- [x] 既存の `⌘Enter` / `Ctrl+Enter` 送信が壊れないこと
- [x] 既存の IME ガード（`isComposing` と `nativeEvent.isComposing`）が維持されること

### T2-4: 履歴ドロップダウン実装

- [x] `src/components/PromptPalette/PromptHistoryDropdown.tsx` を新規作成
- [x] ストア購読: `history` + 選択時に `targetPtyId` / `textareaRef` を参照
- [x] 検索 input と結果リスト（`role="listbox"`）の構造
- [x] 各行は 1 行プレビュー（80 字でトリム、改行は `↵` に変換）＋相対日時表示（秒 / 分 / 時間 / 日 / 月日）
- [x] fuzzy フィルタ実装（`PathPalette.fuzzyMatch` と同等ロジック、インライン化）
- [x] `↑` / `↓` で `activeIndex` 更新、`Enter` で選択 → `setDraft` + `closeDropdown`
- [x] `Esc` でドロップダウンのみ閉じる（パレットは開いたまま）
- [x] 空状態メッセージ（`promptPalette.history.empty`）
- [x] ルート DOM に `data-palette-dropdown="history"` 属性を付与
- [x] `role="listbox"` と `aria-label="{promptPalette.history.ariaLabel}"` を設定
- [x] 選択中行に `aria-selected="true"` とアクセントカラー
- [x] `src/components/PromptPalette/PromptHistoryDropdown.test.tsx` を新規作成
- [x] 以下のテスト追加:
  - 履歴 0 件で empty メッセージ
  - 新しい順に並ぶ
  - 検索で絞り込める
  - `Enter` 選択で draft 流し込み + `closeDropdown`
  - `Esc` でドロップダウンのみ閉じる
  - `↓` で `activeIndex` が範囲内で動く
  - クリック選択で draft 流し込み
  - 複数行 body の `↵` 変換
  - `data-palette-dropdown` 属性
  - `onAfterSelect` コールバック
  - 流し込み後の textarea フォーカス復帰
- [x] `npm run test -- PromptHistoryDropdown` がパス

### T2-5: ヘッダアイコン + `⌘H` 導線

- [x] `PromptPalette.tsx` のヘッダ右端に `lucide-react` の `History` アイコンボタンを追加
- [x] `aria-label` と tooltip（title 属性）で「履歴を開く (⌘H)」を提示
- [x] クリックで `toggleHistoryDropdown`（開いていれば閉じるトグル）
- [x] `handleKeyDown` で `⌘H`（macOS）/ `Ctrl+H`（Windows/Linux）を処理
- [x] IME 変換中は処理しない（既存ガード流用）
- [x] `Dialog.Content` の `onPointerDownOutside` に `[data-palette-dropdown]` 例外判定を追加
- [x] `Dialog.Content` の `onEscapeKeyDown` を追加し、ドロップダウン表示中は Esc でパレット本体を閉じない（段階剥離）
- [x] `src/lib/shortcuts.ts` に「パレット内: 履歴を開く (⌘H)」の表示用エントリ `shortcuts.label.promptHistory` を追加
- [x] i18n に追加ラベル（`ja.json` / `en.json` に `shortcuts.label.promptHistory`）

### T2-F: 最終確認・コミット

- [x] `npm run lint` 本変更分でエラーなし
- [x] `npm run test` 全件 pass（249 / 249）
- [x] `npm run build` 型エラーなし
- [x] `testing.md` の手動確認ケースを実施・OK
- [x] Esc 段階剥離の追加確認を実施・OK
- [x] ユーザーに確認を依頼してからコミット（CLAUDE.md 作業ルール）
- [x] コミットメッセージ案: `feat(prompt-palette): 履歴機能の UI 統合（Phase 2）`
- [x] 完了後、プロジェクトドキュメント `docs/projects/.../03_WBS.md` の Phase 2 タスクを `[x]` に更新

## 完了条件

- [x] 全タスクが完了
- [x] `npm run lint` がエラーなし（本変更分）
- [x] `npm run test` が全件 pass
- [x] `npm run build` が型エラーなし
- [x] 手動テスト（送信・巡回・ドロップダウン・`⌘H`・Esc 段階剥離）が全件 OK
- [x] 既存パレット UX（`⌘Enter` 送信・Esc クローズ・IME ガード・挿入フラッシュ）にリグレッションなし
- [x] マイルストーン M2 達成: 「F4 → `↑` → `⌘Enter`」で直近プロンプト再送できる、履歴ドロップダウンから流し込みできる
