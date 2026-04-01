# タスクリスト - Phase 2-F: プロジェクト管理

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

**WBSリファレンス**: Phase 2-F 準備作業

---

### T-2: Rust バックエンド実装

**WBSリファレンス**: 2-F-1

- [x] `src-tauri/src/commands/config.rs` を新規作成
  - [x] `Config` 構造体（`recent_projects: Vec<String>`, `Default` 実装）
  - [x] `load_config(app: AppHandle) -> Config`（内部ヘルパー）
  - [x] `save_config(app: AppHandle, config: Config) -> Result<(), String>`（内部ヘルパー）
  - [x] `#[tauri::command] get_recent_projects(app: AppHandle) -> Result<Vec<String>, String>`
  - [x] `#[tauri::command] add_recent_project(app: AppHandle, path: String) -> Result<(), String>`（重複除去・最大10件）
- [x] `src-tauri/src/lib.rs` に2コマンドを登録
- [x] Rust ユニットテストを作成（重複除去・最大10件・デフォルト値）
- [x] `cd src-tauri && cargo check` でエラーなし
- [x] `cd src-tauri && cargo test` でパス

**対象ファイル:**
- `src-tauri/src/commands/config.rs`（新規）
- `src-tauri/src/lib.rs`（変更）

---

### T-3: tauriApi.ts ラッパー追加

**WBSリファレンス**: 2-F-1, 2-F-2

- [x] `getRecentProjects(): Promise<string[]>` を追加
- [x] `addRecentProject(path: string): Promise<void>` を追加
- [x] `npm run lint` でエラーなし

**対象ファイル:**
- `src/lib/tauriApi.ts`（変更）

---

### T-4: appStore / contentStore 拡張

**WBSリファレンス**: 2-F-2, 2-F-3

- [x] `appStore` に `recentProjects: string[]` フィールドを追加
- [x] `appStore` に `setRecentProjects` アクションを追加
- [x] `appStore` に `switchProject(root: string)` アクションを追加（ツリー状態を一括リセット）
- [x] `contentStore` に `resetAllTabs()` アクションを追加（両ペインのタブを全クリア）
- [x] `npm run lint` でエラーなし

**対象ファイル:**
- `src/stores/appStore.ts`（変更）
- `src/stores/contentStore.ts`（変更）

---

### T-5: フロントエンド UI 実装

**WBSリファレンス**: 2-F-2, 2-F-3

- [x] `@radix-ui/react-dropdown-menu` をインストール
- [x] `RecentProjectsMenu.tsx` を新規作成
  - [x] Radix `DropdownMenu` でプロジェクト一覧を表示
  - [x] 現在のプロジェクトにチェックマーク
  - [x] 選択時に `switchProject` + `contentStore.resetAllTabs()` + `tauriApi.addRecentProject` を呼ぶ
- [x] `TreePanel.tsx` を修正
  - [x] 起動時に `getRecentProjects()` を取得し `setRecentProjects` に反映
  - [x] プロジェクトを新規に開いた際（`handleOpen`）に `addRecentProject` を呼ぶ
  - [x] ヘッダーのプロジェクト名を `RecentProjectsMenu` のトリガーに変更
- [x] `npm run lint` でエラーなし

**対象ファイル:**
- `src/components/TreePanel/RecentProjectsMenu.tsx`（新規）
- `src/components/TreePanel/TreePanel.tsx`（変更）

---

### T-6: 結合・手動テスト・マージ

- [x] `npx tauri dev` でアプリ起動確認
- [x] 手動テスト全項目 OK（testing.md 参照）
- [x] `npm run lint` がエラーなし
- [x] `cd src-tauri && cargo test` がパス
- [x] `feature/2-F-project-management` → `develop` へマージ

**ブランチ**: `feature/2-F-project-management`

---

## 完了条件

- [x] 全タスクが完了
- [x] `npm run lint` がエラーなし
- [x] `cd src-tauri && cargo test` がパス
- [x] 手動テスト（testing.md）が全件 OK
- [x] プロジェクトを開くと履歴に追加される
- [x] ヘッダーのプロジェクト名クリックで履歴ドロップダウンが表示される
- [x] 履歴からプロジェクトを選択するとツリーが切り替わる
- [x] 切り替え時にコンテンツタブがクリアされる
- [x] `develop` ブランチへのマージ済み
