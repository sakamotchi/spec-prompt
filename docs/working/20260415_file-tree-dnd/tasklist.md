# タスクリスト - file-tree-dnd

## 進捗サマリー

| 状態 | 件数 |
|------|------|
| 完了 | 22 |
| 進行中 | 0 |
| 未着手 | 0 |

## タスク一覧

### T-1: 要件定義・設計

- [x] 要件定義書の作成（`requirements.md`）
- [x] 設計書の作成（`design.md`）
- [x] 実装時の知見を設計書へ反映（macOS での HTML5 + Tauri ハイブリッド方式）

### T-2: 設定切替（Tauri 設定）

- [x] `src-tauri/tauri.conf.json` の `app.windows[0].dragDropEnabled` を `true` に変更
- [x] 既存 HTML5 file drop に依存している箇所がないことを確認

### T-3: バックエンド（Rust `copy_path`）

- [x] `src-tauri/src/commands/filesystem.rs` に `copy_path` を実装（ファイル単体・ディレクトリ再帰・衝突エラー）
- [x] `tokio::task::spawn_blocking` で I/O を別スレッド化
- [x] `src-tauri/src/lib.rs` の `invoke_handler` に登録
- [x] Rust テスト追加（ファイル / ディレクトリ再帰 / 衝突 / ソース不在）
- [x] `cd src-tauri && cargo test` がパス（104 件）

### T-4: フロントエンド（共通基盤）

- [x] `src/lib/tauriApi.ts` に `copyPath(src, destDir)` ラッパー追加
- [x] `src/stores/appStore.ts` に `dragOverPath` / `internalDragPaths` 追加
- [x] `src/hooks/useTreeDnd.ts` を新設（`handleInternalDrop` / `handleExternalDrop` / 自己・子孫判定 / 確認ダイアログ呼び出し）
- [x] 結果トースト基盤を `src/components/Toast/` に最小実装で新設

### T-5: フロントエンド（内部 DnD）

- [x] `TreeNode.tsx` に `draggable`、`data-tree-node`/`data-is-dir`/`data-path` 属性を付与
- [x] `onDragStart`／`onDragEnd`／`onDragOver`／`onDragLeave`／`onDrop` を実装
- [x] `TreePanel.tsx` のツリー余白領域にも drop ハンドラを付与（ルート直下移動）
- [x] `appStore.internalDragPaths` により内部ドラッグ状態を共有

### T-6: フロントエンド（外部 DnD）

- [x] `TreePanel.tsx` 起動時に `getCurrentWebview().onDragDropEvent` を 1 度だけ登録（cleanup あり）
- [x] `over` / `drop` / `leave` をハンドリング
- [x] `elementFromPoint(position)` → `closest('[data-tree-node][data-is-dir="true"]')` でドロップ先を逆引き
- [x] 座標系揺れ（macOS は CSS ピクセル、他環境は physical）への対応：両方試す
- [x] プロジェクト未オープン時は早期 return

### T-7: i18n と確認ダイアログ

- [x] `src/i18n/locales/{en,ja}.json` にダイアログ／トースト文言を追加
- [x] 件数しきい値ベースで確認ダイアログを起動するロジックを `useTreeDnd` に追加
- [x] 確認ダイアログコンポーネント `ConfirmDropDialog` を新設

### T-8: 結合・テスト

- [x] `useTreeDnd` 単体テスト（自己／子孫判定、basename/dirname）
- [x] `npm run build` / `npx vitest run` / `cargo test` がすべてパス
- [x] 手動テスト（実機 macOS で内部ドラッグ移動を確認）

### T-9: ドキュメント・マージ

- [x] `develop` ブランチへの PR 作成・マージ相当（main へマージ）

## 完了条件

- [ ] 全タスクが完了
- [ ] `npm run lint` がエラーなし
- [ ] `npm run build`（型チェック含む）がエラーなし
- [ ] `cd src-tauri && cargo test` がパス
- [ ] `cd src-tauri && cargo check` がパス
- [ ] `testing.md` の手動テストが全件 OK
- [ ] 永続化ドキュメントが更新済み
