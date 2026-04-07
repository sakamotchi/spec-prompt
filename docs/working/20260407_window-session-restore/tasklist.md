# タスクリスト - Phase 3-H: ウィンドウセッション復元

## 進捗サマリー

| 状態 | 件数 |
|------|------|
| 完了 | 4 |
| 進行中 | 0 |
| 未着手 | 0 |

## タスク一覧

### T-1: 要件定義・設計

- [x] 要件定義書の作成 (`requirements.md`)
- [x] 設計書の作成 (`design.md`)
- [x] レビュー完了

**WBSリファレンス**: Phase 3-H 準備作業

---

### T-2: windowSession ユーティリティ実装（3-H-1）

**WBSリファレンス**: 3-H-1

- [x] `src/lib/windowSession.ts` を新規作成
  - `WindowSession` 型定義
  - `saveWindowSessions()` 実装
  - `loadWindowSessions()` 実装
  - `clearWindowSessions()` 実装
- [x] `npm run lint` でエラーなし

**対象ファイル:**
- `src/lib/windowSession.ts`（新規）

---

### T-3: ウィンドウ開閉フックとセッション更新（3-H-3）

**WBSリファレンス**: 3-H-3

- [x] `src/components/TreePanel/TreePanel.tsx` に `onCloseRequested` フックを追加
  - ウィンドウ label が `"main"` 以外のとき、閉じる前にセッションから自分を削除
  - メインウィンドウが閉じるとき `clearWindowSessions()` を呼び出す
- [x] `src/lib/tauriApi.ts` の `openNewWindow` でセッションへの追加処理を実装（`addWindowSession` 呼び出し）
- [x] `npm run lint` でエラーなし

**対象ファイル:**
- `src/components/TreePanel/TreePanel.tsx`（変更）
- `src/lib/tauriApi.ts`（変更）

---

### T-4: 起動時のウィンドウ復元（3-H-2）と動作確認

**WBSリファレンス**: 3-H-2, 3-H-3

- [x] `src/main.tsx` にセッション復元処理を追加
  - クエリパラメータ（`?project=` / `?new=1`）がない場合のみ実行
  - `loadWindowSessions()` → `tauriApi.openNewWindow()` で各ウィンドウを復元
- [x] `npx tauri dev` でアプリ起動確認
- [x] 手動テスト全項目 OK（testing.md 参照）
- [x] `npm run lint` でエラーなし

**対象ファイル:**
- `src/main.tsx`（変更）

**ブランチ**: `feature/3-H-window-session-restore`

---

## 完了条件

- [x] 全タスクが完了
- [x] `npm run lint` がエラーなし
- [x] 手動テストが全件 OK
- [x] 複数ウィンドウでアプリを終了 → 再起動で同数のウィンドウが復元される
- [x] 存在しないプロジェクトパスが保存されていても、アプリがクラッシュしない
- [x] `develop` ブランチへのマージ済み
