# タスクリスト - Phase 2: hooks 注入

## 進捗サマリー

| 状態 | 件数 |
|------|------|
| 完了 | 0 |
| 進行中 | 0 |
| 未着手 | 5 |

## タスク一覧

### T-1: claude-notify.sh 作成

- [ ] `src-tauri/resources/claude-notify.sh` を作成
- [ ] stdin → curl POST の動作確認（手動）
- [ ] SpecPrompt 未起動時にエラーなく終了することを確認

### T-2: claude-wrapper.sh 作成

- [ ] `src-tauri/resources/claude-wrapper.sh` を作成
- [ ] 本物の claude を正しく見つけることを確認
- [ ] `SPEC_PROMPT_NOTIFICATION` 未設定時に素通しすることを確認
- [ ] `--settings` で hooks JSON が正しく渡されることを確認

### T-3: スクリプト配置コマンド

- [ ] `notification.rs` に `setup_notification_scripts()` を実装
- [ ] Tauri セットアップフックから呼び出し
- [ ] `~/.config/spec-prompt/bin/claude` が作成されることを確認
- [ ] `~/.config/spec-prompt/hooks/claude-notify.sh` が作成されることを確認
- [ ] 実行権限が付与されていることを確認
- [ ] `tauri.conf.json` の `resources` にスクリプトを追加

### T-4: PTY 起動時の環境変数設定

- [ ] `pty.rs` の `spawn_pty` に環境変数設定を追加
- [ ] `SPEC_PROMPT_NOTIFICATION=1` が設定されることを確認
- [ ] PATH の先頭に `~/.config/spec-prompt/bin/` が追加されることを確認

### T-5: E2E 動作確認

- [ ] SpecPrompt 内のターミナルで `claude` を起動
- [ ] Claude Code が承認を要求したときに通知が表示されることを確認
- [ ] Claude Code がタスクを完了したときに通知が表示されることを確認
- [ ] SpecPrompt がフォーカス中は通知が抑制されることを確認
- [ ] SpecPrompt 外のターミナルで `claude` を実行し、hooks が注入されないことを確認

## 完了条件

- [ ] 全タスクが完了
- [ ] `cargo check` がエラーなし
- [ ] SpecPrompt 内の claude で通知が動作する
- [ ] SpecPrompt 外の claude に影響がない
