# タスクリスト - Phase 3-C: キーボードショートカット整備

## 進捗サマリー

| 状態 | 件数 |
|------|------|
| 完了 | 1 |
| 進行中 | 0 |
| 未着手 | 5 |

## タスク一覧

### T-1: 要件定義・設計

- [x] 要件定義書の作成 (`requirements.md`)
- [x] 設計書の作成 (`design.md`)
- [x] レビュー完了

**WBSリファレンス**: Phase 3-C 準備作業

---

### T-2: ショートカット定義の集約（3-C-1）

**WBSリファレンス**: 3-C-1

- [ ] `src/lib/shortcuts.ts` を新規作成
  - [ ] `ShortcutItem` / `ShortcutCategory` 型を定義
  - [ ] ショートカット定義配列 `SHORTCUTS` を export
  - [ ] `matchesShortcut(e, shortcut)` ヘルパー関数を実装

**対象ファイル:**
- `src/lib/shortcuts.ts`（新規）

---

### T-3: ストアへのタブ操作アクション追加（3-C-1）

**WBSリファレンス**: 3-C-1

- [ ] `contentStore.ts` にアクションを追加
  - [ ] `addTab()` — 新規タブを末尾に追加してアクティブ化
  - [ ] `closeActiveTab()` — アクティブタブを閉じ、左隣をアクティブにする
  - [ ] `activateTabByIndex(index: number)` — 0-indexed でアクティブ化
  - [ ] `activateNextTab()` / `activatePrevTab()`
- [ ] `terminalStore.ts` に同様のアクションを追加
- [ ] `npm run lint` でエラーなし

**対象ファイル:**
- `src/stores/contentStore.ts`（変更）
- `src/stores/terminalStore.ts`（変更）

---

### T-4: グローバルキーハンドラ登録（3-C-1）

**WBSリファレンス**: 3-C-1

- [ ] `App.tsx`（または適切な最上位コンポーネント）にグローバル `keydown` リスナーを追加
  - [ ] `INPUT` / `TEXTAREA` / `.xterm-helper-textarea` へのフォーカス時はスキップ
  - [ ] `SHORTCUTS` 配列を走査してマッチしたハンドラを呼び出す
- [ ] 既存の `Ctrl+Tab`（ペイン切り替え）と競合しないことを確認
- [ ] `npm run lint` でエラーなし

**対象ファイル:**
- `src/App.tsx`（変更）または `src/components/Layout/`（変更）

---

### T-5: ショートカット一覧モーダル（3-C-2）

**WBSリファレンス**: 3-C-2

- [ ] `src/components/KeyboardShortcuts/ShortcutsModal.tsx` を新規作成
  - [ ] Radix UI `Dialog.Root` でモーダル実装
  - [ ] `SHORTCUTS` をカテゴリ別にグループ化して表示
  - [ ] キーバッジを `⌘` / `Ctrl` / `⇧` 等の記号で表示
- [ ] `?` キーでモーダルの open/close が切り替わる
- [ ] `Esc` でモーダルが閉じる
- [ ] `npm run lint` でエラーなし

**対象ファイル:**
- `src/components/KeyboardShortcuts/ShortcutsModal.tsx`（新規）
- `src/App.tsx`（変更：`ShortcutsModal` のマウント）

---

### T-6: 結合テスト・マージ

**WBSリファレンス**: 3-C-1, 3-C-2

- [ ] `npx tauri dev` でアプリ起動確認
- [ ] 手動テスト全項目 OK（testing.md 参照）
- [ ] `npm run lint` がエラーなし
- [ ] `cd src-tauri && cargo test` がパス（Rustは変更なしだが念のため）
- [ ] `feature/3-C-keyboard-shortcuts` → `develop` へマージ

**ブランチ**: `feature/3-C-keyboard-shortcuts`

---

## 完了条件

- [ ] 全タスクが完了
- [ ] `npm run lint` がエラーなし
- [ ] 手動テストが全件OK
- [ ] `Cmd+T` / `Cmd+W` / `Cmd+\` / `?` キーが動作する
- [ ] ショートカット一覧モーダルが正しく表示される
- [ ] ターミナル入力中にショートカットが誤発動しない
- [ ] `develop` ブランチへのマージ済み
