# タスクリスト - Git ステータスのプロジェクトツリー表示

## 進捗サマリー

| 状態 | 件数 |
|------|------|
| 完了 | 6 |
| 進行中 | 0 |
| 未着手 | 0 |

## タスク一覧

### T-1: Rust `git_status` コマンド実装

- [x] `src-tauri/src/commands/git.rs` を新規作成
- [x] `GitFileStatus` 構造体を定義（staged, unstaged）
- [x] `git status --porcelain=v1` を実行し出力をパースする
- [x] リネーム（`->` 形式）のパースに対応する
- [x] Git リポジトリでない場合はエラーを返す
- [x] `lib.rs` にコマンドを登録する
- [x] `cargo check` でエラーなし
- [x] ユニットテストを追加（porcelain 出力のパース）

### T-2: フロントエンド API・ストア追加

- [x] `tauriApi.ts` に `getGitStatus(cwd: string)` を追加
- [x] `GitFileStatus` 型を定義
- [x] `appStore.ts` に `gitStatuses` / `setGitStatuses` / `refreshGitStatus` を追加
- [x] `refreshGitStatus` にデバウンス（500ms）を組み込む

### T-3: TreeNode にカラー・バッジ表示

- [x] `getGitColor(status)` ユーティリティ関数を実装
- [x] `getGitBadge(status)` ユーティリティ関数を実装（M / A / D / U / R）
- [x] TreeNode のファイル名 `<span>` にインライン `color` スタイルを適用
- [x] ファイル名の右側にステータスバッジを表示
- [x] ディレクトリへの色伝播を実装（配下に変更ファイルがあれば色付け）

### T-4: 自動更新トリガー

- [x] プロジェクト読み込み時に `refreshGitStatus()` を呼ぶ
- [x] ターミナル出力（`pty-output` / `terminal-cells`）後にデバウンス付きで呼ぶ
- [x] ファイル保存（`writeFile`）後に呼ぶ

### T-5: テスト

- [x] Rust: `parse_porcelain` のユニットテスト（M, A, D, ?, R, コンフリクト）
- [x] `npm run lint` がエラーなし
- [x] `npm run build` がエラーなし
- [x] `cargo test` がパス
- [x] 手動テスト（testing.md 参照）

### T-6: ドキュメント・マージ

- [x] testing.md のテスト結果を更新
- [x] コードレビュー
- [x] `main` ブランチへのマージ

## 完了条件

- [x] 全タスクが完了
- [x] `npm run lint` がエラーなし
- [x] `npm run build` がエラーなし
- [x] `cd src-tauri && cargo test` がパス
- [x] 手動テストが全件 OK
