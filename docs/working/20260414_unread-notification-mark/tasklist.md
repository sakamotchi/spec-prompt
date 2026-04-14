# タスクリスト - unread-notification-mark（P4）

## 進捗サマリー

| 状態 | 件数 |
|------|------|
| 完了 | 9 |
| 進行中 | 0 |
| 未着手 | 1 |（T-10 マージのみ残）

## 前提

本フェーズは Phase 1 / 2 / 3 の以下を前提とする:

- Phase 1: `DisplayTitleCache` と OSC 9 検出・`is_app_focused` 判定（`src-tauri/src/commands/pty.rs`）
- Phase 2: `TerminalTab` の `fallbackTitle` / `oscTitle`、`computeDisplayTitle`、`AppLayout` の Zustand subscribe
- Phase 3: `TerminalTab.manualTitle` / `pinned`、`TabContextMenu`、`TabInlineRenameInput`、編集中のクリック抑止ロジック

Phase 1〜4 は同一ブランチ `feature/tab-title-and-notification` 上で進行する。

## タスク一覧

### T-1: 要件定義・設計

- [x] 要件定義書の作成（`requirements.md`）
- [x] 設計書の作成（`design.md`）
- [x] タスクリストの作成（`tasklist.md`）
- [x] テスト手順書の作成（`testing.md`）
- [x] ユーザーレビュー完了

### T-2: Rust — 通知発火イベントの emit 追加

対応要件: F-1

- [x] `src-tauri/src/commands/pty.rs` の OSC 9 検出ブロック（既存 `if !is_app_focused(&app)` の中、通知送信直後）で `app.emit("claude-notification-fired", serde_json::json!({ "pty_id": pty_id.clone() }))` を追加
- [x] `cargo check` / `cargo test`（99 件）に回帰なし

### T-3: Front — 型拡張と初期値

対応要件: F-1

- [x] `src/stores/terminalStore.ts` の `TerminalTab` に `hasUnreadNotification: boolean` を追加
- [x] `makeTab` の初期化で `hasUnreadNotification: false`
- [x] 既存テストの `makeTab` ヘルパーと `baseTab` ヘルパーも同様に更新
- [x] 型エラーなし

### T-4: Front — `markUnread` / `clearUnread` アクション

対応要件: F-1, F-3, F-4

- [x] `TerminalState` に `markUnread(ptyId)` と `clearUnread(tabId)` を追加
- [x] `markUnread`:
  - `pty_id` 一致のタブを特定
  - そのタブが active かつ `document.hasFocus()=true` なら no-op
  - すでに `hasUnreadNotification=true` なら no-op（state 参照不変）
  - 上記を満たさなければ `hasUnreadNotification=true` に更新
- [x] `clearUnread`:
  - `tab_id` 一致のタブを特定
  - すでに false なら no-op
  - true なら false に戻す

### T-5: Front — Tauri API と購読

対応要件: F-1

- [x] `src/lib/tauriApi.ts` に `ClaudeNotificationFiredPayload` 型と `onClaudeNotificationFired` リスナーを追加
- [x] `src/components/Layout/AppLayout.tsx` で `onClaudeNotificationFired` を購読し `markUnread(pty_id)` を呼ぶ
- [x] クリーンアップ（`useEffect` return）で `unlisten` を呼ぶ

### T-6: Front — アプリフォーカス復帰時の解除

対応要件: F-3

- [x] `AppLayout.tsx` で `getCurrentWindow().onFocusChanged` を購読
- [x] `focused=true` を受けたら primary/secondary の現在アクティブなタブを走査し、`hasUnreadNotification` なら `clearUnread`
- [x] クリーンアップで unlisten

### T-7: Front — UI 表示と解除トリガー（クリック）

対応要件: F-2, F-3

- [x] `src/components/TerminalPanel/TerminalTabs.tsx` のタブ button に:
  - 未読時は背景を琥珀色（`rgba(245, 158, 11, 0.2)`）に合成
  - 未読時は `borderLeft` を琥珀色 2px
  - ラベル span の中で `●`（`rgb(245, 158, 11)` / `aria-hidden`）を prepend、ツールチップには含めない
- [x] `onClick` ハンドラで `setActiveTab` 後に `tab.hasUnreadNotification && document.hasFocus()` なら `clearUnread(tab.id)`
- [x] 編集中（`isEditing`）は従来どおり onClick を無効化（既存動作を維持）

### T-8: Front — ユニットテスト

対応要件: F-1, F-3, F-4

- [x] `terminalStore.test.ts` に以下を追加:
  - `markUnread`: 非アクティブタブに true / アクティブ+フォーカス時 no-op / 非フォーカス時は mark / 未知 pty_id no-op / 連続呼び出しで state 参照不変
  - `clearUnread`: true → false / もともと false で state 参照不変
  - テスト中は `document.hasFocus` を明示的にモック（JSDOM のデフォルトは false）
- [x] `npm run test` が 129 件全件パス

### T-9: 結合・テスト

対応要件: F-1 〜 F-5 通し

- [x] `npx tauri dev` で起動確認（ユーザー検証）
- [x] `testing.md` の手動テスト全件を実行（ユーザー検証）
- [x] Phase 1〜3 の挙動に回帰なし

### T-10: ドキュメント・マージ

- [ ] 永続化ドキュメント（`docs/steering/02_functional_design.md` 等）への反映要否を確認
- [ ] コミット（`docs:` / `feat:` 分割）
- [ ] Phase 1〜4 まとめて PR 化 → main にマージ
- [ ] リリース（`release: v0.2.x` のタグ付け）を検討

## 完了条件

- [x] 全実装タスク（T-1 〜 T-9）が完了
- [x] `npm run lint` がエラーなし（新規追加分）
- [x] `npm run test` がパス（129 件）
- [x] `cargo test` がパス（99 件）
- [x] `testing.md` の手動テストが全件 OK
- [x] Phase 1〜3 の挙動に回帰がない
- [x] 複数タブ運用での通知発火 → 復帰 → 該当タブ確認のフローが直感的に動作する

## 実装時の設計変更

- **未読マーク色の変更**: 当初設計ではアクセント色（`var(--color-accent)`）を 15% 合成する案だったが、実機で視認性が低く、アクティブタブのアクセント色と識別しづらかった。検討の結果、琥珀色（`rgb(245, 158, 11)` = Tailwind amber-500）に変更。「注意喚起」のメンタルモデルに合致し、アクティブタブの色軸と完全に分離できる。design.md と設計上の決定事項に反映済み。
