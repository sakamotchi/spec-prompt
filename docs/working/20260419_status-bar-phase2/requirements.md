# 要件定義書 - status-bar-phase2

## 概要

プロジェクト仕様書 `docs/projects/20260419-ステータスバー機能/` の **Phase 2: 機能実装（Git 監視 + ファイル種別）** に該当する作業を実装する。Phase 1 で整えたステータスバー枠・IPC コマンド・ラッパーの上に、Git ブランチ名とアクティブファイルのビューア種別を実表示する。

Phase 2 のゴール:
- 3 秒間隔のポーリングでブランチ情報を自動更新する `useGitBranch` フックを実装
- `BranchIndicator` コンポーネントで現在のブランチ名（または detached HEAD の短縮 SHA）を表示
- `FileTypeIndicator` コンポーネントでアクティブファイルのビューア種別を表示
- `StatusBar` へ両コンポーネントを統合し、モード切替（content/terminal）に追従させる

> 当初は `tauri-plugin-fs` の `watch` で `.git/HEAD` を監視する方針だったが、実装中の手動検証で macOS では atomic rename によるイベント取りこぼしが発生し、ブランチ切替に追従しないことを確認したため、3 秒間隔ポーリングへ方針変更した。本ドキュメントは方針変更後の最終実装を記載している。

## 背景・目的

- 現在のステータスバーは空枠のため、ユーザーはブランチ情報・ファイル種別を視覚的に把握できない。
- Phase 1 で IPC とレイアウトの下準備が整ったので、Phase 2 では表示ロジックをまとめて導入し、1 リリースでステータスバーを機能完成させる。
- 「main ブランチで誤って編集指示」を防ぐというプロジェクト全体の成功指標は Phase 2 完了時点で達成される。

## 要件一覧

### 機能要件

#### F-1: `useGitBranch` フック（IPC + 3 秒間隔ポーリング）

- **説明**: `src/hooks/useGitBranch.ts` を新規作成。引数に cwd（`projectRoot`）を受け取り、以下を行う。
  1. 初回 cwd セット時に `tauriApi.getBranch(cwd)` を呼び出してブランチ名を取得
  2. `setInterval(3000)` で 3 秒ごとに `tauriApi.getBranch(cwd)` を再取得し state を更新
  3. cwd の変更・アンマウント時に `clearInterval` + `disposed` フラグで確実にクリーンアップ
  4. 戻り値は `{ branch: string | null; loading: boolean }`
- **受け入れ条件**:
  - [ ] 初回レンダー時に IPC が呼ばれ、ブランチ名が state に反映される
  - [ ] 別のターミナルから `git checkout` 実行で 3 秒以内に表示が更新される
  - [ ] cwd が変わったとき前の cwd のタイマーが破棄され、新しい cwd に対して再取得が走る
  - [ ] cwd が `null` の間は何も行わない（branch = null, loading = false、タイマー未起動）
  - [ ] Git リポジトリでないディレクトリでは `branch = null` のまま（エラーを投げない）

#### F-2: `BranchIndicator` コンポーネント

- **説明**: `src/components/StatusBar/BranchIndicator.tsx` を新規作成。Props は `{ branch: string | null }`。`branch` が非 null のとき Git アイコン + ブランチ名を表示し、null のときは何も描画しない。
- **受け入れ条件**:
  - [ ] `lucide-react` の `GitBranch` アイコン（14px 程度）とテキストを横並びで表示
  - [ ] テキストがウィンドウ幅を圧迫しないよう max-width + `truncate` で省略
  - [ ] `branch === null` なら `null` を返して非表示
  - [ ] `title` 属性に完全なブランチ名を設定し、マウスホバーで全体が見える

#### F-3: `FileTypeIndicator` コンポーネント

- **説明**: `src/components/StatusBar/FileTypeIndicator.tsx` を新規作成。以下のロジックを内包する。
  1. `useAppStore` から `activeMainTab` を購読
  2. `useContentStore` から `focusedPane` と対応する `activeTabId` の `filePath` を購読
  3. `filePath` が非 null のとき `getViewMode(filePath)` を呼び、`markdown` / `code` / `image` / `plain` を日本語ラベルへマッピング
- **受け入れ条件**:
  - [ ] ラベル: `Markdown` / `Code` / `Image` / `Plain`（すべて半角英字）
  - [ ] `activeMainTab === 'terminal'` の場合、何も描画しない
  - [ ] `filePath === null` の場合、何も描画しない
  - [ ] アイコン（`lucide-react` の適切なもの、例: `FileText` / `Code` / `Image` / `File`）を併記

#### F-4: `StatusBar` 統合

- **説明**: Phase 1 で空スケルトンだった `StatusBar` を実体化する。左端に `BranchIndicator`、右端に `FileTypeIndicator`（VS Code 風）を配置。`useAppStore` から `projectRoot` を取得して `useGitBranch` に渡す。
- **受け入れ条件**:
  - [ ] レイアウトは `flex items-center justify-between`（または同等）で左右に振り分ける
  - [ ] 両インジケータが `null` の場合でも帯の高さ・枠線は維持される
  - [ ] 分割レイアウト（コンテンツ分割）時は `focusedPane` 側のファイル種別を表示する

### 非機能要件

- **パフォーマンス**: 3 秒間隔のポーリングで IPC を呼び出す。`git rev-parse --abbrev-ref HEAD` は数 ms で完了するため、アプリ全体の CPU/メモリへの影響は無視できる。
- **ユーザビリティ**: インジケータは CSS 変数 `--color-text-muted` を基本、アクティブ時はそのまま（強調色は使わない）。アイコンとテキストは 14px 相当のフォントでコンパクトに揃える。
- **保守性**: `useGitBranch` は単体テストしやすいように IPC 呼び出し・タイマー管理をフック内部で完結させる。ストア化はしない（Phase 3 以降で必要になれば検討）。
- **外観・デザイン**: アイコンは `lucide-react` を使用（tree-shaking）。配色は Phase 1 と同じく CSS カスタムプロパティ (`--color-bg-elevated` / `--color-border` / `--color-text-muted`) を使用。

## スコープ

### 対象

- `src/hooks/useGitBranch.ts`
- `src/components/StatusBar/BranchIndicator.tsx`
- `src/components/StatusBar/FileTypeIndicator.tsx`
- `src/components/StatusBar/StatusBar.tsx`（Phase 1 のスケルトンを実装で置き換え）
- 必要に応じて `src/components/StatusBar/index.ts` の再エクスポート更新

### 対象外

- ahead/behind・変更ファイル数表示（プロジェクトスコープ外、Phase 3 以降）
- ブランチクリックでのブランチ切替 UI
- ステータスバー表示項目の ON/OFF 設定
- `FileTypeIndicator` に拡張子の詳細（例: TypeScript / Rust の区別）を表示する機能
- 再描画最適化のための memo 化（実測で問題があれば Phase 3 以降に対応）

## 実装対象ファイル（予定）

- `src/hooks/useGitBranch.ts` — 新規
- `src/components/StatusBar/StatusBar.tsx` — 実装差し替え
- `src/components/StatusBar/BranchIndicator.tsx` — 新規
- `src/components/StatusBar/FileTypeIndicator.tsx` — 新規
- `src/components/StatusBar/index.ts` — 必要なら `BranchIndicator` / `FileTypeIndicator` も再エクスポート

## 依存関係

- Phase 1 の `tauriApi.getBranch` と `StatusBar` スケルトン（配置済み）に依存
- `lucide-react`（依存済み）

## 既知の制約

- ポーリング方式のため、ブランチ切替から表示反映まで最大 3 秒のラグが発生する（受け入れ条件でも「3 秒以内」と定義）。
- Worktree 管理されたリポジトリ（`.git` が gitdir pointer ファイル）でも `git rev-parse` 経由で取得するため表示は問題なく、特別扱いは不要。
- `git` がインストールされていない、または非 Git ディレクトリのとき `getBranch` は `null` を返すため、`BranchIndicator` は非表示になる（エラーを投げない）。

## 参考資料

- `docs/projects/20260419-ステータスバー機能/01_要件定義書.md`
- `docs/projects/20260419-ステータスバー機能/02_概要設計書.md`
- `docs/projects/20260419-ステータスバー機能/03_WBS.md`（Phase 2: T2-1〜T2-4）
- `docs/working/20260419_status-bar-phase1/design.md` — Phase 1 の設計
- `src/stores/appStore.ts` — `refreshGitStatus` のデバウンス実装パターン（参考）
