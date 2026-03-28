# タスクリスト - Phase 1-C: 統合ターミナル（TerminalPanel）

## 進捗サマリー

| 状態 | 件数 |
|------|------|
| 完了 | 0 |
| 進行中 | 0 |
| 未着手 | 5 |

## タスク一覧

### T-1: 要件定義・設計

- [ ] 要件定義書の作成 (`requirements.md`)
- [ ] 設計書の作成 (`design.md`)
- [ ] レビュー完了

**WBSリファレンス**: Phase 1-C 準備作業

---

### T-2: `terminalStore` 実装

**WBSリファレンス**: 1-C-7（一部）、1-D-2

- [ ] `src/stores/terminalStore.ts` を新規作成
  - [ ] `tabs: TerminalTab[]` / `activeTabId` の初期状態
  - [ ] `addTab` / `closeTab` / `setActiveTab` / `setPtyId` アクションを実装
  - [ ] 最後の 1 タブは閉じられないガード処理
- [ ] `src/stores/terminalStore.test.ts` を作成してユニットテスト追加
  - [ ] 初期状態のタブ数が 1
  - [ ] `addTab` でタブが増える
  - [ ] タブが 1 つの時 `closeTab` は何もしない
  - [ ] `closeTab` でアクティブタブを閉じると隣がアクティブになる
- [ ] `npm run lint` でエラーなし

**対象ファイル**:
- `src/stores/terminalStore.ts`
- `src/stores/terminalStore.test.ts`

---

### T-3: `TerminalPanel` 拡張

**WBSリファレンス**: 1-C-6

- [ ] `TerminalPanel.tsx` に `tabId` props を追加
- [ ] タブが表示状態に切り替わった時（`display: none` → `flex`）に `fitAddon.fit()` を再実行（`useLayoutEffect` 使用）
- [ ] `npm run lint` でエラーなし

**対象ファイル**:
- `src/components/TerminalPanel/TerminalPanel.tsx`

---

### T-4: `TerminalTabs` コンポーネント実装

**WBSリファレンス**: 1-C-7

- [ ] `src/components/TerminalPanel/TerminalTabs.tsx` を新規作成
  - [ ] タブバー（タブ名 + 「×」ボタン）の実装
  - [ ] 「+」ボタンでタブ追加
  - [ ] タブクリックでアクティブ切り替え
  - [ ] アクティブタブのスタイリング（`--color-accent` 下線）
  - [ ] 非アクティブタブを `display: none` で非表示にして PTY を維持
- [ ] `src/components/TerminalPanel/index.ts` を作成または更新
- [ ] `src/components/MainArea/MainArea.tsx` の `<TerminalPanel />` を `<TerminalTabs />` に差し替え
- [ ] `npm run lint` でエラーなし

**対象ファイル**:
- `src/components/TerminalPanel/TerminalTabs.tsx`
- `src/components/TerminalPanel/index.ts`
- `src/components/MainArea/MainArea.tsx`

---

### T-5: 結合・手動テスト・マージ

- [ ] `npx tauri dev` でアプリ起動確認
- [ ] 手動テスト全項目 OK（testing.md 参照）
- [ ] `npm run test` がパス
- [ ] `npm run lint` がエラーなし
- [ ] `cd src-tauri && cargo check` がパス
- [ ] `feature/1-C-terminal` → `develop` へマージ

**ブランチ**: `feature/1-C-terminal`

---

## 完了条件

- [ ] 全タスクが完了
- [ ] `npm run lint` がエラーなし
- [ ] `npm run test` がパス（terminalStore ユニットテスト含む）
- [ ] `cd src-tauri && cargo check` がパス
- [ ] 手動テスト（testing.md）が全件 OK
- [ ] `npx tauri dev` でターミナルタブが複数起動・切り替え・クローズできる
- [ ] `develop` ブランチへのマージ済み
