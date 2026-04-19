# タスクリスト - content-tab-scroll-position

関連 Issue: [#9](https://github.com/sakamotchi/spec-prompt/issues/9)
作業ブランチ: `fix/content-tab-scroll-position`

## 進捗サマリー

| 状態 | 件数 |
|------|------|
| 完了 | 5 |
| 進行中 | 0 |
| 未着手 | 0 |

## タスク一覧

### T-1: 要件定義・設計

- [x] `requirements.md` 作成
- [x] `design.md` 作成
- [x] `testing.md` 作成
- [x] 設計レビュー（ユーザー確認）

### T-2: contentStore の拡張

- [x] `ContentTab` 型に `scrollTop: number` を追加
- [x] `makeTab` の既定値に `scrollTop: 0` を追加
- [x] `ContentState` に `setScrollTop(tabId, scrollTop)` を追加・実装
- [x] `useContentStore` の型 `ContentState` を更新
- [x] `setTabContent` / `closeTab` / `moveTab` / `closeTabByPath` / `resetAllTabs` が新フィールドと整合することを確認
- [x] `npm run lint` でエラーなし

### T-3: useTabScroll カスタムフックの実装

- [x] `src/components/ContentView/useTabScroll.ts` を新規作成
- [x] `useLayoutEffect` で `tabId` 変更時に保存済み `scrollTop` を復元
- [x] エフェクトのクリーンアップで現在位置をストアへ保存
- [x] 追加トリガ配列（例: `[html]`）を受け取り、非同期レンダリング後に一度だけ復元する `isRestoringRef` フラグを実装

### T-4: 各ビューアへの組み込み

- [x] `MarkdownPreview.tsx` のスクロールコンテナに `ref` を付与
- [x] `MarkdownPreview.tsx` で `useTabScroll` を呼ぶ（非同期 `html` を追加トリガに指定）
- [x] `CodeViewer.tsx` のスクロールコンテナに `ref` を付与
- [x] `CodeViewer.tsx` で `useTabScroll` を呼ぶ（非同期 `html` を追加トリガに指定）
- [x] `PlainTextViewer.tsx` のスクロールコンテナ（`<pre>`）に `ref` を付与
- [x] `PlainTextViewer.tsx` で `useTabScroll` を呼ぶ
- [x] `ImageViewer.tsx` は対象外（変更なし）
- [x] ビューアの `tabId` を受け取れるよう props を追加（`ContentView.tsx` 経由で渡す）

### T-5: 結合・テスト・マージ

- [x] `npm run lint` がパス
- [x] `npm run build` で TypeScript エラーなし
- [x] `cd src-tauri && cargo check` が通る（バックエンド影響なしの確認）
- [x] `npm test -- --run` がパス（340/340）
- [x] `testing.md` の手動テスト項目をすべて OK（ユーザー確認済み）
- [x] 永続化ドキュメント更新の要否を確認（今回はスクロール位置のタブ内保持という挙動のみ。`features/content-viewer.md` への追記は次回のバッチ更新時にまとめて対応）
- [x] ユーザー承認後に PR 作成・`main` へのマージ

## 完了条件

- [ ] 全タスクが完了
- [ ] `npm run lint` がエラーなし
- [ ] `npm run build` がエラーなし
- [ ] `cd src-tauri && cargo test` がパス
- [ ] `testing.md` の手動テストがすべて OK
- [ ] Issue #9 の再現手順が再現しないこと
- [ ] 回帰: 既存のコンテンツビューア機能（MD / Code / Image / PlainText、タブ切替、分割、ファイル変更再読み込み）が壊れていないこと
