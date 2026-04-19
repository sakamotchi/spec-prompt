# 要件定義書 - status-bar-phase3

## 概要

プロジェクト仕様書 `docs/projects/20260419-ステータスバー機能/` の **Phase 3: 統合テスト・仕上げ** に該当する作業。Phase 1/2 で機能実装はほぼ完了しているため、Phase 3 では自動テストの追加・永続化ドキュメントへの反映・PR 準備を行う。

Phase 3 のゴール:
- フロントエンドの主要ユニット（`useGitBranch` / `BranchIndicator` / `FileTypeIndicator`）に Vitest テストを追加
- `docs/steering/02_functional_design.md` にステータスバー機能の仕様を追記
- プロジェクト仕様の `03_WBS.md` の Phase 3 チェック欄を更新
- `feature/status-bar` ブランチから `main` への PR を作成し、マージ可能な状態にする

## 背景・目的

- Phase 1 (Rust) には既に単体テストが 3 ケース追加済みだが、フロント側のテストはまだない。ロジックを持つ `useGitBranch` と表示条件を持つ `*Indicator` をテストで固め、リグレッションを検出できるようにする。
- ステータスバーはアプリ全体の共通 UI であり、今後の機能開発でも参照される。永続化ドキュメント (`docs/steering/02_functional_design.md`) にステータスバーの項を設けて、将来の開発者が仕様を参照できる状態にする。
- PR を作成することで、Phase 1/2 の変更をレビュー・マージフローに乗せる。

## 要件一覧

### 機能要件

#### F-1: `useGitBranch` フックの Vitest テスト

- **説明**: `src/hooks/useGitBranch.test.ts` を新規作成。`tauriApi.getBranch` をモックし、以下のケースをテストする。
  - cwd が `null` のとき IPC を呼ばず `{ branch: null, loading: false }` を維持
  - 初回レンダー時に IPC が 1 回呼ばれ `branch` が反映される
  - `vi.useFakeTimers()` を使い、3 秒経過で再取得が走る
  - cwd 変更時に前の cwd のタイマーが破棄され、新しい cwd に対して取得が走る
  - アンマウント時にタイマーが破棄され、以降 IPC が呼ばれない
- **受け入れ条件**:
  - [ ] 上記 5 ケースがパス
  - [ ] `@testing-library/react` の `renderHook` と `vi.useFakeTimers()` を組み合わせた正しい非同期/タイマー制御ができている
  - [ ] IPC モックがリークしない（`beforeEach` / `afterEach` でリセット）

#### F-2: `BranchIndicator` の Vitest テスト

- **説明**: `src/components/StatusBar/BranchIndicator.test.tsx` を新規作成。`render` と `screen` で以下を検証する。
  - `branch` に文字列を渡すとテキストが表示される
  - `branch === null` のとき何も描画されない（`container.firstChild === null`）
  - `title` 属性にブランチ名が設定される
- **受け入れ条件**:
  - [ ] 3 ケースがパス
  - [ ] スナップショットテストは用いず、明示的な DOM 検証にする

#### F-3: `FileTypeIndicator` の Vitest テスト

- **説明**: `src/components/StatusBar/FileTypeIndicator.test.tsx` を新規作成。`useAppStore` と `useContentStore` の初期状態をテスト内で操作し、以下をテストする。
  - コンテンツモード + Markdown ファイルのとき `Markdown` ラベルが表示される
  - コンテンツモード + コードファイル（`.ts` 等）のとき `Code` ラベルが表示される
  - ターミナルモード時は何も描画されない
  - filePath が `null` のとき何も描画されない
  - `focusedPane` が `secondary` のときは secondary 側のアクティブタブの filePath が使われる
- **受け入れ条件**:
  - [ ] 5 ケースがパス
  - [ ] ストアの状態はテストごとにリセットされる（副作用を残さない）

#### F-4: 永続化ドキュメント更新

- **説明**: `docs/steering/02_functional_design.md` にステータスバーの仕様を追記する。
  - 画面下段に高さ 28px のステータスバーが常設されること
  - 左端: Git ブランチ名（3 秒間隔ポーリング。非 Git 時は非表示）
  - 右端: アクティブファイルのビューア種別（`Markdown` / `Code` / `Image` / `Plain`。ターミナルモード時は非表示）
  - 関連ファイル: `src/components/StatusBar/*`, `src/hooks/useGitBranch.ts`, `src-tauri/src/commands/git.rs::git_branch`
- **受け入れ条件**:
  - [ ] 既存のセクション構造に沿った位置に追記されている
  - [ ] 機密情報・個人情報を含まない

#### F-5: WBS・プロジェクト仕様の更新

- **説明**: `docs/projects/20260419-ステータスバー機能/03_WBS.md` の Phase 3 タスクチェック欄を埋め、マイルストーン M3 を完了状態にする。
- **受け入れ条件**:
  - [ ] Phase 3 の T3-1 〜 T3-4 のうち、本 Phase で実施したものを `[x]` に
  - [ ] マイルストーン M1 / M2 / M3 のチェック状態を実態に合わせる

#### F-6: PR 作成

- **説明**: `gh pr create` で `feature/status-bar` → `main` の PR を作成する。PR 本文には Phase 1/2/3 の主要変更、テスト観点、方針変更（watch → ポーリング）の経緯、Issue #9（別件のスクロール位置バグ）は本 PR のスコープ外であることを明記する。
- **受け入れ条件**:
  - [ ] PR が作成されている
  - [ ] PR タイトルは 70 文字以内、本文に Summary / Test plan を記載
  - [ ] マージ前のレビューを受けられる状態

### 非機能要件

- **パフォーマンス**: Vitest 実行時間に目立った影響を与えない（全体で +2 秒以内）
- **保守性**: テストは実装詳細（内部 state の名前など）ではなく、外部から観測できる挙動（戻り値・描画結果・IPC 呼び出し回数）を検証する
- **外観・デザイン**: 本 Phase では UI 変更なし

## スコープ

### 対象

- `src/hooks/useGitBranch.test.ts`（新規）
- `src/components/StatusBar/BranchIndicator.test.tsx`（新規）
- `src/components/StatusBar/FileTypeIndicator.test.tsx`（新規）
- `docs/steering/02_functional_design.md`（追記）
- `docs/projects/20260419-ステータスバー機能/03_WBS.md`（チェック欄更新）
- `feature/status-bar` → `main` の PR 作成

### 対象外

- `StatusBar` コンポーネント自体の結合テスト（子コンポーネントをそれぞれテストするため不要）
- E2E テスト（本プロジェクトでは未採用）
- ahead/behind・変更ファイル数表示などのプロジェクトスコープ外機能
- Issue #9（コンテンツタブのスクロール位置共有バグ）の修正
- ステータスバー項目の表示 ON/OFF 切替 UI 追加

## 実装対象ファイル（予定）

- `src/hooks/useGitBranch.test.ts`
- `src/components/StatusBar/BranchIndicator.test.tsx`
- `src/components/StatusBar/FileTypeIndicator.test.tsx`
- `docs/steering/02_functional_design.md`
- `docs/projects/20260419-ステータスバー機能/03_WBS.md`

## 依存関係

- Phase 1/2 の実装がコミット済み（`4bff2c4`, `3424e13`）であること
- Vitest・@testing-library/react のセットアップ（既存。他テストで実績あり）

## 既知の制約

- `vi.useFakeTimers()` 使用時、`setInterval` 内部で `await` を挟む非同期関数が正しく進まないケースがある。`await act(async () => ...)` と `vi.advanceTimersByTimeAsync` を使って対応する。
- `useContentStore` / `useAppStore` は persist 設定を持つため、テスト内でストアを直接書き換える際は既存実装と同様 `useStore.setState` を使い、テストごとに初期化する。

## 参考資料

- `docs/projects/20260419-ステータスバー機能/03_WBS.md` Phase 3: T3-1〜T3-4
- `src/hooks/usePromptHistoryCursor.test.ts` — `renderHook` 活用テストの既存例
- `src/components/ContentView/ContentView.test.tsx` — コンポーネントテストの既存例
- Phase 1/2 の作業ドキュメント（`docs/working/20260419_status-bar-phase{1,2}/`）
