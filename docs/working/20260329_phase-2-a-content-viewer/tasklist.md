# タスクリスト - Phase 2-A: コンテンツビューア

## 進捗サマリー

| 状態 | 件数 |
|------|------|
| 完了 | 0 |
| 進行中 | 0 |
| 未着手 | 5 |

## タスク一覧

### T-1: 要件定義・設計

- [x] 要件定義書の作成 (`requirements.md`)
- [x] 設計書の作成 (`design.md`)
- [x] レビュー完了

**WBSリファレンス**: Phase 2-A 準備作業

---

### T-2: npm パッケージインストール

**WBSリファレンス**: 2-A 前準備

- [ ] `unified`, `remark-parse`, `remark-gfm`, `remark-rehype`, `rehype-stringify` インストール
- [ ] `@shikijs/rehype`, `shiki` インストール
- [ ] `mermaid` インストール
- [ ] `npm run lint` でエラーなし

**コマンド（予定）:**
```bash
npm install unified remark-parse remark-gfm remark-rehype rehype-stringify
npm install @shikijs/rehype shiki
npm install mermaid
```

---

### T-3: `contentStore.ts` + `viewMode.ts` 実装

**WBSリファレンス**: 2-A-7

- [ ] `src/stores/contentStore.ts` を新規作成
  - `filePath`, `content`, `viewMode`, `isLoading` の状態
  - `setFile`, `setLoading`, `clear` アクション
- [ ] `src/lib/viewMode.ts` を新規作成
  - `getViewMode(filePath): ViewMode` ユーティリティ
  - `MARKDOWN_EXTS`, `CODE_EXTS` の定数定義
- [ ] `getViewMode` の単体テスト作成
- [ ] `npm run lint` でエラーなし

**対象ファイル:**
- `src/stores/contentStore.ts`（新規）
- `src/lib/viewMode.ts`（新規）

---

### T-4: コンポーネント実装

**WBSリファレンス**: 2-A-1, 2-A-2, 2-A-3, 2-A-4, 2-A-5, 2-A-6

- [ ] `src/lib/markdown.ts` を新規作成（unified パイプライン）
- [ ] `ContentView.tsx` を新規作成
  - `appStore.selectedFile` の変化を監視
  - `invoke('read_file', { path })` でファイル読み込み
  - `viewMode` に応じて表示コンポーネントを切り替え
- [ ] `MarkdownPreview.tsx` を新規作成
  - unified パイプラインで MD → HTML 変換
  - `dangerouslySetInnerHTML` で表示
  - Mermaid コードブロックを動的インポートでレンダリング
- [ ] `CodeViewer.tsx` を新規作成
  - Shiki で行番号付きシンタックスハイライト
  - 読み取り専用表示
- [ ] `PlainTextViewer.tsx` を新規作成
  - Geist Mono フォントで等幅表示
- [ ] `src/components/ContentView/index.ts` を新規作成
- [ ] `npm run lint` でエラーなし

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

- [ ] `MainArea.tsx` の `contentNode` プレースホルダーを `<ContentView />` に差し替え
- [ ] `npm run lint` でエラーなし
- [ ] `npx tauri dev` で動作確認

**対象ファイル:**
- `src/components/MainArea/MainArea.tsx`（変更）

---

### T-6: 結合・手動テスト・マージ

- [ ] `npx tauri dev` でアプリ起動確認
- [ ] 手動テスト全項目 OK（testing.md 参照）
- [ ] `npm run test` がパス
- [ ] `npm run lint` がエラーなし
- [ ] `feature/2-A-content-viewer` → `develop` へマージ

**ブランチ**: `feature/2-A-content-viewer`

---

## 完了条件

- [ ] 全タスクが完了
- [ ] `npm run lint` がエラーなし
- [ ] `npm run test` がパス
- [ ] 手動テスト（testing.md）が全件 OK
- [ ] ファイルツリーで MD ファイルを選択するとプレビューが表示される
- [ ] ファイルツリーで TS/RS ファイルを選択するとシンタックスハイライトが表示される
- [ ] Mermaid コードブロックが SVG 図として表示される
- [ ] `develop` ブランチへのマージ済み
