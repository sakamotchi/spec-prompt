# タスクリスト - Phase 2-C: タブ・分割表示

## 進捗サマリー

| 状態 | 件数 |
|------|------|
| 完了 | 6 |
| 進行中 | 0 |
| 未着手 | 0 |

## タスク一覧

### T-1: 要件定義・設計

- [x] 要件定義書の作成 (`requirements.md`)
- [x] 設計書の作成 (`design.md`)
- [x] レビュー完了

**WBSリファレンス**: Phase 2-C 準備作業

---

### T-2: コンテンツタブ実装

**WBSリファレンス**: 2-C-1

- [x] `contentStore.ts` をタブ配列対応に変更
  - `ContentTab` 型定義
  - `tabs`, `activeTabId` に変更
  - `addTab`, `closeTab`, `setActiveTab`, `setFile`, `setLoading` を実装
- [x] `ContentView.tsx` をタブ対応に変更
  - `contentStore` からアクティブタブを参照する形に変更
  - ファイル選択時に `openFile` を呼ぶよう連携を変更
- [x] `ContentTabBar.tsx` を新規作成
  - タブ一覧表示、アクティブタブ切り替え、タブ閉じるボタン
  - 分割ボタン（`Columns2` アイコン）
- [x] VS Code スタイルの空タブ再利用（初回ファイル選択で空タブを置き換え）
- [x] `npm run lint` でエラーなし

**対象ファイル:**
- `src/stores/contentStore.ts`（変更）
- `src/components/ContentView/ContentView.tsx`（変更）
- `src/components/ContentView/ContentTabBar.tsx`（新規）

---

### T-3: コンテンツ分割表示実装

**WBSリファレンス**: 2-C-2

- [x] `contentStore.ts` に独立グループ構造を追加
  - `primary: ContentGroup`, `secondary: ContentGroup`
  - `focusedPane`, `splitEnabled`, `toggleSplit`
- [x] `ContentArea.tsx` を新規作成（分割レイアウト管理、ファイル監視）
- [x] `ContentPane` コンポーネント（タブバー + ContentView の単位）
- [x] `MainArea.tsx` で `ContentArea` を使用
- [x] ドラッグリサイズ対応（セパレーター）
- [x] フォーカスペイン表示（アクセントカラーのボーダー）
- [x] `npm run lint` でエラーなし

**対象ファイル:**
- `src/stores/contentStore.ts`（変更）
- `src/components/ContentView/ContentArea.tsx`（新規）
- `src/components/ContentView/index.ts`（変更）
- `src/components/MainArea/MainArea.tsx`（変更）

---

### T-4: ターミナルタブ確認（実装済み）

**WBSリファレンス**: 2-C-3（Phase 1-C-7 で実装済み）

- [x] 複数ターミナルをタブで開ける
- [x] タブ追加・閉じる操作ができる

---

### T-5: ターミナル分割表示実装（独立グループ）

**WBSリファレンス**: 2-C-4

- [x] `terminalStore.ts` に独立グループ構造を追加
  - `primary: TerminalGroup`, `secondary: TerminalGroup`
  - `addTab(pane)`, `closeTab(id, pane)`, `setActiveTab(id, pane)`, `toggleSplit`
- [x] `TerminalTabs.tsx` を独立グループ対応に変更
  - `TerminalPane` コンポーネント（各ペインが独立したタブ管理）
  - `display: none` 常時マウント方式で PTY セッションを維持
  - 分割ボタン（プライマリペインのみ）、タブ追加ボタン（両ペイン）
  - ドラッグリサイズ対応
  - 分割解除後も PTY セッション・表示内容が保持される
- [x] `npm run lint` でエラーなし

**対象ファイル:**
- `src/stores/terminalStore.ts`（変更）
- `src/components/TerminalPanel/TerminalTabs.tsx`（変更）

---

### T-6: 結合・手動テスト・マージ

- [x] `npx tauri dev` でアプリ起動確認
- [x] 手動テスト全項目 OK（testing.md 参照）
- [x] `npm run lint` がエラーなし
- [x] `feature/2-C-tabs-split-view` → `develop` へマージ

**ブランチ**: `feature/2-C-tabs-split-view`

---

## 追加実装（スコープ外）

### タブドラッグ&ドロップ

- [x] コンテンツタブを左右ペイン間でドラッグ移動できる
- [x] ターミナルタブを左右ペイン間でドラッグ移動できる（PTY セッション・履歴保持）
  - `scrollback` バッファをストアで管理し、移動後も表示履歴を復元
  - `pointer-events: none` + 独自 MIME タイプで xterm.js の干渉を防止
- [x] `dragDropEnabled: false`（tauri.conf.json）で HTML5 DnD を有効化

---

## 完了条件

- [x] 全タスクが完了
- [x] `npm run lint` がエラーなし
- [x] 手動テスト（testing.md）が全件 OK
- [x] コンテンツビューアで複数ファイルをタブで開ける
- [x] コンテンツビューアを左右分割できる（独立グループ）
- [x] ターミナルを左右分割できる（独立グループ）
- [x] `develop` ブランチへのマージ済み
