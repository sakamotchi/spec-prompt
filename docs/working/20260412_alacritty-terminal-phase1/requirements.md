# 要件定義書 - alacritty-terminal Phase 1（Rust側実装）

## 概要

`alacritty-terminal` クレートを Rust バックエンドに統合し、PTY 出力を VTE パース済みのセルグリッドとして WebView に送信できるようにする。

## 背景・目的

現在の実装は PTY 出力の生バイト列を `pty-output` イベントで WebView に送り、xterm.js（WKWebView 上）で VTE パース・レンダリングしている。WKWebView のフォント計測問題が根本的に解消できないため、VTE パースと端末状態管理を Rust 側に移す。

Phase 1 では **Rust 側の実装のみ** を行い、WebView 側（Phase 2）の新レンダラーが接続できる IPC 基盤を構築する。Phase 1 完了後も xterm.js は引き続き動作させ（`pty-output` イベントは維持）、Phase 2 開発中の並行動作を保証する。

## 要件一覧

### 機能要件

#### F-1: alacritty-terminal クレートの統合

- **説明**: `alacritty-terminal` クレートを Cargo.toml に追加し、ビルドが通ること
- **受け入れ条件**:
  - [ ] `cargo check` がエラーなしで通る
  - [ ] `alacritty-terminal` の `Term<T>` をインスタンス化できる

#### F-2: TerminalInstance の実装

- **説明**: `Term<TermEventHandler>` をラップした `TerminalInstance` を実装する
- **受け入れ条件**:
  - [ ] `new(cols, rows, pty_id)` でインスタンスを生成できる
  - [ ] `advance(bytes)` で PTY 出力バイト列を Term に送り込める
  - [ ] `dirty_cells()` で変更されたセルの一覧を取得できる
  - [ ] `resize(cols, rows)` で端末サイズを変更できる

#### F-3: セルデータ構造と IPC イベント

- **説明**: セルグリッドを JSON シリアライズ可能な `CellData` に変換し、`terminal-cells` イベントで送信する
- **受け入れ条件**:
  - [ ] `CellData`（row, col, ch, width, fg, bg, flags）が Serialize を実装している
  - [ ] `ColorData`（Named / Indexed / Rgb / Default）が正しくシリアライズされる
  - [ ] PTY 出力後に `terminal-cells` イベントが emit される
  - [ ] カーソル位置（row, col）がイベントペイロードに含まれる

#### F-4: TerminalManager の実装

- **説明**: `pty_id` をキーに `TerminalInstance` を管理する `TerminalManager` を実装し、AppState に登録する
- **受け入れ条件**:
  - [ ] `spawn_pty` 実行時に対応する `TerminalInstance` が生成・登録される
  - [ ] `close_pty` 実行時に `TerminalInstance` が破棄される
  - [ ] `TerminalManager` が `tauri::Builder::manage()` に登録されている

#### F-5: PTY 出力スレッドの改修

- **説明**: 既存の PTY 読み取りスレッドで `term.advance()` を呼び出し、`terminal-cells` イベントを emit するよう改修する
- **受け入れ条件**:
  - [ ] `pty-output` イベントは維持される（xterm.js との並行動作保証）
  - [ ] `terminal-cells` イベントが新たに emit される
  - [ ] `dirty_cells()` で取得した変更セルのみ送信される（全画面送信しない）

#### F-6: resize_terminal コマンドの実装

- **説明**: `Term` と PTY 両方をリサイズする `resize_terminal` コマンドを実装する
- **受け入れ条件**:
  - [ ] `resize_terminal(id, cols, rows)` で `TerminalInstance.resize()` と `resize_pty()` が両方呼ばれる
  - [ ] コマンドが `invoke_handler` に登録されている

### 非機能要件

- **パフォーマンス**: PTY 出力処理のレイテンシが現行（`pty-output` のみ）と比較して体感できるほど遅くならないこと
- **保守性**: `terminal/` モジュールと `commands/pty.rs` の責務を明確に分離すること

## スコープ

### 対象

- `src-tauri/Cargo.toml` への依存追加
- `src-tauri/src/terminal/` モジュール（新規）
- `src-tauri/src/commands/pty.rs` の改修（最小限）
- `src-tauri/src/lib.rs` への `TerminalManager` 登録

### 対象外

- WebView 側のレンダラー実装（Phase 2）
- キーボード入力エンコード（Phase 2）
- スクロールバック・コピー（Phase 3）
- xterm.js の廃止（Phase 4）

## 実装対象ファイル（予定）

- `src-tauri/Cargo.toml`
- `src-tauri/src/terminal/mod.rs`（新規）
- `src-tauri/src/terminal/instance.rs`（新規）
- `src-tauri/src/terminal/event.rs`（新規）
- `src-tauri/src/terminal/grid.rs`（新規）
- `src-tauri/src/commands/pty.rs`
- `src-tauri/src/lib.rs`

## 依存関係

- `alacritty-terminal` クレート（バージョンは追加時に最新安定版をピン留め）
- 既存: `portable-pty`, `tauri`, `serde`, `tokio`, `uuid`

## 既知の制約

- `alacritty-terminal` の内部 API は semver 保証が弱いため、バージョンをピン留めする
- `Term<T>` は `Send` でないため、Mutex での管理が必要
