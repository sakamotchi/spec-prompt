# 要件定義書 - Phase 4-C: CI/CD（GitHub Actions）

## 概要

GitHub Actions を使用して、PR 時の自動テスト・ビルドチェックと、タグプッシュ時のリリースビルドを整備する。既存の `sql-query-build` プロジェクトのワークフロー構成（`ci.yml` / `build-test.yml` / `release.yml`）を踏襲して、spec-prompt に適合した形で移植する。

## 背景・目的

Phase 4-B でテストスイートが整備された。これを CI で自動実行することで：

- PR ごとに lint・test・ビルドチェックが自動で走り、デグレを早期検知できる
- タグをプッシュするだけで macOS / Windows 向けのバイナリがリリースされる
- 開発フローが標準化され、将来のコントリビューターが参加しやすくなる

## 現状

- `.github/` ディレクトリは存在するが、ワークフローファイルは未作成
- テスト: `npm test`（Vitest）、`cargo test`（Rust）いずれも手動実行のみ
- ビルド: ローカルで `npx tauri build` を実行

## 要件一覧

### 機能要件

#### F-1: CI ワークフロー（PR 時）

- **説明**: `main` ブランチへの PR 作成・更新時に自動でテスト・ビルドチェックを実行する
- **受け入れ条件**:
  - [ ] フロントエンド変更時（`src/**`, `package.json` 等）に `npm run lint` + `npm test` が実行される
  - [ ] バックエンド変更時（`src-tauri/**`）に `cargo test` が実行される
  - [ ] フロントエンド・バックエンドいずれかの変更時にビルドチェック（`tsc && vite build` + `cargo check`）が実行される
  - [ ] パスフィルタにより変更のないジョブはスキップされる（`dorny/paths-filter` 使用）

#### F-2: ビルドテストワークフロー（手動トリガー）

- **説明**: 手動実行（`workflow_dispatch`）で macOS / Windows / Linux 向けビルドを任意のタイミングで確認できる
- **受け入れ条件**:
  - [ ] `platform` の選択肢（all / macos / windows / linux）でビルド対象を絞り込める
  - [ ] macOS は Apple Silicon（`aarch64`）と Intel（`x86_64`）の両ターゲットをビルドする
  - [ ] 成果物を GitHub Actions の Artifact として 7 日間保持する

#### F-3: リリースワークフロー（タグプッシュ時）

- **説明**: `v*` タグプッシュ時に全プラットフォーム向けバイナリをビルドし、GitHub Releases に自動公開する
- **受け入れ条件**:
  - [ ] `tauri-apps/tauri-action` を使用してビルド・リリースを実行する
  - [ ] macOS（Apple Silicon + Intel）、Windows、Linux の計 4 matrix でビルドする
  - [ ] GitHub Releases に `.dmg` / `.msi` / `.deb` が添付される
  - [ ] macOS コード署名・Notarization 用の Secrets を環境変数として渡す（値は後から設定）

### 非機能要件

- **再現性**: `actions/setup-node@v4`（Node.js 20）と `dtolnay/rust-toolchain@stable` で環境を固定する
- **速度**: パスフィルタにより不要なジョブを省略し、CI 時間を最小化する
- **一貫性**: 既存の `sql-query-build` ワークフローと同一の構造・Action バージョンを使用する

## スコープ

### 対象

- `.github/workflows/ci.yml` — PR 時の自動テスト・ビルドチェック
- `.github/workflows/build-test.yml` — 手動トリガーのビルド確認
- `.github/workflows/release.yml` — タグプッシュ時のリリース

### 対象外

- macOS コード署名・Notarization の実際の証明書設定（Secrets の値登録は 4-D 以降）
- Linux 向けの継続的サポート（ビルド確認のみ、主ターゲットは macOS / Windows）

## 参考資料

- `sql-query-build/.github/workflows/ci.yml` — パスフィルタ付き CI の参考実装
- `sql-query-build/.github/workflows/build-test.yml` — 手動ビルドテストの参考実装
- `sql-query-build/.github/workflows/release.yml` — tauri-action を使ったリリースの参考実装
