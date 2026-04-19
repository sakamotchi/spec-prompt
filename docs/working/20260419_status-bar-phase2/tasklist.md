# タスクリスト - status-bar-phase2

## 進捗サマリー

| 状態 | 件数 |
|------|------|
| 完了 | 7 |
| 進行中 | 0 |
| 未着手 | 0 |

## タスク一覧

### T-1: 要件定義・設計

- [x] 要件定義書の作成（本ドキュメント群）
- [x] 設計書の作成（本ドキュメント群）
- [x] 実装方針のレビュー（自己確認 + ユーザー承認）

### T-2: `useGitBranch` フック実装（WBS T2-1 相当）

- [x] `src/hooks/useGitBranch.ts` を新規作成
- [x] 初回 IPC 取得ロジック実装
- [x] `setInterval(3000)` による 3 秒間隔ポーリングと `clearInterval` でのクリーンアップを実装
- [x] cwd 変更時にタイマーを差し替え（`disposed` フラグで非同期結果の反映を無効化）
- [x] 当初 `tauri-plugin-fs` の `watch("{cwd}/.git/HEAD")` / `watch("{cwd}/.git")` を試したが macOS の atomic rename でイベント取りこぼしが発生したためポーリングに切替
- [x] TypeScript 型チェック・lint 通過

### T-3: `BranchIndicator` 実装（WBS T2-2 相当）

- [x] `src/components/StatusBar/BranchIndicator.tsx` を新規作成
- [x] `lucide-react` の `GitBranch` アイコンを使用
- [x] `branch === null` で `null` を返す分岐
- [x] `title` 属性でフルネームを補完

### T-4: `FileTypeIndicator` 実装（WBS T2-3 相当）

- [x] `src/components/StatusBar/FileTypeIndicator.tsx` を新規作成
- [x] `appStore.activeMainTab` と `contentStore` 購読ロジック実装
- [x] `getViewMode` の結果をラベル・アイコンに写像
- [x] ターミナルモード・ファイル未選択時の非表示分岐
- [x] `focusedPane` に追従して表示対象の filePath を切り替え

### T-5: `StatusBar` 統合（WBS T2-4 相当）

- [x] Phase 1 のスケルトンを置き換えて `BranchIndicator` と `FileTypeIndicator` を配置
- [x] `useGitBranch(projectRoot)` を呼び出し、`BranchIndicator` に渡す
- [x] レイアウト調整（`justify-between` / 余白 / アイコンサイズ）
- [x] `src/components/StatusBar/index.ts` の再エクスポート整理（子コンポーネントも公開）

### T-6: 動作確認・テスト

- [x] `testing.md` の手動テスト全件実施
- [x] 既存機能への回帰がないことを確認（ツリー / ターミナル / 分割レイアウト等）
- [x] `npm run lint` / `npx tsc --noEmit` / `cargo test commands::git` 全件パス

### T-7: ドキュメント・マージ

- [x] `docs/projects/20260419-ステータスバー機能/` の 01_要件定義書・02_概要設計書・03_WBS をポーリング方式に更新
- [ ] 永続化ドキュメント `docs/steering/02_functional_design.md` へステータスバー機能の追記（別タスク）
- [x] ユーザー承認を受けて `feature/status-bar` ブランチにコミット

## 完了条件

- [x] 全タスクが完了（steering 反映除く）
- [x] `npm run lint` / `npx tsc --noEmit` がエラーなし
- [x] `testing.md` の手動テスト全件 OK
- [x] `feature/status-bar` ブランチにコミット済み（ユーザー承認ベース）
- [x] ステータスバーにブランチ名とファイル種別が表示され、ブランチ切替が自動反映される
