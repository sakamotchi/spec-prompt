# タスクリスト - Phase 2-A: コンテンツビューア

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

**WBSリファレンス**: Phase 2-A 準備作業

---

### T-2: npm パッケージインストール

**WBSリファレンス**: 2-A 前準備

- [x] `unified`, `remark-parse`, `remark-gfm`, `remark-rehype`, `rehype-stringify` インストール
- [x] `@shikijs/rehype`, `shiki` インストール
- [x] `mermaid` インストール
- [x] `@tauri-apps/plugin-opener` インストール
- [x] `npm run lint` でエラーなし

---

### T-3: `contentStore.ts` + `viewMode.ts` 実装

**WBSリファレンス**: 2-A-7

- [x] `src/stores/contentStore.ts` を新規作成
- [x] `src/lib/viewMode.ts` を新規作成
- [x] `getViewMode` の単体テスト作成（12ケース）
- [x] `npm run lint` でエラーなし

**対象ファイル:**
- `src/stores/contentStore.ts`（新規）
- `src/lib/viewMode.ts`（新規）
- `src/lib/viewMode.test.ts`（新規）

---

### T-4: コンポーネント実装

**WBSリファレンス**: 2-A-1, 2-A-2, 2-A-3, 2-A-4, 2-A-5, 2-A-6

- [x] `src/lib/markdown.ts` を新規作成（unified パイプライン）
- [x] `ContentView.tsx` を新規作成
- [x] `MarkdownPreview.tsx` を新規作成（Mermaid 動的インポート対応）
- [x] `CodeViewer.tsx` を新規作成（Shiki シンタックスハイライト）
- [x] `PlainTextViewer.tsx` を新規作成
- [x] `src/components/ContentView/index.ts` を新規作成
- [x] `npm run lint` でエラーなし

> **トラブルシュート**: `@tauri-apps/plugin-opener` の `open` は存在せず `openUrl` が正しい名前。修正済み。

**対象ファイル:**
- `src/lib/markdown.ts`（新規）
- `src/components/ContentView/ContentView.tsx`（新規）
- `src/components/ContentView/MarkdownPreview.tsx`（新規）
- `src/components/ContentView/CodeViewer.tsx`（新規）
- `src/components/ContentView/PlainTextViewer.tsx`（新規）
- `src/components/ContentView/index.ts`（新規）

---

### T-5: `MainArea.tsx` への組み込み

**WBSリファレンス**: 2-A 統合

- [x] `MainArea.tsx` の `contentNode` プレースホルダーを `<ContentView />` に差し替え
- [x] `npm run lint` でエラーなし
- [x] `npx tauri dev` で動作確認

**対象ファイル:**
- `src/components/MainArea/MainArea.tsx`（変更）

---

### T-6: 結合・手動テスト・マージ

- [x] `npx tauri dev` でアプリ起動確認
- [x] 手動テスト全項目 OK（testing.md 参照）
- [x] `npm run test` がパス（28テスト）
- [x] `npm run lint` がエラーなし
- [x] `feature/2-A-content-viewer` → `develop` へマージ

**ブランチ**: `feature/2-A-content-viewer`

---

## 完了条件

- [x] 全タスクが完了
- [x] `npm run lint` がエラーなし
- [x] `npm run test` がパス
- [x] 手動テスト（testing.md）が全件 OK
- [x] ファイルツリーで MD ファイルを選択するとプレビューが表示される
- [x] ファイルツリーで TS/RS ファイルを選択するとシンタックスハイライトが表示される
- [x] Mermaid コードブロックが SVG 図として表示される
- [x] `develop` ブランチへのマージ済み
