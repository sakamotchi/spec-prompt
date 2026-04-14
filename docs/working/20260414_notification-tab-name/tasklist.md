# タスクリスト - notification-tab-name（P1）

## 進捗サマリー

| 状態 | 件数 |
|------|------|
| 完了 | 9 |
| 進行中 | 0 |
| 未着手 | 1 |（T-10 マージのみ残）

## タスク一覧

### T-1: 要件定義・設計

- [x] 要件定義書の作成（`requirements.md`）
- [x] 設計書の作成（`design.md`）
- [x] タスクリストの作成（`tasklist.md`）
- [x] テスト手順書の作成（`testing.md`）
- [x] ユーザーレビュー完了

### T-2: Rust 側 — DisplayTitleCache の追加

対応要件: F-2

- [x] `src-tauri/src/commands/notification.rs` に `DisplayTitleCache` 構造体を追加（`set` / `get` / `remove`）
- [x] `src-tauri/src/lib.rs` で `.manage(DisplayTitleCache::new())` を追加
- [x] `cd src-tauri && cargo check` がエラーなし

### T-3: Rust 側 — `set_pty_display_title` コマンド

対応要件: F-3

- [x] `notification.rs` に `#[tauri::command] pub fn set_pty_display_title` を追加
- [x] `lib.rs` の `invoke_handler` に登録
- [x] `cd src-tauri && cargo check` がエラーなし

### T-4: Rust 側 — 通知送信時のタイトル合成

対応要件: F-1

- [x] `src-tauri/src/commands/pty.rs:144-152` の通知送信ブロックで `DisplayTitleCache::get` を参照
- [x] 値がある場合 `Claude Code — <name>`、ない場合は `SpecPrompt / Claude Code` にフォールバック
- [x] 既存のフォーカス判定・通知 OFF 時の抑止ロジックに影響しないこと

### T-5: Rust 側 — `close_pty` でのキャッシュ掃除

対応要件: F-2（ライフサイクル）

- [x] `close_pty` の引数に `State<DisplayTitleCache>` を追加
- [x] `title_cache.remove(&id)` を呼び出し
- [x] `invoke_handler` に変更なしで OK（State 注入は自動）

### T-6: Rust ユニットテスト

対応要件: F-2

- [x] `DisplayTitleCache` の set / get / overwrite / remove / unknown-key の 5 件をテスト（multiple-keys-independent も追加）
- [x] `cd src-tauri && cargo test` がパス（94 件全件）

### T-7: Front 側 — `tauriApi.setPtyDisplayTitle` の追加

対応要件: F-3

- [x] `src/lib/tauriApi.ts` に `setPtyDisplayTitle(ptyId, title)` を追加
- [x] 型エラーなし（`npx tsc --noEmit` クリア）

### T-8: Front 側 — 初期同期

対応要件: F-4

- [x] `src/components/TerminalPanel/TerminalPanel.tsx` の `spawnPty` 呼び出し箇所を特定
- [x] `spawnPty` 成功 → `setPtyId` 後に `tauriApi.setPtyDisplayTitle(ptyId, tab.title)` を呼ぶ
- [x] エラー時は `console.error` に記録のみで UI ブロックしない
- [x] `tab.title` 更新経路は本フェーズでは存在しないため、spawn 時の 1 回のみで対応（Phase 2 で再同期経路を追加予定）

### T-9: 結合・テスト

対応要件: F-1 〜 F-4 通し

- [x] `npx tauri dev` で起動確認（ユーザー検証）
- [x] `testing.md` の手動テスト全件を実行（ユーザー検証）
  - ケース 3 は `printf` では検証不可と判明したため、`claude` 実行による検証に書き換え済み
- [x] 既存機能（OSC 9 通知 / フォーカス時抑制 / 通知 OFF）の回帰なし

### T-10: ドキュメント・マージ

- [ ] 永続化ドキュメント（`docs/steering/02_functional_design.md` 等）への反映要否を確認
- [ ] コミット・PR 作成
- [ ] レビュー → マージ

## 完了条件

- [ ] 全タスク（T-1 〜 T-10）が完了
- [ ] `npm run lint` がエラーなし
- [ ] `cd src-tauri && cargo test` がパス
- [ ] `testing.md` の手動テストが全件 OK
- [ ] Phase 2 着手時に本フェーズで導入した `DisplayTitleCache` / `set_pty_display_title` をそのまま再利用できる状態
