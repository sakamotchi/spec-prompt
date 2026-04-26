# タスクリスト - notification-click-activate

> 作業ブランチ: `feat/notification-click-activate`（main から派生）
> 関連 Issue: [#11](https://github.com/sakamotchi/sddesk/issues/11)

## 進捗サマリー

| 状態 | 件数 |
|------|------|
| 完了 | 0 |
| 進行中 | 0 |
| 未着手 | 7 |

## タスク一覧

### T-1: 要件定義・設計

- [x] requirements.md の作成
- [x] design.md の作成
- [ ] 設計レビュー（ユーザー確認）

### T-2: tauri-plugin-notification の API 調査

> design.md「未解決事項」を解消するための前提調査。実装着手前に完了させる。

- [ ] `tauri-plugin-notification` v2 の `Action` / `on_action` 系 API 対応状況を確認（Cargo doc / GitHub）
- [ ] 不足している場合は代替案を確定（`notify-rust` 乗り換え or PR 提出）
- [ ] 結論を design.md「未解決事項」に追記し、ユーザーへ報告
- [ ] macOS / Windows / Linux で必要となる権限・追加 capability を洗い出す

### T-3: バックエンド実装（Rust）

- [ ] `ClickTarget` / `NotificationClickTargets` 構造体追加 (`src-tauri/src/commands/notification.rs`)
- [ ] `is_app_focused` を `is_window_focused(label)` にリネーム + 呼び出し元修正
- [ ] `send_native_notification` に `target: Option<ClickTarget>` を追加
- [ ] `tauri::Builder::manage(NotificationClickTargets::default())` を追加 (`src-tauri/src/lib.rs`)
- [ ] `tauri-plugin-notification` の `on_action` ハンドラ配線（T-2 結論に応じて実装）
- [ ] OSC 9 通知発火箇所（`pty.rs:140-185`）で `window_label`（PTY を spawn したウィンドウのラベル）と `pty_id` を `target` に詰める
- [ ] `activate_target(app, target)` ヘルパー実装（unminimize → show → set_focus → emit_to）
- [ ] `cargo test` でユニットテストがパス
- [ ] `cargo check` でエラー・警告ゼロ

### T-4: フロントエンド実装（React/TypeScript）

- [ ] `tauriApi.ts` に `NotificationActivatePayload` 型と `onNotificationActivate` ヘルパーを追加
- [ ] `terminalStore.ts` に `findLocationByPtyId(ptyId)` セレクタを追加
- [ ] `AppLayout.tsx` で `onNotificationActivate` リスナーを登録
  - [ ] `findLocationByPtyId` で `(pane, tabId)` を解決
  - [ ] `terminalStore.setActiveTab(tabId, pane)` + `setFocusedPane(pane)`
  - [ ] `terminalStore.clearUnread(tabId)`
  - [ ] `appStore.activeMainTab !== 'terminal'` の場合は `setActiveMainTab('terminal')`
- [ ] Vitest でストアセレクタのユニットテスト追加
- [ ] `npm run lint` でエラーなし
- [ ] `npm run build` で TypeScript エラーなし

### T-5: 結合・テスト

- [ ] `npx tauri dev` で 1 ウィンドウ環境の動作確認（testing.md ケース 1）
- [ ] 複数ウィンドウ環境の動作確認（testing.md ケース 2）
- [ ] コンテンツモード→ターミナルモード切替の動作確認（ケース 3）
- [ ] 既存通知抑制ロジックの回帰確認（ケース 4）
- [ ] 未読マークの自動クリア動作確認（ケース 5）
- [ ] `cd src-tauri && cargo test` がパス
- [ ] macOS 実機での通知クリックテスト（ケース 1〜5 を網羅）
- [ ] Windows / Linux での best-effort 動作確認（プラットフォーム差異を testing.md に記録）

### T-6: ドキュメント更新

- [ ] `docs/steering/features/notification.md` を更新（`notification-activate` イベント、`ClickTarget` 構造体、複数ウィンドウ対応の `is_window_focused` を反映）
- [ ] `docs/steering/03_architecture_specifications.md` に新イベント追加（必要に応じて）
- [ ] testing.md の確認結果を埋める

### T-7: マージ・リリース

- [ ] コミット粒度ごとにユーザー承認を取りながら commit
- [ ] PR 作成（`feat/notification-click-activate` → `main`）
- [ ] レビュー対応
- [ ] PR マージ

## 完了条件

- [ ] 受け入れ条件（requirements.md F-1〜F-5）すべて満たす
- [ ] `npm run lint` がエラーなし
- [ ] `npm run build` が成功
- [ ] `cd src-tauri && cargo test` がパス
- [ ] testing.md の手動テスト全件 OK（macOS / Windows / Linux で確認結果記録）
- [ ] `docs/steering/features/notification.md` が更新済み
