# タスクリスト - Phase 2-E: ファイル操作

## 進捗サマリー

| 状態 | 件数 |
|------|------|
| 完了 | 7 |
| 進行中 | 0 |
| 未着手 | 0 |

## タスク一覧

### T-1: 要件定義・設計

- [x] 要件定義書の作成 (`requirements.md`)
- [x] 設計書の作成 (`design.md`)
- [x] レビュー完了

**WBSリファレンス**: Phase 2-E 準備作業

---

### T-2: Rust バックエンド実装

**WBSリファレンス**: 2-E-1〜2-E-4

- [x] `src-tauri/Cargo.toml` に `tempfile` を dev-dependencies に追加
- [x] `src-tauri/capabilities/default.json` の `fs:write-all` 権限を確認
- [x] `filesystem.rs` に `create_file` コマンドを実装
- [x] `filesystem.rs` に `create_dir` コマンドを実装
- [x] `filesystem.rs` に `rename_path` コマンドを実装
- [x] `filesystem.rs` に `delete_path` コマンドを実装（再帰削除対応）
- [x] `filesystem.rs` に `open_in_editor` コマンドを実装（`tauri-plugin-opener` 使用）
- [x] `capabilities/default.json` に `opener:default` 権限を確認・追加
- [x] `lib.rs` に 5 コマンドを登録
- [x] Rust テストを作成（design.md 参照）
- [x] `cd src-tauri && cargo check` でエラーなし
- [x] `cd src-tauri && cargo test` でパス

**対象ファイル:**
- `src-tauri/src/commands/filesystem.rs`（変更）
- `src-tauri/src/lib.rs`（変更）
- `src-tauri/Cargo.toml`（変更）

---

### T-3: tauriApi.ts ラッパー追加

**WBSリファレンス**: 2-E-1〜2-E-5

- [x] `tauriApi.ts` に `createFile`, `createDir`, `renamePath`, `deletePath`, `openInEditor` を追加
- [x] `npm run lint` でエラーなし

**対象ファイル:**
- `src/lib/tauriApi.ts`（変更）

---

### T-4: appStore 拡張

**WBSリファレンス**: 2-E-1〜2-E-4

- [x] `editingState`, `creatingState` フィールドを追加
- [x] `setEditingState`, `setCreatingState` アクションを追加
- [x] `contentStore` に `renameTabPath(oldPath, closePath)` アクションを追加
- [x] `npm run lint` でエラーなし

**対象ファイル:**
- `src/stores/appStore.ts`（変更）
- `src/stores/contentStore.ts`（変更）

---

### T-5: フロントエンド UI 実装

**WBSリファレンス**: 2-E-1〜2-E-4

- [x] `@radix-ui/react-alert-dialog` をインストール
- [x] `InlineInput.tsx` を新規作成（design.md 参照）
- [x] `DeleteDialog.tsx` を新規作成（design.md 参照）
- [x] `ContextMenu.tsx` にメニュー項目を追加（新規ファイル・フォルダ、外部エディタで開く、リネーム、削除）
- [x] `TreeNode.tsx` にインライン入力表示ロジックを追加
  - `creatingState` が自分の親パスを指している場合に `InlineInput` を表示
  - `editingState` が自分のパスを指している場合に `InlineInput` を表示
  - F2 キーでリネーム開始
- [x] 各操作完了後にツリーを再読み込み（`tauriApi.readDir` → `updateDirChildren`）
- [x] `npm run lint` でエラーなし

**対象ファイル:**
- `src/components/TreePanel/InlineInput.tsx`（新規）
- `src/components/TreePanel/DeleteDialog.tsx`（新規）
- `src/components/TreePanel/ContextMenu.tsx`（変更）
- `src/components/TreePanel/TreeNode.tsx`（変更）

---

### T-6: contentStore 連携

**WBSリファレンス**: 2-E-3, 2-E-4

- [x] 削除時に `contentStore` の対象パスのタブを閉じる
- [x] リネーム時に `contentStore` の対象パスを新パスに更新する
- [x] `appStore.selectedFile` がリネーム/削除対象の場合にリセットする
- [x] 手動テストで確認

**対象ファイル:**
- `src/components/TreePanel/TreeNode.tsx`（変更）

---

### T-7: 結合・手動テスト・マージ

- [x] `npx tauri dev` でアプリ起動確認
- [x] 手動テスト全項目 OK（testing.md 参照）
- [x] `npm run lint` がエラーなし
- [x] `cd src-tauri && cargo test` がパス
- [x] `feature/2-E-file-operations` → `develop` へマージ

**ブランチ**: `feature/2-E-file-operations`

---

## 完了条件

- [x] 全タスクが完了
- [x] `npm run lint` がエラーなし
- [x] `cd src-tauri && cargo test` がパス
- [x] 手動テスト（testing.md）が全件 OK
- [x] ファイル新規作成・フォルダ新規作成が動作する
- [x] リネームが動作する（コンテンツタブのタイトル同期含む）
- [x] 削除が確認ダイアログ付きで動作する（開いているタブが閉じる）
- [x] 外部エディタで開くが動作する（OS デフォルトアプリが起動する）
- [x] `develop` ブランチへのマージ済み
