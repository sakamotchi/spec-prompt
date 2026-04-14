# タスクリスト - dynamic-tab-title（P2）

## 進捗サマリー

| 状態 | 件数 |
|------|------|
| 完了 | 13 |
| 進行中 | 0 |
| 未着手 | 1 |（T-14 マージのみ残）

## 前提

本フェーズは **Phase 1**（通知タイトルへのタブ識別子差し込み）の以下を前提とする:
- `DisplayTitleCache` 構造体（`src-tauri/src/commands/notification.rs`）
- `set_pty_display_title` Tauri コマンド
- `tauriApi.setPtyDisplayTitle`
- `TerminalPanel` の spawn 時初期同期

Phase 1〜4 は同一ブランチ `feature/tab-title-and-notification` 上で進行する。

## タスク一覧

### T-1: 要件定義・設計

- [x] 要件定義書の作成（`requirements.md`）
- [x] 設計書の作成（`design.md`）
- [x] タスクリストの作成（`tasklist.md`）
- [x] テスト手順書の作成（`testing.md`）
- [x] ユーザーレビュー完了

### T-2: 事前調査 — alacritty_terminal の OSC 挙動確認

対応要件: F-1

- [x] alacritty_terminal v0.25.1 で `Event::Title(String)` / `Event::ResetTitle` が定義されていることを Cargo registry のソース（`alacritty_terminal-0.25.1/src/event.rs`）で確認
- [x] `Event` enum にその他バリアント（`Bell` / `Wakeup` / `MouseCursorDirty` 等）も存在することを確認、テストで無視対象として使用

### T-3: Rust — `TermEventHandler` 刷新

対応要件: F-1

- [x] `src-tauri/src/terminal/event.rs` の `TermEventHandler` をユニット構造体から `{ app: Option<AppHandle>, pty_id: String }` に変更（`Option` はテスト用 `noop()` コンストラクタのため）
- [x] `new(app, pty_id)` コンストラクタ追加
- [x] `Serialize` な `TitleChangedPayload` 型を定義
- [x] `build_payload(pty_id, event)` ヘルパー（テスト容易性のため）
- [x] `send_event` で `Event::Title` / `Event::ResetTitle` を捕捉して `app.emit("terminal-title-changed", payload)`
- [x] 他バリアントは従来どおり無視
- [x] `cargo check` がエラーなし

### T-4: Rust — `TerminalInstance::new` シグネチャ変更

対応要件: F-4

- [x] `src-tauri/src/terminal/instance.rs` の `TerminalInstance::new(cols, lines)` → `new(cols, lines, app, pty_id)` へ変更
- [x] 内部は `from_handler(cols, lines, handler)` に抽出。`new_for_test` からも再利用
- [x] `cargo check` がエラーなし

### T-5: Rust — `pty.rs` 呼び出し更新

対応要件: F-4

- [x] `src-tauri/src/commands/pty.rs:132` の `TerminalInstance::new(80, 24)` を `TerminalInstance::new(80, 24, app.clone(), id.clone())` に変更
- [x] 既存の `terminal-cells` 配信・スクロール・リサイズに回帰なし
- [x] `cargo check` / `cargo test` がパス

### T-6: Rust — ユニットテスト

対応要件: F-1

- [x] `event.rs` の `build_payload` ヘルパーに対して 5 件テスト（title / trim / empty→None / reset / その他バリアント無視）
- [x] `new_for_test` を導入し `instance.rs` の既存 12 件のテスト呼び出しを `TerminalInstance::new_for_test(80, 24)` に置換
- [x] `cargo test` が 99 件全件パス

### T-7: Front — 型定義とユーティリティ

対応要件: F-2

- [x] `src/stores/terminalStore.ts` の `TerminalTab` 型を `{ id, ptyId, fallbackTitle, oscTitle }` に変更
- [x] `makeTab` が `fallbackTitle: "Terminal N"` / `oscTitle: null` を設定するように変更
- [x] `sanitizeTitle` 関数をエクスポート
- [x] `computeDisplayTitle` 関数をエクスポート
- [x] 既存コードで `tab.title` を参照している箇所を `computeDisplayTitle(tab)` に置換（`TerminalTabs.tsx` / `TerminalPanel.tsx`）

### T-8: Front — `setOscTitle` アクション

対応要件: F-2

- [x] `TerminalState` に `setOscTitle(ptyId, rawTitle)` を追加
- [x] `primary` / `secondary` 両方のペインを走査し、該当 `ptyId` のタブを更新
- [x] サニタイズ後の値と直前値が同一ならストア更新をスキップ（参照同一性で早期 return）

### T-9: Front — Tauri API と購読

対応要件: F-1 (フロント側受信)

- [x] `src/lib/tauriApi.ts` に `TerminalTitleChangedPayload` 型と `onTerminalTitleChanged` リスナーを追加
- [x] `src/components/Layout/AppLayout.tsx` で `onTerminalTitleChanged` を購読し `setOscTitle` を呼ぶ
- [x] クリーンアップ（`useEffect` return）で `unlisten` を呼ぶ

### T-10: Front — Zustand subscribe による Rust 同期

対応要件: F-3

- [x] `AppLayout.tsx` で `useTerminalStore.subscribe` を起動
- [x] `(tab.ptyId, computeDisplayTitle(tab))` の組が変化したタブを検出し `tauriApi.setPtyDisplayTitle(ptyId, display)` を呼ぶ
- [x] クリーンアップで unsubscribe

### T-11: Front — UI 表示の差し替え

対応要件: F-2

- [x] `src/components/TerminalPanel/TerminalTabs.tsx` を `computeDisplayTitle(tab)` に変更
- [x] ラベルに Tailwind の `max-w-[12rem] truncate` を適用
- [x] `<button title={display}>` でツールチップ表示

### T-12: Front — ユニットテスト

対応要件: F-2, F-3

- [x] `terminalStore.test.ts` に以下を追加:
  - `sanitizeTitle`: trim / C0 制御文字除去 / DEL 除去 / 空 → null / null 入力 / 日本語保持
  - `computeDisplayTitle`: oscTitle 優先 / null 時は fallbackTitle
  - `setOscTitle`: 該当タブの更新 / 空文字リセット / サニタイズ / unknown ptyId 無視 / 同一値時の参照不変 / ペイン跨ぎ
- [x] 既存テストを新型に合わせて更新
- [x] `npm run test` が 111 件全件パス

### T-13: 結合・テスト

対応要件: F-1 〜 F-4 通し

- [x] `npx tauri dev` で起動確認（ユーザー検証）
- [x] `testing.md` の手動テスト全件を実行（ユーザー検証）
- [x] 既存機能（P1 の通知タイトル差し込み含む）の回帰なし

### T-14: ドキュメント・マージ

- [ ] 永続化ドキュメント（`docs/steering/02_functional_design.md` 等）への反映要否を確認
- [ ] コミット・PR 作成（`feature/tab-title-and-notification` → `main`）
- [ ] レビュー → マージ

## 完了条件

- [x] 全実装タスク（T-1 〜 T-13）が完了
- [x] `npm run lint` がエラーなし（新規追加分）
- [x] `npm run test` がパス（111 件）
- [x] `cargo test` がパス（99 件）
- [x] `testing.md` の手動テストが全件 OK
- [x] P1 の通知タイトル差し込み挙動が OSC タイトル変化に追随する（= 通知タイトルが `Claude Code — vim foo.ts` のように動的に変わる）
- [x] Phase 3（手動リネーム）の実装時に `computeDisplayTitle` を拡張するだけで済む構造になっている
