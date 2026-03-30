# タスクリスト - Phase 2-B: ファイル監視・自動更新

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

**WBSリファレンス**: Phase 2-B 準備作業

---

### T-2: `watcher.rs` 実装（バックエンド）

**WBSリファレンス**: 2-B-1

- [ ] `src-tauri/src/watcher.rs` を新規作成
  - `start_watching(app, path)` 関数の実装
  - `IGNORE_DIRS` による除外フィルタ
  - デバウンス（300ms）設定
  - 変更検知時に `file-changed` イベントを emit
- [ ] `src-tauri/src/commands/filesystem.rs` に `watch_fs` コマンドを追加
- [ ] `src-tauri/src/lib.rs` に `watcher` モジュールと `watch_fs` コマンドを登録
- [ ] `cargo check` でエラーなし
- [ ] `cargo test` がパス（除外フィルタのユニットテスト）

**対象ファイル:**
- `src-tauri/src/watcher.rs`（新規）
- `src-tauri/src/commands/filesystem.rs`（変更）
- `src-tauri/src/lib.rs`（変更）

---

### T-3: コンテンツビューア自動更新（フロントエンド）

**WBSリファレンス**: 2-B-2

- [ ] `ContentView.tsx` に `file-changed` イベントリスナーを追加
  - `contentStore.filePath` と一致する場合に `read_file` を再呼び出し
  - アンマウント時にリスナーを解除（`unlisten`）
- [ ] `npm run lint` でエラーなし

**対象ファイル:**
- `src/components/ContentView/ContentView.tsx`（変更）

---

### T-4: ファイルツリー自動更新（フロントエンド）

**WBSリファレンス**: 2-B-3

- [ ] `appStore.ts` の `setProjectRoot` に `watch_fs` 呼び出しを追加
- [ ] `appStore.ts` に `file-changed` イベントリスナーを追加
  - イベント受信時に `read_dir` を再呼び出して `fileTree` を更新
- [ ] `npm run lint` でエラーなし

**対象ファイル:**
- `src/stores/appStore.ts`（変更）

---

### T-5: 結合・手動テスト・マージ

- [ ] `npx tauri dev` でアプリ起動確認
- [ ] 手動テスト全項目 OK（testing.md 参照）
- [ ] `npm run test` がパス
- [ ] `npm run lint` がエラーなし
- [ ] `cargo test` がパス
- [ ] `feature/2-B-file-watcher` → `develop` へマージ

**ブランチ**: `feature/2-B-file-watcher`

---

## 完了条件

- [ ] 全タスクが完了
- [ ] `npm run lint` がエラーなし
- [ ] `npm run test` がパス
- [ ] `cargo test` がパス
- [ ] 手動テスト（testing.md）が全件 OK
- [ ] 外部エディタでファイルを保存するとコンテンツビューアが自動更新される
- [ ] ファイル追加・削除でファイルツリーが自動更新される
- [ ] `develop` ブランチへのマージ済み
