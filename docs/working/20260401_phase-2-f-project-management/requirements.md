# 要件定義書 - Phase 2-F: プロジェクト管理

## 概要

SpecPrompt で複数のプロジェクト（フォルダ）を快適に切り替えられるよう、Config Manager と最近開いたプロジェクト履歴機能を実装する。

## 背景・目的

現状、アプリ起動のたびに「フォルダを開く」ダイアログから目的のプロジェクトを選び直す必要がある。
仕様書駆動開発では複数リポジトリを行き来することが多く、プロジェクト切り替えのコストを最小化することがUX向上に直結する。

また設定（パス形式の相対/絶対）は現状 localStorage のみに保存されており、ネイティブの設定ファイルとして永続化する基盤が存在しない。Config Manager はこれを解消し、将来のテーマ・フォント設定の受け皿となる。

## 要件一覧

### 機能要件

#### F-1: Config Manager（設定ファイルの読み書き）

- **説明**: `~/.config/spec-prompt/config.json` を Rust 側で読み書きする。
- **受け入れ条件**:
  - [ ] アプリ起動時に設定ファイルが存在すれば読み込む
  - [ ] ファイルが存在しない場合はデフォルト値で初期化し、ファイルを作成する
  - [ ] `recent_projects`（最大10件）を保持する
  - [ ] JSON の読み書きに失敗した場合はエラーを返す（アプリをクラッシュさせない）

#### F-2: 最近開いたプロジェクト履歴

- **説明**: プロジェクトを開くたびにパスを履歴に追加し、ツリーパネルのヘッダーからリスト表示・選択できる。
- **受け入れ条件**:
  - [ ] プロジェクトを開くと `recent_projects` の先頭に追加される（重複除去・最大10件）
  - [ ] ツリーパネルのプロジェクト名をクリックするとドロップダウンに履歴が表示される
  - [ ] 履歴からプロジェクトを選択するとそのプロジェクトに切り替わる
  - [ ] 存在しないパスが履歴にある場合はグレーアウト表示するか無視する（実装時に判断）

#### F-3: プロジェクト切り替え

- **説明**: 別のプロジェクトを開く際、ツリー・コンテンツの状態をリセットしてから新プロジェクトをロードする。
- **受け入れ条件**:
  - [ ] 切り替え時に `fileTree`, `expandedDirs`, `selectedFile`, `selectedFiles`, `editingState`, `creatingState` をリセットする
  - [ ] 切り替え時にコンテンツタブを全て閉じる（`contentStore` のタブリセット）
  - [ ] 新プロジェクトのルートディレクトリを `fileTree` に読み込む
  - [ ] ターミナルセッションはリセットしない（別プロジェクトでも継続利用できる）

### 非機能要件

- **パフォーマンス**: 設定ファイルの読み書きは起動時 / プロジェクト切り替え時のみ。通常操作に影響しない。
- **ユーザビリティ**: プロジェクト名クリック → ドロップダウン表示 → 選択 の3ステップで切り替え完了。
- **保守性**: Config 構造体は将来のテーマ・フォント設定を追加しやすい設計にする。
- **外観・デザイン**: ドロップダウンは既存の CSS カスタムプロパティ（`--color-bg-elevated`, `--color-border`, `--color-accent` 等）を使用。Radix UI `DropdownMenu` でアクセシビリティ対応。

## スコープ

### 対象

- Config Manager（Rust）: `load_config`, `save_config`, `add_recent_project`, `get_recent_projects`
- `appStore` への `recentProjects` 追加と `switchProject` アクション
- `TreePanel` ヘッダーの最近のプロジェクトドロップダウン UI
- プロジェクト切り替え時の状態リセット処理

### 対象外

- テーマ・フォント設定の実際の実装（Config 構造体の受け皿のみ用意）
- ターミナルセッションのリセット
- Windows / Linux の設定パス対応（macOS優先、`tauri::api::path::config_dir()` を使用）

## 実装対象ファイル（予定）

- `src-tauri/src/commands/config.rs`（新規）
- `src-tauri/src/lib.rs`（変更）
- `src/lib/tauriApi.ts`（変更）
- `src/stores/appStore.ts`（変更）
- `src/stores/contentStore.ts`（変更：プロジェクト切り替え時の全タブクローズ）
- `src/components/TreePanel/TreePanel.tsx`（変更）
- `src/components/TreePanel/RecentProjectsMenu.tsx`（新規）

## 依存関係

- Phase 1-B: ファイルツリー（`setProjectRoot`, `useFileTree`）
- Phase 2-E: ファイル操作（`contentStore.closeTabByPath` を流用）

## 既知の制約

- `tauri::api::path::config_dir()` は Tauri v2 では `app_handle.path().config_dir()` に変更されている
- `serde_json` は `Cargo.toml` にすでに存在するため追加不要

## 参考資料

- `docs/steering/03_architecture_specifications.md` — Config コマンド設計
- `docs/local/20260328-初期開発ドキュメント/02_設計書.md`
