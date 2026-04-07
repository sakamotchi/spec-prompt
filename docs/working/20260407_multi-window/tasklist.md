# タスクリスト - Phase 3-G: 複数ウィンドウ表示

## 進捗サマリー

| 状態 | 件数 |
|------|------|
| 完了 | 5 |
| 進行中 | 0 |
| 未着手 | 0 |

## タスク一覧

### T-1: 要件定義・設計

- [x] 要件定義書の作成 (`requirements.md`)
- [x] 設計書の作成 (`design.md`)
- [x] レビュー完了

**WBSリファレンス**: Phase 3-G 準備作業

---

### T-2: i18n キー追加（3-G 前提）

**WBSリファレンス**: Phase 3-F 拡張

- [x] `src/i18n/locales/ja.json` に `tree.tooltip.newWindow` と `contextMenu.openInNewWindow` を追加
- [x] `src/i18n/locales/en.json` に対応する英語キーを追加
- [x] Phase 3-F 翻訳漏れ（`ContentView.tsx` の `content.loading` / `content.empty`）も合わせて修正
- [x] `npm run lint` でエラーなし

**対象ファイル:**
- `src/i18n/locales/ja.json`（変更）
- `src/i18n/locales/en.json`（変更）
- `src/components/ContentView/ContentView.tsx`（変更 — 翻訳漏れ修正）

---

### T-3: 新規ウィンドウ起動 API と起動時パラメータ読み取り（3-G-1, 3-G-2）

**WBSリファレンス**: 3-G-1, 3-G-2

- [x] `src/lib/tauriApi.ts` に `openNewWindow(projectPath?: string)` を実装
- [x] `@tauri-apps/api/webviewWindow` の import パスを現バージョンで確認（v2 — 問題なし）
- [x] `src/main.tsx` に URL クエリパラメータ読み取り処理を追加（`?project=...` / `?new=1`）
- [x] 空ウィンドウ起動時（`?new=1`）は `useAppStore.setState` で `projectRoot` をクリア
- [x] `src-tauri/capabilities/default.json` に `core:window:allow-create` / `core:window:allow-set-title` / `core:webview:allow-create-webview-window` を追加
- [x] `npm run lint` でエラーなし

**対象ファイル:**
- `src/lib/tauriApi.ts`（変更）
- `src/main.tsx`（変更）
- `src-tauri/capabilities/default.json`（変更）

---

### T-4: UI 追加 — コンテキストメニュー・ツールバー・タイトル（3-G-4, 3-G-5）

**WBSリファレンス**: 3-G-4, 3-G-5

- [x] `src/components/TreePanel/ContextMenu.tsx` に「新規ウィンドウで開く」を追加（フォルダ対象）
- [x] `src/components/TreePanel/TreeNode.tsx` に `handleOpenNewWindow` を実装し ContextMenu に渡す
- [x] `src/components/TreePanel/TreePanel.tsx` ツールバーに新規ウィンドウボタンを追加（常時表示・空ウィンドウ起動）
- [x] `src/components/TreePanel/TreePanel.tsx` に `getCurrentWindow().setTitle()` でウィンドウタイトル更新を追加
- [x] `npm run lint` でエラーなし

**対象ファイル:**
- `src/components/TreePanel/ContextMenu.tsx`（変更）
- `src/components/TreePanel/TreeNode.tsx`（変更）
- `src/components/TreePanel/TreePanel.tsx`（変更）

---

### T-5: 動作確認

**WBSリファレンス**: 3-G-3

- [x] `npx tauri dev` でアプリ起動確認
- [x] 手動テスト全項目 OK（testing.md 参照）
- [x] `npm run lint` がエラーなし

**ブランチ**: `feature/3-G-multi-window`

---

## 完了条件

- [x] 全タスクが完了
- [x] `npm run lint` がエラーなし
- [x] 手動テストが全件 OK
- [x] フォルダ右クリック → 新規ウィンドウで指定フォルダが開く
- [x] ウィンドウタイトルにプロジェクト名が表示される
- [x] 各ウィンドウの状態（タブ・ターミナル）が独立している
- [ ] `develop` ブランチへのマージ済み
