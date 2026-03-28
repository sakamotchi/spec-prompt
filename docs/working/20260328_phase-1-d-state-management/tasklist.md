# タスクリスト - Phase 1-D: 状態管理基盤（Zustand persist）

## 進捗サマリー

| 状態 | 件数 |
|------|------|
| 完了 | 3 |
| 進行中 | 0 |
| 未着手 | 0 |

## タスク一覧

### T-1: 要件定義・設計

- [x] 要件定義書の作成 (`requirements.md`)
- [x] 設計書の作成 (`design.md`)
- [x] レビュー完了

**WBSリファレンス**: Phase 1-D 準備作業

---

### T-2: `appStore` に persist を追加

**WBSリファレンス**: 1-D-3

- [x] `zustand/middleware` から `persist` / `createJSONStorage` をインポート
- [x] `create<AppState>()(persist(...))` の形に変更
- [x] `partialize` で `fileTree` を除外
- [x] `replacer` / `reviver` で `Set<string>` のシリアライズ対応
- [x] ストレージキーを `'spec-prompt-app-store'` に設定
- [x] `appStore.test.ts` に persist のテストを追加
  - [x] `projectRoot` が localStorage に保存される
  - [x] `expandedDirs` の Set が正しく変換される
  - [x] `fileTree` は保存されない
- [x] `mainLayout` / `toggleMainLayout` の未実装を修正
- [x] `npm run lint` でエラーなし
- [x] `npm run test` がパス（16テスト）

**対象ファイル**:
- `src/stores/appStore.ts`
- `src/stores/appStore.test.ts`

---

### T-3: 結合・手動テスト・マージ

- [x] `npx tauri dev` でアプリ起動確認
- [x] 手動テスト全項目 OK（testing.md 参照）
- [x] `npm run test` がパス
- [x] `npm run lint` がエラーなし
- [x] `feature/1-D-state-management` → `develop` へマージ

**ブランチ**: `feature/1-D-state-management`

---

## 完了条件

- [x] 全タスクが完了
- [x] `npm run lint` がエラーなし
- [x] `npm run test` がパス（persist テスト含む）
- [x] 手動テスト（testing.md）が全件 OK
- [x] アプリ再起動後にプロジェクト・選択ファイル・展開状態が復元される
- [x] `develop` ブランチへのマージ済み
