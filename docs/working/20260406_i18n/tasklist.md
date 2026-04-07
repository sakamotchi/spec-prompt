# タスクリスト - Phase 3-F: 多言語対応（日本語・英語）

## 進捗サマリー

| 状態 | 件数 |
|------|------|
| 完了 | 5 |
| 進行中 | 0 |
| 未着手 | 1 |

## タスク一覧

### T-1: 要件定義・設計

- [x] 要件定義書の作成 (`requirements.md`)
- [x] 設計書の作成 (`design.md`)
- [x] レビュー完了

**WBSリファレンス**: Phase 3-F 準備作業

---

### T-2: i18n ライブラリ導入・初期化（3-F-1）

**WBSリファレンス**: 3-F-1

- [x] `i18next` / `react-i18next` をインストール
- [x] `src/i18n/index.ts` を作成（i18next 初期化）
- [x] `src/i18n/locales/ja.json` を作成（77件の日本語文字列）
- [x] `src/i18n/locales/en.json` を作成（77件の英語翻訳）
- [x] `src/main.tsx` に `./i18n` インポートと起動時言語同期を追加
- [x] `settingsStore.ts` に `language` フィールドと `setLanguage` アクションを追加
- [x] `npm run lint` でエラーなし

**対象ファイル:**
- `package.json`（変更）
- `src/i18n/index.ts`（新規）
- `src/i18n/locales/ja.json`（新規）
- `src/i18n/locales/en.json`（新規）
- `src/main.tsx`（変更）
- `src/stores/settingsStore.ts`（変更）

---

### T-3: UI 文字列の翻訳キー置き換え（3-F-2）

**WBSリファレンス**: 3-F-2

- [x] `src/lib/shortcuts.ts` — `label` を `labelKey`（翻訳キー）に変更
- [x] `src/components/KeyboardShortcuts/ShortcutsModal.tsx` — `useTranslation` で翻訳
- [x] `src/components/Settings/SettingsModal.tsx` — 全文字列を `t()` に置き換え
- [x] `src/components/TreePanel/TreePanel.tsx` — 全文字列を `t()` に置き換え
- [x] `src/components/TreePanel/TreeNode.tsx` — 全文字列を `t()` に置き換え
- [x] `src/components/TreePanel/ContextMenu.tsx` — 全文字列を `t()` に置き換え
- [x] `src/components/TreePanel/RecentProjectsMenu.tsx` — 全文字列を `t()` に置き換え
- [x] `src/components/TreePanel/DeleteDialog.tsx` — 全文字列を `t()` に置き換え
- [x] `src/components/ContentView/ContentTabBar.tsx` — 全文字列を `t()` に置き換え
- [x] `src/components/MainArea/MainArea.tsx` — 全文字列を `t()` に置き換え
- [x] `src/components/TerminalPanel/TerminalTabs.tsx` — 全文字列を `t()` に置き換え
- [x] `src/components/TerminalPanel/TerminalPanel.tsx` — エラーメッセージを `i18n.t()` に置き換え
- [x] `src/components/PathPalette/PathPalette.tsx` — 全文字列を `t()` に置き換え
- [x] `src/lib/frontmatter.ts` — `DOC_STATUS_LABEL` を削除（`t('docStatus.${status}')` で翻訳）
- [x] `npm run lint` でエラーなし

---

### T-4: 言語切り替えUI（3-F-3）

**WBSリファレンス**: 3-F-3

- [x] `SettingsModal.tsx` に言語セレクター（ボタン）を追加
- [x] 言語切り替えが即時反映されることを確認
- [x] `npm run lint` でエラーなし

**対象ファイル:**
- `src/components/Settings/SettingsModal.tsx`（変更）

---

### T-5: README 日英対応（3-F-4）

**WBSリファレンス**: 3-F-4

- [ ] `README.md` を英語で整備
- [ ] `README.ja.md` を日本語で作成

**対象ファイル:**
- `README.md`（変更）
- `README.ja.md`（新規）

---

### T-6: 動作確認・マージ

**WBSリファレンス**: 3-F-1, 3-F-2, 3-F-3, 3-F-4

- [ ] `npx tauri dev` でアプリ起動確認
- [ ] 手動テスト全項目 OK（testing.md 参照）
- [ ] `npm run lint` がエラーなし
- [ ] `feature/3-F-i18n` → `develop` へマージ

**ブランチ**: `feature/3-F-i18n`

---

## 完了条件

- [ ] 全タスクが完了
- [x] `npm run lint` がエラーなし
- [ ] 手動テストが全件OK
- [ ] 日本語・英語の切り替えが設定モーダルから行える
- [ ] 切り替えが即時反映される（リロード不要）
- [ ] 再起動後も言語設定が維持される
- [ ] `develop` ブランチへのマージ済み
