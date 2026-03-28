# タスクリスト - Phase 1-B: ファイルツリー（TreePanel）

## 進捗サマリー

| 状態 | 件数 |
|------|------|
| 完了 | 6 |
| 進行中 | 0 |
| 未着手 | 0 |

## タスク一覧

### T-1: 要件定義・設計

- [x] 要件定義書の作成 (`requirements.md`)
- [x] 設計書の作成 (`design.md`)
- [x] レビュー完了

**WBSリファレンス**: Phase 1-B 準備作業

---

### T-2: `filesystem.rs` 補完 + `@tauri-apps/plugin-dialog` 登録確認

**WBSリファレンス**: 1-B-1（一部）

- [x] `filesystem.rs` の除外ロジックをすべて削除（隠しファイル含め全表示に変更）
- [x] `src-tauri/src/lib.rs` に `tauri_plugin_dialog` が登録されていることを確認済み
- [x] `cd src-tauri && cargo check` でエラーなし

**対象ファイル**:
- `src-tauri/src/commands/filesystem.rs`
- `src-tauri/src/lib.rs`（確認のみ）

---

### T-3: `appStore` 拡張

**WBSリファレンス**: 1-B-4（一部）、1-D-1（続き）

- [x] `src/stores/appStore.ts` に `projectRoot`, `fileTree`, `selectedFile`, `expandedDirs` を追加
- [x] `setProjectRoot`, `setFileTree`, `setSelectedFile`, `toggleExpandedDir` アクションを実装
- [x] `npm run lint` でエラーなし
- [x] appStore のユニットテストに `toggleExpandedDir` のケースを追加

**対象ファイル**:
- `src/stores/appStore.ts`
- `src/stores/appStore.test.ts`

---

### T-4: `useFileTree` フック + `tauriApi` 拡張

**WBSリファレンス**: 1-B-1, 1-B-3

- [x] `@tauri-apps/plugin-dialog` を npm install
- [x] `src/lib/tauriApi.ts` に `openFolderDialog` を追加
- [x] `src/hooks/useFileTree.ts` を作成
  - [x] `projectRoot` が変わると `readDir` を呼び出す
  - [x] `loading` / `error` 状態を返す
- [x] `npm run lint` でエラーなし

**対象ファイル**:
- `src/lib/tauriApi.ts`
- `src/hooks/useFileTree.ts`

---

### T-5: `TreePanel` / `TreeNode` コンポーネント実装

**WBSリファレンス**: 1-B-2, 1-B-3, 1-B-4

- [x] `src/components/TreePanel/TreeNode.tsx` を作成
  - [x] ディレクトリ: ChevronRight/Down + Folder/FolderOpen アイコン + 名前
  - [x] ファイル: FileText/File アイコン + 名前
  - [x] クリックで `toggleExpandedDir` / `setSelectedFile` を呼ぶ
  - [x] 選択ファイルのハイライト（左ボーダー + 背景色）
  - [x] `React.memo` でラップ
- [x] `src/components/TreePanel/TreePanel.tsx` を作成
  - [x] ヘッダー（プロジェクト名 + 「開く」ボタン）
  - [x] `openFolderDialog` で `setProjectRoot` を更新
  - [x] `useFileTree` フックを使ってツリーを取得・表示
  - [x] ローディングスピナー / エラーメッセージ表示
- [x] `src/components/TreePanel/index.ts` を作成
- [x] `src/components/Layout/AppLayout.tsx` の `TreePanelPlaceholder` を `TreePanel` に置き換え
- [x] `npm run lint` でエラーなし

**対象ファイル**:
- `src/components/TreePanel/TreeNode.tsx`
- `src/components/TreePanel/TreePanel.tsx`
- `src/components/TreePanel/index.ts`
- `src/components/Layout/AppLayout.tsx`

---

### T-6: 結合・手動テスト・マージ

- [x] `npx tauri dev` でアプリ起動確認
- [x] 手動テスト全項目 OK（testing.md 参照）
- [x] `npm run test` がパス（7テスト）
- [x] `npm run lint` がエラーなし
- [x] `feature/1-B-file-tree` → `develop` へマージ

**ブランチ**: `feature/1-B-file-tree`

---

## 完了条件

- [x] 全タスクが完了
- [x] `npm run lint` がエラーなし
- [x] `npm run test` がパス
- [x] `cd src-tauri && cargo check` がパス
- [x] 手動テスト（testing.md）が全件 OK
- [x] `npx tauri dev` でプロジェクトを開き、ファイルツリーが表示・操作できる
- [x] `develop` ブランチへのPRがマージ済み
