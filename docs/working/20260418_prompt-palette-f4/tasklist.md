# タスクリスト - prompt-palette-f4

WBS（`docs/local/20260415-プロンプト編集パレット/03_WBS.md`）フェーズ F4（F4-1, F4-2）に対応。F4 は任意（v1.1 候補）。各タスク完了後は **必ずユーザー確認を得てから** コミット・マージする（CLAUDE.md 規約）。

## 進捗サマリー

| 状態 | 件数 |
|------|------|
| 完了 | 7 |
| 進行中 | 0 |
| 未着手 | 0 |

## タスク一覧

### T-1: 要件定義・設計

- [x] 要件定義書の作成（`requirements.md`）
- [x] 設計書の作成（`design.md`）
- [x] テスト手順書の作成（`testing.md`）
- [x] ユーザーレビュー

### T-2: ターミナル本体の右クリックメニュー新設（WBS F4-1）

- [x] `src/components/TerminalPanel/TerminalBodyContextMenu.tsx` を新設（Radix ContextMenu で children をラップ）
- [x] 項目 1 つ: 「プロンプトを編集...」、キーヒント `⌘⇧P` / `Ctrl+⇧+P`
- [x] `onSelect` で `usePromptPaletteStore.getState().open(ptyId, tabTitle)` を呼ぶ
- [x] `ptyId=null` のときは項目 disabled
- [x] スタイルは `TabContextMenu` と揃える

### T-3: `TerminalTabs` へ配線（WBS F4-1 の結合）

- [x] `src/components/TerminalPanel/TerminalTabs.tsx` の `<TerminalPanel tabId ... />` を `<TerminalBodyContextMenu>` でラップ
- [x] `ptyId` は `tab.ptyId`、`tabTitle` は `computeDisplayTitle(tab)` を渡す
- [x] 既存のドラッグ/ドロップ・pointer-events 等と競合しないことを手動 E2E で確認（ケース 8）

### T-4: 挿入シグナル + フラッシュ実装（WBS F4-2）

- [x] `src/stores/promptPaletteStore.ts` に `lastInsertAt: number` を追加（初期値 0、`insertAtCaret` で単調増加）
- [x] `src/components/PromptPalette/PromptPalette.tsx` で `lastInsertAt` を購読
- [x] useEffect で `setFlashing(true)` → 300ms 後に false
- [x] `prefers-reduced-motion: reduce` のとき flash をスキップ
- [x] textarea に `boxShadow: 0 0 0 2px var(--color-accent)` を flash 中のみ付与、`transition: box-shadow 120ms ease-out`

### T-5: ユニットテスト追加

- [x] `src/stores/promptPaletteStore.test.ts` に `lastInsertAt` のテストを追加（成功時インクリメント・no-op 時不変、計 2 件）
- [x] `TerminalBodyContextMenu` の jsdom テストは Radix の実 DOM 依存のため省略し、手動 E2E で担保する判断（合意）

### T-6: 結合・動作確認

- [x] `npm run lint` 差分ファイルでエラーなし
- [x] `npm run build`（型チェック含む）がエラーなし
- [x] `npx vitest run` が全件パス（171/171）
- [x] `cd src-tauri && cargo check` がパス
- [x] `npx tauri dev` で `testing.md` の手動 E2E を全件実施

### T-7: ドキュメント・コミット

- [x] `testing.md` の確認結果を記録（ケース 1〜8 すべて OK、エッジ・回帰も OK）
- [ ] CLAUDE.md の「パス挿入機能」節にプロンプト編集パレット経由の仕様を追記（別コミット可）
- [x] ユーザー承認
- [ ] `feature/prompt-edit-palette` 上でコミット
- [ ] 必要なら PR 作成、`main` へマージ

## 完了条件

- [x] 全タスクが完了（コミット前）
- [x] `npm run lint` 差分ファイルでエラーなし
- [x] `npm run build`（型チェック含む）がエラーなし
- [x] `npx vitest run` が全件パス
- [x] `cd src-tauri && cargo check` がパス
- [x] `testing.md` の手動テストが全件 OK
- [x] ユーザー承認済み

## 前提

- F1 コミット済み: `d6076ed`
- F2 コミット済み: `2773a53`
- F3 コミット済み: `c8a851f`
- v1 受け入れ基準 1〜15 は達成済み（F4 は受け入れ基準外の UX 向上）
- `feature/prompt-edit-palette` ブランチ上で継続作業

## PR 粒度（参考、WBS より）

- PR-F4: UX 向上（T-2 〜 T-6 一括）

> F4 は任意フェーズ。スコープを絞った 1 PR で閉じる想定。
