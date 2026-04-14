# タスクリスト - manual-tab-rename（P3）

## 進捗サマリー

| 状態 | 件数 |
|------|------|
| 完了 | 9 |
| 進行中 | 0 |
| 未着手 | 1 |（T-10 マージのみ残）

## 前提

本フェーズは Phase 1 / Phase 2 の以下を前提とする:

- `TerminalTab` の `fallbackTitle` / `oscTitle` フィールドと `computeDisplayTitle` 関数（Phase 2）
- `setOscTitle` アクション（Phase 2）
- `AppLayout` での Zustand `subscribe` による Rust `DisplayTitleCache` 同期（Phase 2）
- `DisplayTitleCache` + `set_pty_display_title`（Phase 1）

Phase 1〜4 は同一ブランチ `feature/tab-title-and-notification` 上で進行する。

Rust 側の変更は **一切なし**（P2 で整備した同期経路がそのまま機能する）。

## タスク一覧

### T-1: 要件定義・設計

- [x] 要件定義書の作成（`requirements.md`）
- [x] 設計書の作成（`design.md`）
- [x] タスクリストの作成（`tasklist.md`）
- [x] テスト手順書の作成（`testing.md`）
- [x] ユーザーレビュー完了

### T-2: Front — 型拡張 & `computeDisplayTitle` 拡張

対応要件: F-1

- [x] `src/stores/terminalStore.ts` の `TerminalTab` に `manualTitle: string | null` と `pinned: boolean` を追加
- [x] `makeTab` の初期化で `manualTitle: null` / `pinned: false` を設定
- [x] `computeDisplayTitle` を 3 段優先順位（`pinned + manualTitle > oscTitle > fallbackTitle`）に変更
- [x] 型エラーなし（`npx tsc --noEmit`）

### T-3: Front — `renameTab` / `unpinTab` アクション

対応要件: F-1, F-4

- [x] `TerminalState` に `renameTab(tabId, title)` を追加
  - trimmed が空文字なら no-op（呼び出し側で `unpinTab` に振り分け）
  - `pinned=true, manualTitle=trimmed` に更新
  - 同一値なら state 参照を保持（早期 return）
- [x] `TerminalState` に `unpinTab(tabId)` を追加
  - `pinned=false, manualTitle=null` に戻す
  - 同一値なら state 参照を保持
- [x] primary / secondary 両ペインを走査する

### T-4: Front — 新規 `TabInlineRenameInput` コンポーネント

対応要件: F-2

- [x] `src/components/TerminalPanel/TabInlineRenameInput.tsx` を新規作成
- [x] `defaultValue` / `onCommit` / `onCancel` Props
- [x] mount 時に `input.focus()` + `input.select()`（setTimeout 50ms で Radix ポータル後）
- [x] Enter 確定 / Escape キャンセル / blur 確定
- [x] `onClick` / `onDoubleClick` / `onMouseDown` を `stopPropagation` してタブ選択・再編集を抑止
- [x] `max-w-[12rem] min-w-[80px]` で横幅制限

### T-5: Front — 新規 `TabContextMenu` コンポーネント

対応要件: F-3

- [x] `src/components/TerminalPanel/TabContextMenu.tsx` を新規作成
- [x] `@radix-ui/react-context-menu` を使用（既存 `TreeContextMenu` のスタイルを踏襲）
- [x] メニュー項目:
  - `Pencil` + 「タブ名を変更」 → `onRename()`
  - `RotateCcw` + 「自動タイトルに戻す」 → `onUnpin()`（`pinned=false` のとき disabled）
  - セパレータ
  - `X` + 「タブを閉じる」 → `onClose()`（`canClose=false` のとき disabled）
- [x] i18n キー: `terminal.tabMenu.rename` / `unpinTitle` / `close`

### T-6: Front — i18n 文言追加

対応要件: F-3

- [x] `src/i18n/locales/ja.json` に `terminal.tabMenu.*` の 3 文言を追加
- [x] `src/i18n/locales/en.json` に同じキーの英語訳を追加
- [x] 既存の `contextMenu.*` と名前衝突していないことを確認（別階層 `terminal.tabMenu`）

### T-7: Front — `TerminalTabs.tsx` 統合

対応要件: F-2, F-3, F-4

- [x] `TerminalPane` に `editingTabId: string | null` のローカル state を追加
- [x] 各タブを `<TabContextMenu>` でラップ
- [x] タブ button に `onDoubleClick={() => setEditingTabId(tab.id)}` を追加
- [x] 編集中は `draggable={false}`、`onClick` / `onDragStart` を無効化、`cursor-text` スタイル
- [x] `isEditing` なら `<span>` の代わりに `<TabInlineRenameInput>` を描画
- [x] 編集中は × ボタンを非表示
- [x] `commitRename(tabId, title)` ヘルパー: 空文字 → `unpinTab`、それ以外 → `renameTab`、最後に `setEditingTabId(null)`

### T-8: Front — ユニットテスト

対応要件: F-1, F-4

- [x] `terminalStore.test.ts` に以下を追加:
  - `computeDisplayTitle` 3 段優先順位のテスト 5 件
  - `renameTab`: 通常のトリム / 空文字 no-op / 同一値で state 不変 / 未知の tabId
  - `unpinTab`: pinned=true → false・manualTitle クリア / もともと unpin で state 不変
  - `pinned` と `setOscTitle` の共存 / unpin 後 oscTitle 即時表示
- [x] 既存テストの `makeTab` ヘルパーを新型に合わせて更新
- [x] `npm run test` が 122 件全件パス

### T-9: 結合・テスト

対応要件: F-1 〜 F-5 通し

- [x] `npx tauri dev` で起動確認（ユーザー検証）
- [x] `testing.md` の手動テスト全件を実行（ユーザー検証）
- [x] P1・P2 の挙動に回帰がないこと（通知タイトル・OSC 自動更新）
- [x] Rust テスト（`cargo test`）が全件パス（99 件、変更なし）

### T-10: ドキュメント・マージ

- [ ] 永続化ドキュメント（`docs/steering/02_functional_design.md` 等）への反映要否を確認
- [ ] コミット（`docs:` と `feat:` に分割）
- [ ] P4 実装へ接続 or 一旦 PR 化してマージ

## 完了条件

- [x] 全実装タスク（T-1 〜 T-9）が完了
- [x] `npm run lint` がエラーなし（新規追加分）
- [x] `npm run test` がパス（122 件）
- [x] `cargo test` がパス（99 件、Rust 変更なし）
- [x] `testing.md` の手動テストが全件 OK
- [x] P1/P2 の挙動に回帰がない
- [x] Phase 4（未読マーク）の実装時に `TerminalTab` の構造変更が不要な状態（`hasUnreadNotification` を 1 フィールド追加するだけ）
