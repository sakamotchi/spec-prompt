# タスクリスト - Phase 1-C: 統合ターミナル（TerminalPanel）

## 進捗サマリー

| 状態 | 件数 |
|------|------|
| 完了 | 5 |
| 進行中 | 0 |
| 未着手 | 0 |

## タスク一覧

### T-1: 要件定義・設計

- [x] 要件定義書の作成 (`requirements.md`)
- [x] 設計書の作成 (`design.md`)
- [x] レビュー完了

**WBSリファレンス**: Phase 1-C 準備作業

---

### T-2: `terminalStore` 実装

**WBSリファレンス**: 1-C-7（一部）、1-D-2

- [x] `src/stores/terminalStore.ts` を新規作成
  - [x] `tabs: TerminalTab[]` / `activeTabId` の初期状態
  - [x] `addTab` / `closeTab` / `setActiveTab` / `setPtyId` アクションを実装
  - [x] 最後の 1 タブは閉じられないガード処理
- [x] `src/stores/terminalStore.test.ts` を作成してユニットテスト追加
  - [x] 初期状態のタブ数が 1
  - [x] `addTab` でタブが増える
  - [x] タブが 1 つの時 `closeTab` は何もしない
  - [x] `closeTab` でアクティブタブを閉じると隣がアクティブになる
- [x] `npm run lint` でエラーなし

**対象ファイル**:
- `src/stores/terminalStore.ts`
- `src/stores/terminalStore.test.ts`

---

### T-3: `TerminalPanel` 拡張

**WBSリファレンス**: 1-C-6

- [x] `TerminalPanel.tsx` に `isActive` props を追加
- [x] タブが表示状態に切り替わった時に `fitAddon.fit()` を再実行（`useLayoutEffect` 使用）
- [x] タブクリック時に `term.focus()` を呼び出してターミナルへ自動フォーカス
- [x] `npm run lint` でエラーなし

**対象ファイル**:
- `src/components/TerminalPanel/TerminalPanel.tsx`

---

### T-4: `TerminalTabs` コンポーネント実装

**WBSリファレンス**: 1-C-7

- [x] `src/components/TerminalPanel/TerminalTabs.tsx` を新規作成
  - [x] タブバー（タブ名 + 「×」ボタン）の実装
  - [x] 「+」ボタンでタブ追加
  - [x] タブクリックでアクティブ切り替え
  - [x] アクティブタブのスタイリング（`--color-accent` 下線）
  - [x] 非アクティブタブを `display: none` で非表示にして PTY を維持
- [x] `src/components/TerminalPanel/index.ts` を作成
- [x] `src/components/MainArea/MainArea.tsx` の `<TerminalPanel />` を `<TerminalTabs />` に差し替え
- [x] `npm run lint` でエラーなし

**対象ファイル**:
- `src/components/TerminalPanel/TerminalTabs.tsx`
- `src/components/TerminalPanel/index.ts`
- `src/components/MainArea/MainArea.tsx`

---

### T-5: 結合・手動テスト・マージ

- [x] `npx tauri dev` でアプリ起動確認
- [x] 手動テスト全項目 OK（testing.md 参照）
- [x] `npm run test` がパス（13テスト）
- [x] `npm run lint` がエラーなし
- [x] `feature/1-C-terminal` → `develop` へマージ

**ブランチ**: `feature/1-C-terminal`

---

## 完了条件

- [x] 全タスクが完了
- [x] `npm run lint` がエラーなし
- [x] `npm run test` がパス（terminalStore ユニットテスト含む）
- [x] `cd src-tauri && cargo check` がパス
- [x] 手動テスト（testing.md）が全件 OK
- [x] `npx tauri dev` でターミナルタブが複数起動・切り替え・クローズできる
- [x] `develop` ブランチへのマージ済み
