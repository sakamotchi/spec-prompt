# タスクリスト - Phase 3-A: ドキュメントステータス管理

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

**WBSリファレンス**: Phase 3-A 準備作業

---

### T-2: Rust バックエンド実装

**WBSリファレンス**: 3-A-3

- [x] `filesystem.rs` に `write_file` コマンドを追加
- [x] `lib.rs` に `write_file` を登録
- [x] Rust テストを追加（`write_file` の正常系・上書き）
- [x] `cd src-tauri && cargo check` でエラーなし
- [x] `cd src-tauri && cargo test` でパス

**対象ファイル:**
- `src-tauri/src/commands/filesystem.rs`（変更）
- `src-tauri/src/lib.rs`（変更）

---

### T-3: フロントマターユーティリティ + tauriApi

**WBSリファレンス**: 3-A-1

- [x] `src/lib/frontmatter.ts` を新規作成
  - [x] `DocStatus` 型（`'draft' | 'reviewing' | 'approved'`）
  - [x] `DOC_STATUS_LABEL` / `DOC_STATUS_COLOR` 定数
  - [x] `parseStatus(content: string): DocStatus | null`
  - [x] `setStatus(content: string, status: DocStatus): string`
- [x] `tauriApi.ts` に `writeFile(path, content)` を追加
- [x] `remark-frontmatter` を追加してマークダウンプレビューからフロントマターを除去
- [x] `npm run lint` でエラーなし

**対象ファイル:**
- `src/lib/frontmatter.ts`（新規）
- `src/lib/tauriApi.ts`（変更）
- `src/lib/markdown.ts`（変更）

---

### T-4: appStore 拡張

**WBSリファレンス**: 3-A-1, 3-A-2

- [x] `docStatuses: Record<string, DocStatus | null>` を追加
- [x] `setDocStatus(path, status)` アクションを追加
- [x] `loadDocStatuses(paths: string[])` アクションを追加（非同期・並列読み込み）
- [x] `switchProject` 時に `docStatuses: {}` もリセット
- [x] `npm run lint` でエラーなし

**対象ファイル:**
- `src/stores/appStore.ts`（変更）

---

### T-5: フロントエンド UI 実装

**WBSリファレンス**: 3-A-2, 3-A-3

- [x] `TreeNode.tsx` にステータスバッジを追加（MD/MDX のみ）
- [x] `TreeNode.tsx` でディレクトリ展開・リロード時に `loadDocStatuses` を呼ぶ
- [x] `TreeNode.tsx` でファイルクリック時にも `loadDocStatuses` を呼ぶ（外部作成ファイル対応）
- [x] `ContextMenu.tsx` に `StatusSubMenu` を追加（MD/MDX のみ表示）
- [x] 草稿 / レビュー中 / 承認済 の3項目・現在のステータスにチェックマーク
- [x] 選択時に `read_file` → `setStatus` → `write_file` → `setDocStatus` を実行
- [x] `npm run lint` でエラーなし

**対象ファイル:**
- `src/components/TreePanel/TreeNode.tsx`（変更）
- `src/components/TreePanel/ContextMenu.tsx`（変更）

---

### T-6: 結合・手動テスト・マージ

- [x] `npx tauri dev` でアプリ起動確認
- [x] 手動テスト全項目 OK（testing.md 参照）
- [x] `npm run lint` がエラーなし
- [x] `cd src-tauri && cargo test` がパス
- [x] `feature/3-A-doc-status` → `develop` へマージ

**ブランチ**: `feature/3-A-doc-status`

---

## 完了条件

- [x] 全タスクが完了
- [x] `npm run lint` がエラーなし
- [x] `cd src-tauri && cargo test` がパス
- [x] 手動テスト（testing.md）が全件 OK
- [x] MD ファイルにステータスバッジが表示される
- [x] コンテキストメニューからステータスを変更できる
- [x] 変更がファイルに書き戻される（フロントマター更新）
- [x] マークダウンプレビューにフロントマターが表示されない
- [x] `develop` ブランチへのマージ済み
