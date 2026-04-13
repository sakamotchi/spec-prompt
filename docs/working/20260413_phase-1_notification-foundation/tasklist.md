# タスクリスト - Phase 1: 通知基盤

## 進捗サマリー

| 状態 | 件数 |
|------|------|
| 完了 | 5 |
| 進行中 | 0 |
| 未着手 | 0 |

## タスク一覧

### T-1: tauri-plugin-notification 導入

- [x] `src-tauri/Cargo.toml` に `tauri-plugin-notification` を追加
- [x] `src-tauri/src/lib.rs` にプラグイン登録
- [x] `src-tauri/capabilities/default.json` に `notification:default` を追加
- [x] `cargo check` でエラーなし

### T-2: notification.rs 作成（通知分類・メッセージ抽出）

- [x] `src-tauri/src/commands/notification.rs` を新規作成
- [x] `ClaudeHookPayload` 構造体を定義
- [x] `classify_notification()` 関数を実装
- [x] `extract_message()` 関数を実装
- [x] `send_notification` Tauri コマンドを実装（テスト用）
- [x] `src-tauri/src/commands/mod.rs` にモジュール追加
- [x] `src-tauri/src/lib.rs` にコマンドハンドラ登録
- [x] ユニットテスト作成（分類・抽出ロジック）13件
- [x] `cargo test` でパス（81件全件パス）

### T-3: HTTP サーバー起動

- [x] `src-tauri/Cargo.toml` に `tiny_http` を追加
- [x] Tauri セットアップフックで HTTP サーバーをバックグラウンドスレッド起動
- [x] `GET /health` エンドポイント実装
- [x] `curl http://127.0.0.1:19823/health` で応答確認

### T-4: /claude-hook/{event} エンドポイント

- [x] `POST /claude-hook/{event}` のルーティング実装
- [x] JSON パース → `classify_notification()` → `extract_message()`
- [x] フォーカス判定（`is_app_focused`）を実装
- [x] 通知送信: プロダクションは `tauri-plugin-notification`、dev は `osascript` フォールバック
- [x] curl で直接 POST して通知が表示されることを確認

### T-5: 動作確認・テスト

- [x] `npx tauri dev` で起動し、curl で通知が出ることを確認
- [x] SpecPrompt フォーカス中に通知が抑制されることを確認（ログで focused=true 確認）
- [x] 不正 JSON を送ってもサーバーがクラッシュしないことを確認
- [x] `cargo test` で全テストパス
- [x] `npm run build` でフロントエンドビルドエラーなし

## 完了条件

- [x] 全タスクが完了
- [x] `cargo check` がエラーなし
- [x] `cargo test` がパス
- [x] curl で POST → macOS 通知が表示される
- [x] フォーカス判定が動作する

## 実装メモ

- `tauri-plugin-notification` は dev ビルド（`npx tauri dev`）では通知が配信されない問題がある
- dev ビルドでは `osascript`（macOS AppleScript）にフォールバックして通知を送信
- プロダクションビルド（`.app`）では `tauri-plugin-notification` が SpecPrompt アイコンで正常動作する見込み
- フロントエンドに `@tauri-apps/plugin-notification` を追加し、起動時に通知権限をリクエスト
