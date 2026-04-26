# タスクリスト - mermaid-error-display

## 進捗サマリー

| 状態 | 件数 |
|------|------|
| 完了 | 4 |
| 進行中 | 1 |
| 未着手 | 0 |

## タスク一覧

### T-1: 要件定義・設計

- [x] `requirements.md` の作成
- [x] `design.md` の作成
- [x] ユーザーレビュー完了

### T-2: 実装（フロントエンド）

- [x] `src/components/ContentView/MarkdownPreview.tsx` の Mermaid `useEffect` catch 句を実装変更
  - [x] エラーメッセージ取得（`err instanceof Error ? err.message : String(err)`）
  - [x] HTML エスケープヘルパの用意
  - [x] `<pre>` をエラーパネル DOM に `outerHTML` で置換
  - [x] Mermaid が残す一時要素（`#<id>`, `#d<id>`）の掃除
- [x] `src/index.css` にエラーパネル用スタイルを追加（`.mermaid-error*`）
  - [x] ライト/ダーク双方で視認できるカラー指定
  - [x] 長文エラーメッセージの折り返し（`white-space: pre-wrap`）

### T-3: 動作確認

- [x] `npx tauri dev` で起動
- [x] 構文エラー入りの `.md` を開いてエラーパネルが表示されることを確認
- [x] 正常な Mermaid が従来どおり SVG 描画されることを確認（回帰チェック）
- [x] 同一ファイル内に正常/エラーが混在するケースを確認
- [x] ライト/ダークテーマで見た目を確認

### T-4: 静的解析・テスト

- [x] `npm run lint` がエラーなし
- [x] `npm run build`（または `tsc --noEmit`）で TypeScript エラーなし
- [x] `cd src-tauri && cargo check`（影響なしの確認）

### T-5: ドキュメント・マージ

- [ ] `docs/steering/features/content-viewer.md` の `CV-02` にエラー時挙動を追記
- [ ] コミット
- [ ] プッシュ・PR 作成
- [ ] レビュー対応・マージ

## 完了条件

- [ ] 全タスクが完了
- [ ] `npm run lint` がエラーなし
- [ ] `testing.md` の手動テストが全件 OK
- [ ] 既存 Mermaid 描画に回帰がない
- [ ] 永続化ドキュメントが更新済み（必要な場合）
