# 要件定義書 - status-bar-phase1

## 概要

プロジェクト仕様書 `docs/projects/20260419-ステータスバー機能/` の **Phase 1: 基盤整備** に該当する作業を実装する。画面下部ステータスバーの骨格を用意し、以降の Phase で Git ブランチ名・ファイル種別の表示を載せられる状態にする。

Phase 1 のゴール:
- Rust 側で Git ブランチ名を取得する IPC コマンド (`git_branch`) を追加
- フロント側から同コマンドを呼び出す IPC ラッパーを追加
- `AppLayout` の最下段にステータスバー領域（空スケルトン）を配置
- 既存のレイアウト・機能に回帰がないことを確認

## 背景・目的

- 現在のアプリには画面下部の常設ステータス表示領域が存在しない。
- Phase 2 以降で「Git ブランチ表示」「ファイル種別表示」を載せる前に、バックエンド IPC とレイアウトの枠を整える必要がある。
- Phase 1 で基盤を切り出すことで、機能ごとの差分が小さくなりレビューしやすくなる。

## 要件一覧

### 機能要件

#### F-1: Git ブランチ取得コマンド（Rust）

- **説明**: `src-tauri/src/commands/git.rs` に `git_branch(cwd: String) -> Result<Option<String>, String>` を追加する。`git rev-parse --abbrev-ref HEAD` を実行し、戻り値が `HEAD`（detached HEAD）のときは `git rev-parse --short HEAD` で短縮 SHA を取得して返す。
- **受け入れ条件**:
  - [ ] 通常ブランチでは `Ok(Some("<branch_name>"))` を返す
  - [ ] detached HEAD では `Ok(Some("<short_sha>"))` を返す
  - [ ] Git リポジトリでない、`git` 未インストール等の失敗ケースは `Ok(None)` を返す（UI を壊さない）
  - [ ] Rust 単体テストで上記 3 ケースを検証する

#### F-2: コマンド登録

- **説明**: `src-tauri/src/lib.rs` の `invoke_handler!` マクロに `git_branch` を追加する。
- **受け入れ条件**:
  - [ ] `cargo check` でエラーなし
  - [ ] `invoke("git_branch", { cwd })` がフロントから呼び出せる

#### F-3: フロント IPC ラッパー

- **説明**: `src/lib/tauriApi.ts` に `getBranch(cwd: string): Promise<string | null>` を追加する。Rust の `Option<String>` が `null | string` として正規化されることを型で表現する。
- **受け入れ条件**:
  - [ ] 既存の `getGitStatus` と同じ配置・粒度で追加されている
  - [ ] 型定義（戻り値 `Promise<string | null>`）が正しい
  - [ ] `npm run lint` および TypeScript ビルドでエラーなし

#### F-4: ステータスバー枠の配置

- **説明**: `src/components/Layout/AppLayout.tsx` を `flex flex-col` 構造に変更し、最下段に高さ 28px (`h-7`) の `StatusBar` スケルトンコンポーネントを配置する。中身は Phase 2 で実装するため、Phase 1 時点では空（または「Status Bar」などのプレースホルダ）。
- **受け入れ条件**:
  - [ ] 画面最下段に 28px の帯が常時表示されている
  - [ ] `SplitPane` が残りの高さを占有し、ツリー・メインエリア・タブバー等に高さ崩れが発生しない
  - [ ] 分割レイアウト（コンテンツ / ターミナル）に切り替えても崩れない
  - [ ] ターミナルモードでも帯が表示される（中身空のまま）

### 非機能要件

- **パフォーマンス**: ステータスバー追加による初期描画時間の増加は無視できる範囲（主観的に気づかないレベル）。
- **ユーザビリティ**: Phase 1 時点では中身が空でも UI 的に違和感がないよう、背景色・ボーダーを既存の `--color-bg-elevated` / `--color-border` と揃える。
- **保守性**: `StatusBar` は `src/components/StatusBar/` 配下に独立コンポーネントとして切り出す（Phase 2 で子コンポーネントを追加するため）。
- **外観・デザイン**: 背景 `var(--color-bg-elevated)`、上部に 1px ボーダー `var(--color-border)`、テキスト色 `var(--color-text-muted)`。フォントサイズは既存の小さめ UI と揃える（12px 相当）。

## スコープ

### 対象

- Rust `git_branch` コマンド + 単体テスト
- `invoke_handler` への登録
- フロント IPC ラッパー `getBranch`
- `AppLayout` への `StatusBar` 枠（スケルトン）配置

### 対象外

- ブランチ名の実表示・自動更新ロジック（Phase 2）
- ブランチ名のリアルタイム更新（Phase 2 で 3 秒間隔ポーリングにて実装）
- ファイル種別の表示（Phase 2）
- ブランチ表示のクリック動作、ahead/behind、変更ファイル数表示（プロジェクトスコープ外）

## 実装対象ファイル（予定）

- `src-tauri/src/commands/git.rs` — `git_branch` 関数 + 単体テスト追加
- `src-tauri/src/lib.rs` — `invoke_handler` への登録
- `src/lib/tauriApi.ts` — `getBranch` ラッパー追加
- `src/components/Layout/AppLayout.tsx` — 最上位レイアウト変更
- `src/components/StatusBar/StatusBar.tsx` — 新規作成（スケルトン）
- `src/components/StatusBar/index.ts` — 再エクスポート（任意）

## 依存関係

- なし（Phase 1 は基盤のみ。Phase 2 の `useGitBranch` フックや表示コンポーネントは Phase 1 完了後に着手）。

## 既知の制約

- `git_branch` は `std::process::Command` で外部 `git` を呼ぶため、Git 未インストール環境では `None` を返す仕様にする。代替実装（`git2` クレート使用）は Phase 2 以降で必要があれば検討する。
- Tauri v2 capability `fs:read-all` が既に付与済みである前提（`git_branch` の Rust 側実行に使用）。

## 参考資料

- `docs/projects/20260419-ステータスバー機能/01_要件定義書.md`
- `docs/projects/20260419-ステータスバー機能/02_概要設計書.md`
- `docs/projects/20260419-ステータスバー機能/03_WBS.md`（Phase 1: T1-1〜T1-4）
- `docs/steering/03_architecture_specifications.md` — 技術スタック
- `docs/steering/04_repository_structure.md` — ディレクトリ構造・命名規則
- `docs/steering/05_development_guidelines.md` — コーディング規約・ブランチ戦略
