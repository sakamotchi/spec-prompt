# 要件定義書 - Phase 2: OSC 9 検出による通知トリガー

## 概要

Phase 1 で構築した通知基盤に対して、Claude Code が出力する OSC 9 エスケープシーケンスを PTY 出力から検出し、通知を発火するトリガーを実装する。

## 背景・目的

当初は cmux と同様に hooks + ラッパースクリプト方式を検討したが、以下の理由で OSC 方式に変更する：

- Claude Code は `/config` → Notifications で `iterm2`（OSC 9）を出力する機能を組み込みで持っている
- PTY 起動時に `TERM_PROGRAM=iTerm.app` を設定すれば、Auto モードで OSC 9 が自動出力される
- ラッパースクリプト・HTTP サーバー・PATH 操作が不要になり、実装が大幅にシンプルになる
- ユーザーの `~/.claude/settings.json` や Claude Code の設定に一切触れない

## 要件一覧

### 機能要件

#### F-1: PTY 起動時に TERM_PROGRAM を設定

- **説明**: `spawn_pty` で PTY を起動する際に `TERM_PROGRAM=iTerm.app` を設定し、Claude Code の Auto モードで OSC 9 を出力させる
- **受け入れ条件**:
  - [ ] SpecPrompt のターミナルで `echo $TERM_PROGRAM` → `iTerm.app` が返る
  - [ ] Claude Code の `/config` → Notifications が Auto のまま OSC 9 が出力される

#### F-2: PTY 出力から OSC 9 シーケンスを検出

- **説明**: PTY 出力のリーダースレッドで `ESC ] 9 ; <message> BEL` パターンを検出し、メッセージを抽出する
- **受け入れ条件**:
  - [ ] `\x1b]9;...\x07` パターンを正しく検出する
  - [ ] `\x1b]9;...\x1b\\`（ST 終端）パターンも検出する
  - [ ] メッセージ部分を正しく抽出する
  - [ ] OSC 9 以外のエスケープシーケンスには反応しない
  - [ ] 検出がターミナルの表示に影響しない（パーサーは通常通り動作）

#### F-3: 検出した OSC 9 メッセージから通知を発火

- **説明**: 検出したメッセージを Phase 1 の通知分類・送信ロジックに渡して macOS 通知を発火する
- **受け入れ条件**:
  - [ ] フォーカス判定が動作する（SpecPrompt フォーカス中は抑制）
  - [ ] Phase 1 の `send_native_notification` で通知が表示される

### 非機能要件

- **パフォーマンス**: OSC 検出がターミナルのレンダリングをブロックしないこと
- **安全性**: `TERM_PROGRAM` の設定が他のコマンドに悪影響を与えないこと
- **ゼロセットアップ**: ユーザーの操作なしに通知が動作すること

## スコープ

### 対象

- `pty.rs` への `TERM_PROGRAM` 環境変数追加
- PTY 出力リーダースレッドへの OSC 9 検出ロジック追加
- Phase 1 の通知送信ロジックとの接続

### 対象外

- 設定 UI（Phase 3）
- hooks / ラッパースクリプト方式（廃止）

## 実装対象ファイル（予定）

- `src-tauri/src/commands/pty.rs` — `TERM_PROGRAM` 設定 + OSC 9 検出
- `src-tauri/src/commands/notification.rs` — 既存の通知送信ロジックを再利用

## 依存関係

- Phase 1 の通知基盤（`send_native_notification`, `classify_notification`, `extract_message`）

## 参考資料

- OSC 9 フォーマット: `ESC ] 9 ; <message> BEL`
- Claude Code の通知チャンネル: `/config` → Notifications → Auto / iterm2
- Zenn 記事: https://zenn.dev/ryok/articles/claude-code-notification-ghostty-vscode
