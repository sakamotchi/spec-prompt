# タスクリスト - status-bar-phase1

## 進捗サマリー

| 状態 | 件数 |
|------|------|
| 完了 | 7 |
| 進行中 | 0 |
| 未着手 | 0 |

## タスク一覧

### T-1: 要件定義・設計

- [x] 要件定義書の作成（本ドキュメント群）
- [x] 設計書の作成（本ドキュメント群）
- [x] 実装方針のレビュー（自己確認 + ユーザー承認）

### T-2: Rust `git_branch` コマンド実装（T1-1 相当）

- [x] `src-tauri/src/commands/git.rs` に `git_branch(cwd: String)` を追加
- [x] `HEAD` 戻り値時の短縮 SHA 取得ロジック実装
- [x] Rust 単体テスト 3 ケース追加（通常ブランチ / detached HEAD / 非 Git ディレクトリ）
- [x] `tempfile` は既に `src-tauri/Cargo.toml` の `dev-dependencies` に存在（追加不要）
- [x] `cd src-tauri && cargo test commands::git` がパス

### T-3: コマンド登録（T1-2 相当）

- [x] `src-tauri/src/lib.rs` の `use commands::git::...` に `git_branch` を追加
- [x] `invoke_handler!` の並びに `git_branch` を追加
- [x] `cd src-tauri && cargo check` でエラーなし

### T-4: フロント IPC ラッパー（T1-3 相当）

- [x] `src/lib/tauriApi.ts` の `getGitStatus` 近傍に `getBranch(cwd: string): Promise<string | null>` を追加
- [x] `npm run lint` でエラーなし
- [x] TypeScript 型チェック（`npx tsc --noEmit`）でエラーなし

### T-5: ステータスバー枠の配置（T1-4 相当）

- [x] `src/components/StatusBar/StatusBar.tsx` をスケルトンとして新規作成
- [x] `src/components/StatusBar/index.ts` で再エクスポート
- [x] `src/components/Layout/AppLayout.tsx` を `flex flex-col` に変更し `<StatusBar />` を下段に配置
- [x] `npx tauri dev` で起動し、レイアウト崩れがないことを目視確認

### T-6: 動作確認・テスト

- [x] `testing.md` の手動テストを全件実施
- [x] 既存機能への回帰がないことを確認（ツリー / ターミナル / 分割レイアウト等）
- [x] `npm run lint` / `npx tsc --noEmit` / `cargo test commands::git` が全件パス
  - 備考: `cargo test --lib` 全件実行時に `commands::pty::tests::test_resolve_cwd_no_home_env` が失敗することがあるが、`-- --test-threads=1` でパスする既存の並列干渉（本変更とは無関係）

### T-7: ドキュメント・マージ

- [x] 永続化ドキュメント（`docs/steering/`）の更新は不要と判断（Phase 2 で表示ロジック実装後にまとめて反映予定）
- [x] `feature/status-bar` ブランチにコミット
- [ ] Phase 2 着手時に WBS の Phase 1 チェック欄を埋める

## 完了条件

- [x] 全タスクが完了
- [x] `npm run lint` がエラーなし
- [x] `cd src-tauri && cargo test commands::git` がパス（新規 3 ケース含む）
- [x] `testing.md` の手動テスト全件 OK
- [x] `feature/status-bar` ブランチにコミット済み（ユーザー承認ベース）
