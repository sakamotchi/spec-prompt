# タスクリスト - alacritty-terminal Phase 1（Rust側実装）

## 進捗サマリー

| 状態 | 件数 |
|------|------|
| 完了 | 15 |
| 進行中 | 0 |
| 未着手 | 0 |

## タスク一覧

### T-1: 事前調査 ✅

- [x] `alacritty-terminal` の最新安定バージョンを確認する → `0.25.1`
- [x] `Term::grid()` および dirty セル取得の API を確認する → `Term::damage()` / `Term::reset_damage()` / `TermDamage::Full|Partial`
- [x] `alacritty_terminal::event::EventListener` トレイトのシグネチャを確認する → `send_event(&self, Event)` 1メソッド（デフォルト実装あり）

### T-2: 依存追加・モジュール骨格（1-A）✅

- [x] `Cargo.toml` に `alacritty-terminal` を追加しバージョンをピン留めする（`=0.25.1`）
- [x] `cargo check` がエラーなしで通ることを確認する
- [x] `src-tauri/src/terminal/` ディレクトリと `mod.rs` を作成する
- [x] `lib.rs` で `mod terminal;` を宣言する

### T-3: TerminalInstance 実装（1-A）✅

- [x] `terminal/event.rs` に `TermEventHandler`（`EventListener` 実装）を作成する
- [x] `terminal/instance.rs` に `TerminalInstance` を実装する（new / advance / collect_damage / resize）
- [x] `cargo check` がエラーなしで通ることを確認する

### T-4: セルデータ構造と変換（1-B）✅

- [x] `terminal/grid.rs` に `CellData / ColorData / CellFlags` を定義し `Serialize` を実装する
- [x] `collect_damage()` を実装する（TermDamage::Full|Partial → renderable_content で全可視セル抽出）
- [x] `CellData` の Rust ユニットテストを追加する（serialize / color variants）
- [x] `cargo test` がパスすることを確認する（29テスト全パス）

### T-5: TerminalManager と IPC（1-B）✅

- [x] `terminal/mod.rs` に `TerminalManager` を実装する（insert / remove / advance_and_collect / resize）
- [x] `TerminalCellsPayload / CursorPos` を定義する
- [x] `lib.rs` に `TerminalManager::new()` を `manage()` で登録する

### T-6: spawn_pty 改修（1-C）✅

- [x] `spawn_pty` のシグネチャに `terminal_manager: State<TerminalManager>` を追加する
- [x] `spawn_pty` 内で `TerminalInstance::new()` を生成し `TerminalManager` に登録する
- [x] PTY 読み取りスレッドで `advance_and_collect` → `terminal-cells` emit を追加する（`app.state()` 経由）
- [x] `pty-output` イベントが引き続き emit されることを確認する

### T-7: resize_terminal コマンドと close 対応（1-C）✅

- [x] `resize_terminal` コマンドを `commands/pty.rs` に実装する
- [x] `close_pty` で `TerminalManager` からも `remove` するよう改修する
- [x] `resize_terminal` を `lib.rs` の `invoke_handler` に追加する

### T-8: 動作確認 ✅

- [x] `npx tauri dev` でアプリが起動することを確認する（既存機能が壊れていないこと）
- [x] `terminal-cells` イベントが WebView に届いていることをブラウザ DevTools で確認する
- [x] `pty-output` イベントも引き続き届いていることを確認する（xterm.js が動作し続ける）
- [x] testing.md の手動テストを全件実施する

## 完了条件

- [x] 全タスクが完了している
- [x] `cd src-tauri && cargo check` がエラーなし
- [x] `cd src-tauri && cargo test` がパス
- [x] `npx tauri dev` で既存のターミナル（xterm.js）が正常動作する
- [x] DevTools で `terminal-cells` イベントの受信が確認できる
