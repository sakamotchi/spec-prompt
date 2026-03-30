# タスクリスト - Phase 2-B: ファイル監視・自動更新

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

**WBSリファレンス**: Phase 2-B 準備作業

---

### T-2: `watcher.rs` 実装（バックエンド）

**WBSリファレンス**: 2-B-1

- [x] `src-tauri/src/commands/filesystem.rs` を非再帰に変更（遅延読み込み対応）
- [x] `src-tauri/Cargo.toml` に `tauri-plugin-fs` の `watch` feature を追加
- [x] `cargo check` でエラーなし

**対象ファイル:**
- `src-tauri/src/commands/filesystem.rs`（変更）
- `src-tauri/Cargo.toml`（変更）

---

### T-3: コンテンツビューア自動更新（フロントエンド）

**WBSリファレンス**: 2-B-2

- [x] `ContentView.tsx` に `@tauri-apps/plugin-fs` の `watch()` を追加
  - `filePath` を ref で管理し、ファイル切替のたびに watch を再登録しない
  - アンマウント時にリスナーを解除（`unlisten`）
- [x] `npm run lint` でエラーなし

**対象ファイル:**
- `src/components/ContentView/ContentView.tsx`（変更）

---

### T-4: ファイルツリー自動更新（フロントエンド）

**WBSリファレンス**: 2-B-3

- [x] `useFileTree.ts` に `watch()` を追加（変更があった親ディレクトリのみ更新）
- [x] `appStore.ts` に `updateDirChildren` アクションを追加
- [x] `TreeNode.tsx` を遅延読み込み対応に変更（展開時にその階層だけ readDir）
- [x] `src-tauri/capabilities/default.json` に watch スコープを追加
- [x] `npm run lint` でエラーなし

**対象ファイル:**
- `src/hooks/useFileTree.ts`（変更）
- `src/stores/appStore.ts`（変更）
- `src/components/TreePanel/TreeNode.tsx`（変更）
- `src/lib/tauriApi.ts`（変更）
- `src-tauri/capabilities/default.json`（変更）

---

### T-5: 結合・手動テスト・マージ

- [x] `npx tauri dev` でアプリ起動確認
- [x] 手動テスト全項目 OK（testing.md 参照）
- [x] `npm run lint` がエラーなし
- [x] `feature/2-B-file-watcher` → `develop` へマージ

**ブランチ**: `feature/2-B-file-watcher`

---

## 完了条件

- [x] 全タスクが完了
- [x] `npm run lint` がエラーなし
- [x] 手動テスト（testing.md）が全件 OK
- [x] 外部エディタでファイルを保存するとコンテンツビューアが自動更新される
- [x] ファイル追加・削除でファイルツリーが自動更新される
- [x] `develop` ブランチへのマージ済み
