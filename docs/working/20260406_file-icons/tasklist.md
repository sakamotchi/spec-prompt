# タスクリスト - Phase 3-D: 拡張子別ファイルアイコン

## 進捗サマリー

| 状態 | 件数 |
|------|------|
| 完了 | 3 |
| 進行中 | 0 |
| 未着手 | 0 |

## タスク一覧

### T-1: 要件定義・設計

- [x] 要件定義書の作成 (`requirements.md`)
- [x] 設計書の作成 (`design.md`)
- [x] レビュー完了

**WBSリファレンス**: Phase 3-D 準備作業

---

### T-2: パッケージ導入・アイコン実装（3-D-1）

**WBSリファレンス**: 3-D-1

- [x] `@iconify/react` と `@iconify-json/vscode-icons` をインストール
- [x] `TreeNode.tsx` に `EXT_ICON_MAP` / `FOLDER_ICON` / `FOLDER_OPEN_ICON` / `DEFAULT_FILE_ICON` 定数を追加
- [x] `FileIcon` コンポーネントを Iconify 版に書き換え
- [x] 不要になった Lucide アイコン（`Folder`, `FolderOpen`, `FileText`, `File`）のインポートを削除
- [x] `npm run lint` でエラーなし

**対象ファイル:**
- `package.json`（変更）
- `src/components/TreePanel/TreeNode.tsx`（変更）

---

### T-3: 動作確認・マージ

**WBSリファレンス**: 3-D-1

- [x] `npx tauri dev` でアプリ起動確認
- [x] 手動テスト全項目 OK（testing.md 参照）
- [x] `npm run lint` がエラーなし
- [x] `feature/3-D-file-icons` → `develop` へマージ

**ブランチ**: `feature/3-D-file-icons`

---

## 完了条件

- [x] 全タスクが完了
- [x] `npm run lint` がエラーなし
- [x] 手動テストが全件OK
- [x] 各拡張子のアイコンが正しく表示される
- [x] 対応外拡張子でデフォルトアイコンが表示される
- [x] フォルダの展開/折りたたみでアイコンが切り替わる
- [x] `develop` ブランチへのマージ済み
