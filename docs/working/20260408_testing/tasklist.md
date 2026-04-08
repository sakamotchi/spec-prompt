# タスクリスト - Phase 4-B: テスト整備

## 進捗サマリー

| 状態 | 件数 |
|------|------|
| 完了 | 1 |
| 進行中 | 0 |
| 未着手 | 4 |

## タスク一覧

### T-1: 要件定義・設計

- [x] 要件定義書の作成 (`requirements.md`)
- [x] 設計書の作成 (`design.md`)
- [x] レビュー完了

**WBSリファレンス**: Phase 4-B 準備作業

---

### T-2: Rust ユニットテスト確認・補完（4-B-1）

**WBSリファレンス**: 4-B-1

- [ ] `cd src-tauri && cargo test` を実行し全件パスを確認
- [ ] `pty.rs` のチルダ展開ロジックをヘルパー関数 `resolve_cwd` に抽出
- [ ] `resolve_cwd` の単体テストを `pty.rs` の `#[cfg(test)]` ブロックに追加
  - `~` → `$HOME` に展開されること
  - `~/sub/dir` → `$HOME/sub/dir` に展開されること
  - `/absolute/path` → そのまま返すこと
  - `HOME` 環境変数がない場合にクラッシュしないこと
- [ ] `cargo test` でエラーなし

**対象ファイル:**
- `src-tauri/src/commands/pty.rs`（変更）

---

### T-3: フロントエンドユーティリティテスト追加（4-B-2 一部）

**WBSリファレンス**: 4-B-2

- [ ] `src/lib/frontmatter.test.ts` を新規作成
  - `parseStatus`: フロントマターあり・なし、各ステータス値、不正値
  - `setStatus`: 新規追加、既存ステータス更新、フロントマターなしのファイルへ追加
- [ ] `src/lib/windowSession.test.ts` を新規作成
  - `saveMySession`: localStorage にキーが書き込まれること
  - `loadWindowSessions`: 統合セッション・per-window キー両方を読み取ること
  - `consolidateAndSave`: per-window キーを統合して consolidated キーに保存すること
  - `clearWindowSessions`: 全キーが削除されること
- [ ] `npm test` でエラーなし

**対象ファイル:**
- `src/lib/frontmatter.test.ts`（新規）
- `src/lib/windowSession.test.ts`（新規）

---

### T-4: React コンポーネントテスト追加（4-B-2 一部）

**WBSリファレンス**: 4-B-2

- [ ] `src/components/ContentView/ContentView.test.tsx` を新規作成
  - `@tauri-apps/api/core` と `react-i18next` を `vi.mock` でスタブ
  - ファイル未選択時に `content.empty` キーの文字列が表示されること
  - `isLoading=true` 時に `content.loading` キーの文字列が表示されること
- [ ] `src/components/TreePanel/InlineInput.test.tsx` を新規作成
  - テキスト入力が反映されること
  - Enter キーで `onCommit` が呼ばれること
  - Escape キーで `onCancel` が呼ばれること
- [ ] `npm test` でエラーなし

**対象ファイル:**
- `src/components/ContentView/ContentView.test.tsx`（新規）
- `src/components/TreePanel/InlineInput.test.tsx`（新規）

---

### T-5: 動作確認・ドキュメント更新

**WBSリファレンス**: 4-B-2 完了確認

- [ ] `npm test` で全テストパス（既存 75件 + 追加分）
- [ ] `cd src-tauri && cargo test` で全テストパス
- [ ] `npm run lint` でエラーなし
- [ ] tasklist・testing.md を更新

**ブランチ**: `feature/4-B-testing`

---

## 完了条件

- [ ] 全タスクが完了
- [ ] `npm test` がエラーなし（追加テストを含む）
- [ ] `cd src-tauri && cargo test` がエラーなし
- [ ] `npm run lint` がエラーなし
- [ ] `develop` ブランチへのマージ済み
