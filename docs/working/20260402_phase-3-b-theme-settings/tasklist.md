# タスクリスト - Phase 3-B: テーマ・外観設定

## 進捗サマリー

| 状態 | 件数 |
|------|------|
| 完了 | 8 |
| 進行中 | 0 |
| 未着手 | 0 |

## タスク一覧

### T-1: 要件定義・設計

- [x] 要件定義書の作成 (`requirements.md`)
- [x] 設計書の作成 (`design.md`)
- [x] レビュー完了

**WBSリファレンス**: Phase 3-B 準備作業

---

### T-2: Rust バックエンド実装

**WBSリファレンス**: 3-B-1, 3-B-2

- [x] `config.rs` に `AppearanceSettings` 構造体を追加（`Default` 実装）
- [x] `Config` 構造体に `appearance: AppearanceSettings` フィールドを追加
- [x] `#[tauri::command] get_appearance` を追加
- [x] `#[tauri::command] save_appearance` を追加
- [x] `lib.rs` に2コマンドを登録
- [x] 既存の `config.json`（`recent_projects` のみ）との後方互換を確認
- [x] Rust ユニットテストを追加
- [x] `cd src-tauri && cargo check` でエラーなし
- [x] `cd src-tauri && cargo test` でパス

**対象ファイル:**
- `src-tauri/src/commands/config.rs`（変更）
- `src-tauri/src/lib.rs`（変更）

---

### T-3: CSS・ライトテーマ定義

**WBSリファレンス**: 3-B-2

- [x] `src/index.css` に `[data-theme="light"]` の CSS カスタムプロパティを追加
- [x] ライトテーマでのマークダウンプレビュースタイルを確認・調整
- [x] ライトテーマでの Shiki コードブロックスタイルを確認

**対象ファイル:**
- `src/index.css`（変更）

---

### T-4: settingsStore + tauriApi

**WBSリファレンス**: 3-B-1〜3-B-5

- [x] `tauriApi.ts` に `getAppearance()` / `saveAppearance(settings)` を追加
- [x] `src/stores/settingsStore.ts` を新規作成
  - [x] `Theme` 型・`AppearanceSettings` 型・`DEFAULT_SETTINGS` 定義
  - [x] `setTheme` / `setContentFontFamily` / `setContentFontSize` / `setTerminalFontFamily` / `setTerminalFontSize` アクション
  - [x] `loadSettings()` / `saveSettings()` アクション
  - [x] `applyTheme()` ヘルパー（`<html data-theme>` 更新）
- [x] `src/main.tsx` で起動時に `loadSettings()` を呼ぶ
- [x] `npm run lint` でエラーなし

**対象ファイル:**
- `src/lib/tauriApi.ts`（変更）
- `src/stores/settingsStore.ts`（新規）
- `src/main.tsx`（変更）

---

### T-5: 設定モーダル UI

**WBSリファレンス**: 3-B-1

- [x] `@radix-ui/react-dialog` をインストール
- [x] `@radix-ui/react-slider` をインストール
- [x] `src/components/Settings/SettingsModal.tsx` を新規作成
  - [x] テーマセクション（dark / light / system ボタン）
  - [x] コンテンツセクション（フォントファミリー入力 + フォントサイズ Slider）
  - [x] ターミナルセクション（フォントファミリー入力 + フォントサイズ Slider）
- [x] `TreePanel.tsx` にギアアイコンボタンを追加
- [x] `npm run lint` でエラーなし

**対象ファイル:**
- `src/components/Settings/SettingsModal.tsx`（新規）
- `src/components/TreePanel/TreePanel.tsx`（変更）

---

### T-6: markdown.ts・MarkdownPreview の Shiki テーマ連動

**WBSリファレンス**: 3-B-4

- [x] `markdown.ts` に `invalidateMarkdownProcessor()` エクスポートを追加
- [x] `renderMarkdown(content, shikiTheme)` の引数に `shikiTheme` を追加
- [x] `MarkdownPreview.tsx` で `settingsStore` の theme から shikiTheme を解決して渡す
- [x] テーマ変更時にプレビューが再レンダリングされることを確認
- [x] `npm run lint` でエラーなし

**対象ファイル:**
- `src/lib/markdown.ts`（変更）
- `src/components/ContentView/MarkdownPreview.tsx`（変更）

---

### T-7: TerminalPanel のテーマ・フォント動的化

**WBSリファレンス**: 3-B-3b, 3-B-5, 3-B-6

- [x] `TerminalPanel.tsx` で `settingsStore` からフォント設定を取得
- [x] フォント変更時にターミナルを再作成してフォントを適用
- [x] テーマ変更時に `terminal.options.theme` を更新
- [x] 起動時の xterm 初期化でも `settingsStore` の値を使用する
- [x] ウィンドウリサイズ時の文字幅ずれを修正（fontSize nudge + RAF）
- [x] フォント変更後にコンテンツビューから切り替えたときの文字幅ずれを修正
- [x] `npm run lint` でエラーなし

**対象ファイル:**
- `src/components/TerminalPanel/TerminalPanel.tsx`（変更）

---

### T-8: 結合・手動テスト・マージ

- [x] `npx tauri dev` でアプリ起動確認
- [x] 手動テスト全項目 OK（testing.md 参照）
- [x] `npm run lint` がエラーなし
- [x] `cd src-tauri && cargo test` がパス
- [x] `feature/3-B-theme-settings` → `develop` へマージ

**ブランチ**: `feature/3-B-theme-settings`

---

## 完了条件

- [x] 全タスクが完了
- [x] `npm run lint` がエラーなし
- [x] `cd src-tauri && cargo test` がパス
- [x] 手動テスト（testing.md）が全件 OK
- [x] ダーク/ライト/システムテーマが切り替わる
- [x] コンテンツフォントが変更できる
- [x] ターミナルフォントが変更できる
- [x] 設定がアプリ再起動後も保持される
- [x] `develop` ブランチへのマージ済み
