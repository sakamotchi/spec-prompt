# タスクリスト - タブ一括クローズアクション

## 進捗サマリー

| 状態 | 件数 |
|------|------|
| 完了 | 0 |
| 進行中 | 0 |
| 未着手 | 6 |

## タスク一覧

### T-1: 要件定義・設計

- [x] 要件定義書の作成（`requirements.md`）
- [x] 設計書の作成（`design.md`）
- [ ] 設計レビュー（ユーザー確認）

### T-2: i18n キー追加

- [ ] `src/i18n/locales/ja.json` に以下を追加
  - `content.tabMenu.close`（「タブを閉じる」）
  - `content.tabMenu.closeAll`（「すべてのタブを閉じる」）
  - `content.tabMenu.closeOthers`（「その他のタブを閉じる」）
  - `content.tabMenu.closeToRight`（「右側のタブを閉じる」）
  - `terminal.tabMenu.closeAll`
  - `terminal.tabMenu.closeOthers`
  - `terminal.tabMenu.closeToRight`
- [ ] `src/i18n/locales/en.json` に同じキーを英訳で追加
- [ ] `npm run lint` がパス

### T-3: ストアアクション追加（フロントエンド）

- [ ] `src/stores/contentStore.ts` に `closeAllTabs` / `closeOtherTabs` / `closeTabsToRight` を追加
- [ ] `src/stores/contentStore.test.ts` に新規アクションのユニットテストを追加
- [ ] `src/stores/terminalStore.ts` に同 3 アクションを追加（PTY 終了通知付き）
- [ ] `src/stores/terminalStore.test.ts` に新規アクションのユニットテストを追加
- [ ] `npm run test -- contentStore terminalStore` がパス

### T-4: コンテンツタブ コンテキストメニュー新設（フロントエンド）

- [ ] `src/components/ContentView/ContentTabContextMenu.tsx` を新規作成
- [ ] `src/components/ContentView/ContentTabBar.tsx` で各タブを `<ContentTabContextMenu>` でラップ
- [ ] 「右側のタブを閉じる」が最右端タブで disabled になることを実機確認
- [ ] 既存 D&D（タブ移動）に影響しないことを実機確認
- [ ] `npm run lint` がパス

### T-5: ターミナルタブ コンテキストメニュー拡張（フロントエンド）

- [ ] `src/components/TerminalPanel/TabContextMenu.tsx` にメニュー項目 3 つを追加
- [ ] `src/components/TerminalPanel/TerminalTabs.tsx` で新ハンドラを配線
- [ ] 一括クローズ後に PTY が確実に終了することを実機確認
- [ ] プロンプトパレットを開いていたタブを一括クローズで閉じた際、パレットが閉じることを確認
- [ ] `npm run lint` がパス

### T-6: 結合・テスト

- [ ] `npx tauri dev` で起動して `testing.md` の手動テストを全件実施
- [ ] 分割ペイン状態でも正常動作することを確認
- [ ] `cd src-tauri && cargo check`（バックエンド変更なしの確認）
- [ ] 回帰テスト（`testing.md` 末尾）を実施

### T-7: ドキュメント・マージ

- [ ] 永続化ドキュメント更新の要否を判断
  - `docs/steering/features/terminal.md` への追記要否
  - `docs/steering/features/content-viewer.md` への追記要否
- [ ] PR 作成（`feat/tab-close-actions` → `develop`）
- [ ] コードレビュー
- [ ] `develop` ブランチへのマージ

## 完了条件

- [ ] 全タスクが完了
- [ ] `npm run lint` がエラーなし
- [ ] `npm run test` がパス
- [ ] `cd src-tauri && cargo check` が通る
- [ ] `testing.md` の手動テストが全件 OK
- [ ] 永続化ドキュメントが更新済み（必要な場合のみ）
