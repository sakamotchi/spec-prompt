# タスクリスト - status-bar-phase3

## 進捗サマリー

| 状態 | 件数 |
|------|------|
| 完了 | 7 |
| 進行中 | 0 |
| 未着手 | 1 |

## タスク一覧

### T-1: 要件定義・設計

- [x] 要件定義書の作成（本ドキュメント群）
- [x] 設計書の作成（本ドキュメント群）
- [x] 実装方針のレビュー（自己確認 + ユーザー承認）

### T-2: `useGitBranch` の Vitest テスト

- [x] `src/hooks/useGitBranch.test.ts` 新規作成
- [x] `vi.mock` で `tauriApi.getBranch` をモック
- [x] `vi.useFakeTimers()` を使い、5 ケース（cwd=null / 初回取得 / ポーリング / cwd 変更 / アンマウント）を実装
- [x] `npm run test src/hooks/useGitBranch.test.ts` がパス

### T-3: `BranchIndicator` の Vitest テスト

- [x] `src/components/StatusBar/BranchIndicator.test.tsx` 新規作成
- [x] 3 ケース（ブランチ表示 / null 非表示 / title 属性）を実装
- [x] `npm run test src/components/StatusBar/BranchIndicator.test.tsx` がパス

### T-4: `FileTypeIndicator` の Vitest テスト

- [x] `src/components/StatusBar/FileTypeIndicator.test.tsx` 新規作成
- [x] `useAppStore.setState` / `useContentStore.setState` でテスト用状態を組み立てる
- [x] 5 ケース（Markdown / Code / ターミナルモード / filePath=null / secondary フォーカス）を実装
- [x] `beforeEach` でストアを初期化
- [x] `npm run test src/components/StatusBar/FileTypeIndicator.test.tsx` がパス

### T-5: テスト全体の動作確認

- [x] `npm run test` 全件パス（305 / 305）
- [x] `npm run lint` / `npx tsc --noEmit` がエラーなし
- [x] Rust テスト（`cargo test commands::git`）が引き続きパス

### T-6: 永続化ドキュメント更新

- [x] `docs/steering/02_functional_design.md` の機能カテゴリ表にステータスバーを追加し、§3.7 でブランチ表示・ファイル種別・モード連動・分割フォーカスを記載
- [x] 機密情報・個人情報を含まないことを確認
- [x] 既存の文体（バージョン 1.3 → 1.4、変更履歴追記）に合わせる

### T-7: プロジェクト仕様 WBS 更新

- [x] `docs/projects/20260419-ステータスバー機能/03_WBS.md` の T1-1〜T3-4 を `[x]` に更新
- [x] マイルストーン M1 / M2 / M3 を完了状態に更新

### T-8: PR 作成

- [ ] `gh pr create --base main --head feature/status-bar` を実行（ユーザー承認後に実施）

## 完了条件

- [x] T-1〜T-7 が完了
- [x] `npm run test` / `npm run lint` / `npx tsc --noEmit` / `cargo test commands::git` がすべてパス
- [x] `docs/steering/02_functional_design.md` にステータスバー節が追記済み
- [x] WBS の Phase 3 チェック欄が実態に合わせて更新済み
- [ ] `feature/status-bar` → `main` の PR が作成済み
