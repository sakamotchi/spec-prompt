# タスクリスト - Phase 2: OSC 9 検出

## 進捗サマリー

| 状態 | 件数 |
|------|------|
| 完了 | 0 |
| 進行中 | 0 |
| 未着手 | 4 |

## タスク一覧

### T-1: TERM_PROGRAM 環境変数の設定

- [ ] `pty.rs` の `spawn_pty` に `cmd.env("TERM_PROGRAM", "iTerm.app")` を追加
- [ ] SpecPrompt のターミナルで `echo $TERM_PROGRAM` → `iTerm.app` を確認

### T-2: Osc9Detector の実装

- [ ] `notification.rs` に `Osc9Detector` 構造体を実装
- [ ] ステートマシンで BEL 終端 (`\x07`) を検出
- [ ] ST 終端 (`ESC \`) も検出
- [ ] ユニットテスト作成（正常系・異常系・チャンク分割）
- [ ] `cargo test` でパス

### T-3: PTY リーダースレッドへの統合

- [ ] `pty.rs` のリーダースレッドで `Osc9Detector::feed()` を呼び出し
- [ ] 検出時に `send_native_notification` で通知を発火
- [ ] フォーカス判定を適用
- [ ] `notification.rs` の `is_app_focused` と `send_native_notification` を pub に変更

### T-4: E2E 動作確認

- [ ] SpecPrompt 内で `claude` を起動
- [ ] 承認待ちで通知が表示されることを確認
- [ ] タスク完了で通知が表示されることを確認
- [ ] SpecPrompt フォーカス中は通知が抑制されることを確認
- [ ] `cargo test` 全件パス
- [ ] `npm run build` エラーなし

### 不要になったもの（hooks 方式から廃止）

- ~~claude-wrapper.sh~~ → 削除
- ~~claude-notify.sh~~ → 削除
- ~~HTTP サーバー~~ → 残置（Phase 1 で実装済み、将来の拡張用）
- ~~setup_notification_scripts~~ → 削除
- ~~SPEC_PROMPT_NOTIFICATION 環境変数~~ → 不要
- ~~PATH へのラッパー追加~~ → 不要

## 完了条件

- [ ] 全タスクが完了
- [ ] `cargo check` がエラーなし
- [ ] `cargo test` がパス
- [ ] SpecPrompt 内の Claude Code で通知が動作する
- [ ] ユーザーの Claude Code 設定変更が不要であること
