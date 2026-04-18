# タスクリスト - macos-window-tabs-f1

WBS（`docs/local/20260418-macOSウィンドウタブ統合/03_WBS.md`）のフェーズ F1 を、2026-04-18 の実装確認結果（既存実装あり）を踏まえて再構成したもの。各タスク完了後は **必ずユーザー確認を得てから** コミット・マージする（CLAUDE.md 規約）。

## 進捗サマリー

| 状態 | 件数 |
|------|------|
| 完了 | 4 |
| 進行中 | 0 |
| 未着手 | 1 |

## タスク一覧

### T-1: 要件定義・設計（書き直し版）

- [x] 要件定義書の作成（`requirements.md`）— 既存実装前提に書き直し
- [x] 設計書の作成（`design.md`）— 既存実装前提に書き直し
- [x] テスト手順書の作成（`testing.md`）— 既存実装前提に書き直し
- [ ] ユーザーレビュー

### T-2: `tauri.conf.json` 設定追加

- [x] `src-tauri/tauri.conf.json` の `app.windows[0]` に `"label": "main"` を追加
- [x] 同所に `"tabbingIdentifier": "SpecPrompt"` を追加
- [x] 既存フィールドを変更していないことを確認

### T-3: `openNewWindow` に `tabbingIdentifier` 追加

- [x] `src/lib/tauriApi.ts:149` の `new WebviewWindow(label, { ... })` options に `tabbingIdentifier: 'SpecPrompt'` を追加
- [x] 既存オプションとハンドラを変更していないことを確認
- [x] 既存 `tauriApi` のテストファイルは存在せず、F1 ではユニットテスト見送り（OS 機能依存、手動 E2E で十分）

### T-4: 手動 E2E

- [x] `npx tauri build` で `.app` 生成、Finder から起動
- [x] ツリーヘッダの「新規ウィンドウ」ボタンで 2 つ目のウィンドウを開く
- [x] 2 つ目で別プロジェクトを開く
- [x] **方法 B（手動統合）で確認済み**: View > Show Tab Bar でタブバー表示、ドラッグでもう一方を統合。タブ名にプロジェクト名が表示されることを確認。タイトル書式の反転は不要（現行 `SpecPrompt — ${name}` のままで OK）。
- [ ] 方法 A（自動統合）: システム設定「書類をタブで開く」が "常に" のユーザー環境で後日確認（F1 受け入れには必須ではない）

### T-5: 結合・動作確認・コミット

- [x] `npm run lint` 差分ファイルでエラーなし
- [x] `npm run build`（型チェック含む）がエラーなし
- [x] `npx vitest run` が全件パス（179/179）
- [x] `cd src-tauri && cargo check` がパス
- [x] `testing.md` の確認結果を記録（ケース 1 方法 B OK）
- [x] ユーザー承認（2026-04-18）
- [x] `feature/macos-window-tabs` 上でコミット

## 完了条件

- [x] 全タスクが完了
- [x] `npm run lint` 差分ファイルでエラーなし
- [x] `npm run build`（型チェック含む）がエラーなし
- [x] `npx vitest run` が全件パス（179/179）
- [x] `cd src-tauri && cargo check` がパス
- [x] `testing.md` の手動テストが全件 OK
- [x] ユーザー承認済み

## PR 粒度（参考、WBS より）

- PR-F1: `tabbingIdentifier` の 2 箇所追加（+ 条件付きタイトル書式反転）

> 実装差分が 2〜4 行と極小のため F1 は単一 PR。F2 と F3 は別 PR で、F2+F3 は同一 PR に畳む（F3 なしで複数ウィンドウが増えると localStorage 競合が表面化する）。
