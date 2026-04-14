# 要件定義書 - dynamic-tab-title（P2: OSC 0/1/2 による動的タブタイトル）

## 概要

SpecPrompt の統合ターミナルで、シェル／コマンドが出力する **OSC 0 / OSC 1 / OSC 2** エスケープシーケンス（ウィンドウタイトル・アイコンタイトル・タブタイトルの設定）を検出し、タブのラベルを自動的にそのタイトル文字列に更新する。macOS 標準ターミナル（Terminal.app）相当の挙動を実現する。

更新されたタブタイトルは、Phase 1 で追加した `DisplayTitleCache` を経由して **OS 通知のタイトルにも自動的に反映** される（例: `Claude Code — vim foo.ts`）。

本ドキュメントは 4 フェーズ計画のうち **Phase 2** を対象とする。手動リネーム UI（P3）と未読マーク（P4）は本フェーズのスコープ外。

## 背景・目的

- Phase 1 で通知タイトルにタブ名（`Terminal N`）を差し込む基盤が整った。
- 現状タブ名は作成時の連番（`Terminal 1`, `Terminal 2`）に固定されており、タブを見ても何が動いているか分からない。
- macOS Terminal.app は shell の OSC 0/1/2 出力を解釈してタブラベルを自動更新する標準機能を備えている。SpecPrompt の `alacritty-terminal` は OSC 0/1/2 を内部で `Event::Title(String)` / `Event::ResetTitle` として発火しうるが、現状 `TermEventHandler::send_event` が全イベントを破棄している（`src-tauri/src/terminal/event.rs:8`）。
- Phase 2 で `TermEventHandler` の no-op を脱却し、OSC タイトル更新を UI と通知タイトル両方に反映させる。

## 要件一覧

### 機能要件

#### F-1: OSC タイトルイベントの中継

- **説明**:
  `TermEventHandler::send_event` で `Event::Title(String)` と `Event::ResetTitle` を捕捉し、該当 `pty_id` と一緒に Tauri イベント `terminal-title-changed` を emit する。
- **受け入れ条件**:
  - [ ] シェルで `echo -ne "\033]2;hello\007"` を実行するとフロントに `{ pty_id, title: "hello" }` が届く
  - [ ] `echo -ne "\033]2;\007"`（空文字）または ResetTitle 相当のイベントで `{ pty_id, title: null }` が届く
  - [ ] OSC 0（window + icon）・OSC 1（icon）・OSC 2（window）いずれでもタブ更新が起きる（alacritty-terminal が `Event::Title` にマップするものを対象とする）
  - [ ] 他の `Event` バリアント（例: `Event::Bell`）は従来どおり無視される（副作用なし）

#### F-2: フロントエンドでのタブラベル更新

- **説明**:
  `TerminalTab` に `oscTitle: string | null` を追加し、Tauri イベント受信時に更新する。UI は `computeDisplayTitle(tab)` で表示タイトルを合成する（本フェーズでは `oscTitle ?? fallbackTitle` の 2 段優先）。
- **受け入れ条件**:
  - [ ] OSC 2 が届いたタブだけラベルが変わる（他のタブは影響なし）
  - [ ] 空文字 / null を受けたタブはフォールバック名（`Terminal N`）に戻る
  - [ ] 同一 OSC タイトルが連続して届いてもストア更新は抑止される（パフォーマンス対策）
  - [ ] 制御文字（`\x00-\x1F`, `\x7F`）が含まれる文字列はサニタイズされて UI に出る
  - [ ] 長文タイトルが来ても UI 崩れを起こさない（省略表示 + ツールチップで全文）

#### F-3: 通知タイトルへの反映（Rust キャッシュ同期）

- **説明**:
  フロントで表示タイトルが変化するたびに、P1 で追加済みの `set_pty_display_title` コマンドを通じて Rust 側 `DisplayTitleCache` を最新化する。これにより OSC 9 通知のタイトルにも新しい OSC タイトルが差し込まれる。
- **受け入れ条件**:
  - [ ] OSC 2 で `vim foo.ts` に変わった直後にアプリをバックグラウンドにして通知を発火させると、通知タイトルが `Claude Code — vim foo.ts` になる
  - [ ] OSC タイトルが空文字 / null に戻った場合、通知タイトルも `Claude Code — Terminal N`（フォールバック名）に戻る
  - [ ] 同一タイトルの連続更新では invoke が発火しない（Zustand 側の差分判定で抑止）

#### F-4: `TermEventHandler` の I/F 変更に伴う既存コードの整合

- **説明**:
  `TermEventHandler` は `AppHandle` と `pty_id` を保持する必要があるため、`TerminalInstance::new` のシグネチャが変わる。既存呼び出し元（`src-tauri/src/commands/pty.rs:132` の `TerminalInstance::new(80, 24)`）を更新する。
- **受け入れ条件**:
  - [ ] `cargo check` / `cargo test` がパス
  - [ ] 既存の `terminal-cells` 配信・スクロール・リサイズ機能に回帰なし

### 非機能要件

- **パフォーマンス**:
  - OSC タイトル更新はプロンプトごと（`PS1` 内蔵時）に届きうるためバースト耐性が必要。Zustand 側で直前値と同一ならストア更新を抑止、Rust 同期 invoke も抑止する。
  - `terminal-cells` イベントのスループットを阻害しないこと（OSC タイトル中継は別チャネル）。
- **ユーザビリティ**:
  - ユーザー側の追加操作は不要。OSC 対応シェル（macOS 標準 zsh 含む）であれば自動で動作する。
  - 長いタイトルは省略表示、マウスホバーのツールチップで全文確認可能。
- **保守性**:
  - `TermEventHandler` は pty ごとに 1 インスタンス（軽量）。
  - `computeDisplayTitle` / `sanitizeTitle` は純粋関数として `terminalStore.ts` にエクスポートし、P3・P4 で再利用可能。
- **外観・デザイン**:
  - タブラベルは `src/index.css` の CSS カスタムプロパティ（`--color-text-primary` 等）を踏襲。本フェーズで新規色定義は行わない。
  - ラベルの最大幅は CSS で制御（Tailwind の `max-w-[12rem] truncate` 想定）。

## スコープ

### 対象

- Rust: `TermEventHandler` の I/F 変更（`AppHandle` + `pty_id` 保持）と `Event::Title` / `Event::ResetTitle` の中継
- Rust: `TerminalInstance::new` のシグネチャ変更と呼び出し元（`pty.rs`）の更新
- Rust: 新規 Tauri イベント `terminal-title-changed { pty_id, title: Option<String> }`
- Front: `TerminalTab` 型の拡張（`fallbackTitle` / `oscTitle`）
- Front: `computeDisplayTitle` / `sanitizeTitle` ユーティリティ
- Front: `setOscTitle` アクションと Tauri イベント購読
- Front: Zustand subscribe による Rust `DisplayTitleCache` への再同期
- Front: `TerminalTabs.tsx` の表示ロジック差し替え（ツールチップ・省略表示）
- テスト: Rust ユニットテスト（handler の emit、`Event::Title` 以外の無視）、Front ユニットテスト（優先順位・サニタイズ・同一値抑止）、手動 E2E

### 対象外

- タブの手動リネーム UI（ダブルクリック編集、右クリックメニュー）(Phase 3)
- `pinned` / `manualTitle` の導入（Phase 3 で追加）
- 未読マーク `●` / タブハイライト / 解除ロジック（Phase 4）
- OSC 7（`file://` URL）による CWD 追跡
- シェルプロンプトのパースによる「実行中コマンド名」推定
- ウィンドウタイトル・Dock メニューへの反映

## 実装対象ファイル（予定）

- `src-tauri/src/terminal/event.rs` — `TermEventHandler` に `AppHandle` + `pty_id` を保持、`Event::Title` / `ResetTitle` を emit
- `src-tauri/src/terminal/instance.rs` — `TerminalInstance::new` のシグネチャ変更（`(cols, lines, app, pty_id)`）
- `src-tauri/src/commands/pty.rs` — `TerminalInstance::new` 呼び出しの更新
- `src/lib/tauriApi.ts` — `onTerminalTitleChanged` リスナー追加
- `src/stores/terminalStore.ts` — `TerminalTab` 型拡張、`computeDisplayTitle`、`sanitizeTitle`、`setOscTitle`、`findTabByPtyId` 追加
- `src/components/TerminalPanel/TerminalTabs.tsx` — 表示タイトル参照を `computeDisplayTitle(tab)` に置換、ツールチップ追加
- `src/App.tsx`（または初期化箇所） — `onTerminalTitleChanged` 購読、Zustand subscribe による Rust 同期

## 依存関係

- **Phase 1** 実装（`feature/p1-notification-tab-name`）で追加済みの:
  - `DisplayTitleCache` 構造体
  - `set_pty_display_title` Tauri コマンド
  - `tauriApi.setPtyDisplayTitle`
  - `TerminalPanel` での spawn 時初期同期
- `alacritty_terminal` v0.25.1（`src-tauri/Cargo.toml:25`）の `Event::Title` / `Event::ResetTitle`

## 既知の制約

- `alacritty_terminal` が OSC 0/1 をどう扱うか（`Event::Title` にまとめて流すか、OSC 1 は別扱いか）は実装時に最小 POC で要検証。最悪の場合 OSC 2 のみ対応となる可能性あり（P2 の完了条件としては OSC 2 サポート必須、OSC 0/1 はベストエフォート）。
- `persist` 対象に `TerminalTab` が含まれる場合、`title` → `fallbackTitle`/`oscTitle` への型変更でマイグレーションが必要。現在の `terminalStore` は `persist` を使っていないため影響なし（実装時に再確認）。
- OSC タイトルがプロンプトごとに届く環境では毎秒数回のイベントがありうる。同一値抑止を入れないと Rust へのinvoke が過剰になる。

## 参考資料

- `docs/local/20260414-タブ識別通知と動的タブタイトル/01_要件定義書.md` — 全体要件（FR-02, FR-03（pinned 除く）、FR-04 が本フェーズ相当）
- `docs/local/20260414-タブ識別通知と動的タブタイトル/02_概要設計書.md` — 全体設計（3-1, 3-3, 3-4, 3-6, 3-7 が本フェーズ相当）
- `docs/local/20260414-タブ識別通知と動的タブタイトル/03_WBS.md` — Phase 2 セクション
- `docs/working/20260414_notification-tab-name/` — Phase 1 の要件・設計・テスト
- xterm 制御シーケンス仕様: https://invisible-island.net/xterm/ctlseqs/ctlseqs.html
- alacritty_terminal `Event` enum: https://docs.rs/alacritty_terminal/0.25/alacritty_terminal/event/enum.Event.html
