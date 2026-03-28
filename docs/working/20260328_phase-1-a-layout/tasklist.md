# タスクリスト - Phase 1-A: 全体レイアウト

## 進捗サマリー

| 状態 | 件数 |
|------|------|
| 完了 | 5 |
| 進行中 | 0 |
| 未着手 | 1 |

## タスク一覧

### T-0: UIライブラリ・デザイン基盤セットアップ ✅

**WBSリファレンス**: Phase 1-A 準備作業（UI方針決定）

- [x] `@radix-ui/react-tabs` をインストール
- [x] `lucide-react` をインストール
- [x] `zustand` をインストール
- [x] `src/index.css` に Geist フォントの import を追加
- [x] `src/index.css` に CSS カスタムプロパティ（カラーパレット）を定義
- [x] `npx tauri dev` でフォント・カラーが適用されることを目視確認

**対象ファイル**:
- `src/index.css`
- `package.json`（自動更新）

---

### T-1: 要件定義・設計 ✅

- [x] 要件定義書の作成 (`requirements.md`)
- [x] 設計書の作成 (`design.md`)
- [x] レビュー完了

**WBSリファレンス**: Phase 1-A 準備作業

---

### T-2: appStore の `activeMainTab` 実装 ✅

**WBSリファレンス**: 1-A-3（一部）、1-D-1（先行実装）

- [x] `src/stores/appStore.ts` を作成
- [x] `MainTab` 型 (`'content' | 'terminal'`) を定義
- [x] `activeMainTab` と `setActiveMainTab` を実装
- [x] `npm run lint` でエラーなし

**対象ファイル**:
- `src/stores/appStore.ts`

---

### T-3: SplitPane コンポーネント実装 ✅

**WBSリファレンス**: 1-A-1, 1-A-2

- [x] `src/components/SplitPane/SplitPane.tsx` を作成
- [x] `direction="horizontal"` の水平分割を実装
- [x] `defaultSize` / `minSize` / `maxSize` props を実装
- [x] セパレーターのドラッグリサイズを実装（`mousedown` / `mousemove` / `mouseup`）
- [x] ドラッグ中に `document.body.style.userSelect = 'none'` でテキスト選択を防止
- [x] ホバー時のセパレーターハイライトを実装（`--color-accent`）
- [x] `col-resize` / `row-resize` カーソルをドラッグ中に適用
- [x] Vitest テスト作成（2テスト）
- [x] `npm run lint` でエラーなし

**対象ファイル**:
- `src/components/SplitPane/SplitPane.tsx`
- `src/components/SplitPane/SplitPane.test.tsx`
- `src/components/SplitPane/index.ts`

---

### T-4: AppLayout + MainTabs + MainArea 実装 ✅

**WBSリファレンス**: 1-A-1, 1-A-3

- [x] `src/components/Layout/AppLayout.tsx` を作成（SplitPane を使った2カラム構成）
- [x] `src/components/MainArea/MainArea.tsx` を作成（MainTabs + コンテンツエリア）
- [x] `src/components/MainArea/MainTabs.tsx` を作成
  - [x] Radix UI `Tabs` プリミティブをベースに実装
  - [x] タブクリックで `setActiveMainTab` を呼ぶ
  - [x] `Ctrl+Tab` キーバインドを `useEffect` で登録・解除
  - [x] アクティブタブを `--color-accent` ボーダーボトムで強調
  - [x] 非アクティブタブは `--color-text-muted` で表示
- [x] `src/App.tsx` で `AppLayout` を組み込む
- [x] Vitest テスト作成（appStore 3テスト）
- [x] Vitest セットアップ（`vitest`・`@testing-library/react`・`@testing-library/jest-dom` インストール、`vite.config.ts` 設定）
- [x] `npm run test` でエラーなし（5テスト全件パス）
- [x] `npm run lint` でエラーなし

**対象ファイル**:
- `src/components/Layout/AppLayout.tsx`
- `src/components/Layout/index.ts`
- `src/components/MainArea/MainArea.tsx`
- `src/components/MainArea/MainTabs.tsx`
- `src/components/MainArea/index.ts`
- `src/stores/appStore.test.ts`
- `src/test/setup.ts`
- `src/App.tsx`
- `vite.config.ts`

---

### T-5: 結合・手動テスト・マージ

- [x] `npx tauri dev` でアプリ起動確認
- [x] 手動テスト全項目 OK（testing.md 参照）
- [x] `npm run lint` がエラーなし
- [ ] `develop` ブランチへのコミット・マージ

**ブランチ**: `develop`（直接コミット）

---

## 完了条件

- [x] 全タスクが完了
- [x] `npm run lint` がエラーなし
- [x] Vitest テストがパス（`npm run test`）
- [x] 手動テスト（testing.md）が全件 OK
- [x] `npx tauri dev` でアプリが起動し、2カラムレイアウト・リサイズ・タブ切り替えが動作する
- [ ] `develop` ブランチへのコミット済み
