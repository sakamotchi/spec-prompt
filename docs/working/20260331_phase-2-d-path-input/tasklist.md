# タスクリスト - Phase 2-D: パス入力支援

## 進捗サマリー

| 状態 | 件数 |
|------|------|
| 完了 | 7 |
| 進行中 | 0 |
| 未着手 | 0 |

## タスク一覧

### T-1: 要件定義・設計

- [x] 要件定義書の作成 (`requirements.md`)
- [x] 設計書の作成 (`design.md`)
- [x] レビュー完了

**WBSリファレンス**: Phase 2-D 準備作業

---

### T-2: appStore 拡張・usePathInsertion フック

**WBSリファレンス**: 2-D-5（パス形式切り替え）

- [x] `appStore.ts` に `pathFormat`, `selectedFiles` を追加
  - `pathFormat: 'relative' | 'absolute'`（デフォルト: `'relative'`）
  - `setPathFormat`, `toggleFileSelection`, `clearFileSelection` アクション
  - `pathFormat` を persist 対象に追加
- [x] `src/hooks/usePathInsertion.ts` を新規作成
  - `insertPath(filePath: string | string[])` の実装
  - `pathFormat` に応じた相対/絶対パス変換
  - `terminalStore.primary` のアクティブタブの `ptyId` に書き込み
- [x] `npm run lint` でエラーなし

**対象ファイル:**
- `src/stores/appStore.ts`（変更）
- `src/hooks/usePathInsertion.ts`（新規）

---

### T-3: Ctrl+クリックでパス挿入

**WBSリファレンス**: 2-D-1

- [x] `TreeNode.tsx` に Ctrl/Cmd+クリックのイベントハンドラを追加
  - `onClick` で `e.ctrlKey || e.metaKey` を判定
  - 条件が真の場合 `insertPath(node.path)` を呼び出す
  - 通常クリック（コンテンツ表示）の動作は維持
- [x] `npm run lint` でエラーなし

**対象ファイル:**
- `src/components/TreePanel/TreeNode.tsx`（変更）

---

### T-4: 右クリックコンテキストメニュー

**WBSリファレンス**: 2-D-2

- [x] `@radix-ui/react-context-menu` を依存に追加
- [x] `ContextMenu.tsx` を新規作成
  - Radix UI `ContextMenu.Root` / `ContextMenu.Item` を使用
  - 「パスをターミナルに挿入」メニュー項目
  - 将来の拡張用セパレーター（Phase 2-E: ファイル操作）
- [x] `TreeNode.tsx` を `ContextMenu` でラップ
- [x] `npm run lint` でエラーなし

**対象ファイル:**
- `src/components/TreePanel/ContextMenu.tsx`（新規）
- `src/components/TreePanel/TreeNode.tsx`（変更）

---

### T-5: PathPalette（Ctrl+P 検索パレット）

**WBSリファレンス**: 2-D-3

- [x] `PathPalette.tsx` を新規作成
  - Radix UI `Dialog.Root` / `Dialog.Content` を使用
  - テキスト入力フィールド（自動フォーカス）
  - `fileTree` の平坦化リストから fuzzy 検索（部分一致）
  - 結果一覧（最大100件）、上下キーで選択
  - Enter / クリックでパス挿入・パレット閉じる
  - Esc でパレット閉じる
- [x] `AppLayout.tsx` にグローバル配置
- [x] Ctrl+P / Cmd+P のグローバルキーイベントリスナー追加
- [x] `npm run lint` でエラーなし

**対象ファイル:**
- `src/components/PathPalette/PathPalette.tsx`（新規）
- `src/components/PathPalette/index.ts`（新規）
- `src/components/Layout/AppLayout.tsx`（変更）

---

### T-6: 複数ファイル選択・一括挿入

**WBSリファレンス**: 2-D-4

- [x] `TreeNode.tsx` に Shift+クリック・Ctrl/Cmd+クリックによる複数選択を実装
  - `appStore.selectedFiles` に追加・削除
  - 選択中ノードのハイライト表示
- [x] コンテキストメニューに「選択中のパスをすべて挿入」を追加（複数選択時のみ表示）
  - `insertPath(selectedFiles)` でスペース区切り一括挿入
- [x] `npm run lint` でエラーなし

**対象ファイル:**
- `src/components/TreePanel/TreeNode.tsx`（変更）
- `src/components/TreePanel/ContextMenu.tsx`（変更）

---

### T-7: 結合・手動テスト・マージ

- [x] `npx tauri dev` でアプリ起動確認
- [x] 手動テスト全項目 OK（testing.md 参照）
- [x] `npm run lint` がエラーなし
- [x] `feature/2-D-path-input` → `develop` へマージ

**ブランチ**: `feature/2-D-path-input`

---

## 完了条件

- [x] 全タスクが完了
- [x] `npm run lint` がエラーなし
- [x] 手動テスト（testing.md）が全件 OK
- [x] Ctrl+クリックでパスが挿入される
- [x] 右クリックメニューからパスが挿入される
- [x] Ctrl+P でパレットが開き、検索・挿入できる
- [x] 複数選択・一括挿入ができる
- [x] `develop` ブランチへのマージ済み
