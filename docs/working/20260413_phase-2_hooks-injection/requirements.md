# 要件定義書 - Phase 2: hooks 注入（ラッパースクリプト）

## 概要

Phase 1 で構築した HTTP サーバー + 通知基盤に対して、Claude Code の hooks を自動注入する仕組みを構築する。cmux と同様に claude コマンドのラッパースクリプトを経由し、`--settings` フラグで hooks JSON をインライン注入する。

## 背景・目的

cmux の実装分析から、hooks は `~/.claude/settings.json` に書き込むのではなく、claude コマンド起動時に `--settings` フラグで JSON をインライン渡しする方式が最も安全かつ設定不要であることが判明した。SpecPrompt のターミナル内でのみ hooks が有効になり、外部のターミナルには影響しない。

## 要件一覧

### 機能要件

#### F-1: claude-notify.sh（hooks コマンドスクリプト）

- **説明**: Claude Code が hooks イベント発火時に実行するスクリプト。stdin から JSON を読み取り、Phase 1 の HTTP エンドポイントに POST する
- **受け入れ条件**:
  - [ ] stdin から JSON を読み取れる
  - [ ] `curl` で `http://127.0.0.1:19823/claude-hook/{event}` に POST する
  - [ ] SpecPrompt が起動していない場合でもエラーなく終了する
  - [ ] 5 秒以内に完了する（Claude Code のデフォルトタイムアウト）

#### F-2: claude-wrapper.sh（claude コマンドラッパー）

- **説明**: SpecPrompt のターミナル内で `claude` を実行した際に、`--settings` で hooks JSON を注入して本物の claude を起動するラッパー
- **受け入れ条件**:
  - [ ] `SPEC_PROMPT_NOTIFICATION` 環境変数が設定されている場合のみ hooks を注入する
  - [ ] 環境変数が未設定の場合は本物の claude を素通しで実行する
  - [ ] 本物の claude バイナリを PATH から正しく見つける（自分自身をスキップ）
  - [ ] `--settings` で渡す JSON がユーザーの settings.json とマージされる

#### F-3: スクリプト自動配置

- **説明**: アプリ初回起動時にラッパーと hooks スクリプトを `~/.config/spec-prompt/` に配置する
- **受け入れ条件**:
  - [ ] `~/.config/spec-prompt/bin/claude` が作成される
  - [ ] `~/.config/spec-prompt/hooks/claude-notify.sh` が作成される
  - [ ] 両ファイルに実行権限が付与される
  - [ ] 既存ファイルがあれば上書き更新する

#### F-4: PTY 起動時の環境変数設定

- **説明**: `spawn_pty` で PTY を起動する際に、ラッパーが動作するための環境変数を設定する
- **受け入れ条件**:
  - [ ] `SPEC_PROMPT_NOTIFICATION=1` が設定される
  - [ ] PATH の先頭に `~/.config/spec-prompt/bin/` が追加される
  - [ ] 既存の PATH は保持される

### 非機能要件

- **パフォーマンス**: ラッパースクリプトのオーバーヘッドが 100ms 以内であること
- **安全性**: SpecPrompt 外のターミナルでは claude の動作に一切影響しないこと
- **保守性**: スクリプトはアプリのリソースにバンドルし、バージョン管理する

## スコープ

### 対象

- claude-notify.sh の作成
- claude-wrapper.sh の作成
- Rust 側のスクリプト配置コマンド
- pty.rs への環境変数追加

### 対象外

- 設定 UI（Phase 3）
- 通知 ON/OFF の制御（Phase 3）

## 実装対象ファイル（予定）

- `src-tauri/resources/claude-wrapper.sh` — 新規
- `src-tauri/resources/claude-notify.sh` — 新規
- `src-tauri/src/commands/notification.rs` — スクリプト配置関数追加
- `src-tauri/src/commands/pty.rs` — 環境変数設定追加
- `src-tauri/src/lib.rs` — 初回起動時のスクリプト配置呼び出し

## 依存関係

- Phase 1 の HTTP サーバー・通知基盤が完成していること
- `curl` コマンドがユーザー環境に存在すること（macOS 標準）

## 参考資料

- cmux の claude ラッパー: `/Applications/cmux.app/Contents/Resources/bin/claude`
- `docs/local/20260413-claude-code通知機能/02_概要設計書.md`
