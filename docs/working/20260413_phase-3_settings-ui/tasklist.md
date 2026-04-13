# タスクリスト - Phase 3: 設定 UI + 仕上げ

## 進捗サマリー

| 状態 | 件数 |
|------|------|
| 完了 | 0 |
| 進行中 | 0 |
| 未着手 | 4 |

## タスク一覧

### T-1: appStore に notificationEnabled 追加

- [ ] `notificationEnabled: boolean` フィールドを追加（デフォルト: `true`）
- [ ] `setNotificationEnabled` アクションを追加
- [ ] persist の partialize に含める
- [ ] 既存の localStorage とのマイグレーション確認

### T-2: 設定画面にトグル追加

- [ ] Settings.tsx に通知トグルセクションを追加
- [ ] 既存の設定画面スタイルに統一
- [ ] トグル操作で状態が即座に反映されることを確認

### T-3: spawn_pty に notification_enabled 引数追加

- [ ] `pty.rs` の `spawn_pty` に `notification_enabled: bool` 引数を追加
- [ ] `notification_enabled` が `true` の場合のみ環境変数を設定
- [ ] フロントエンドの `spawn_pty` 呼び出し元をすべて更新
- [ ] `tauriApi.ts` の型定義を更新
- [ ] `cargo check` でエラーなし
- [ ] `npm run build` でエラーなし

### T-4: テスト・仕上げ

- [ ] 通知 ON で claude を起動 → 通知が表示される
- [ ] 通知 OFF で claude を起動 → 通知が表示されない
- [ ] 設定を変更してアプリ再起動 → 設定が維持される
- [ ] 通知分類のユニットテスト追加・確認
- [ ] `cargo test` 全件パス
- [ ] 回帰テスト（ファイルツリー、ターミナル、コンテンツビューア）

## 完了条件

- [ ] 全タスクが完了
- [ ] `npm run lint` がエラーなし
- [ ] `npm run build` がエラーなし
- [ ] `cargo check` がエラーなし
- [ ] `cargo test` がパス
- [ ] 手動テストが全件 OK
