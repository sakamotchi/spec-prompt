# 要件定義書 - prompt-palette-f1

## 概要

プロンプト編集パレットのフェーズ F1（MVP）として、Enter 誤送信を構造的に防ぐ **最小機能のモーダル編集 UI** と **明示送信** を実装する。F1 単独で「複数行プロンプトをパレットで推敲し、Cmd+Enter で安全にアクティブターミナルへ書き込む」が成立するスコープに限定する。

- 元仕様: `docs/local/20260415-プロンプト編集パレット/01_要件定義書.md`, `02_概要設計書.md`, `03_WBS.md`
- WBS 対応: フェーズ F1（F1-1 〜 F1-7）
- 対応する受け入れ基準（元要件 §7）: **1, 2, 3, 4, 5**（当初 14 も対象だったが **F3 に繰越**、2026-04-18）

## 背景・目的

- Claude Code などの対話 CLI は Enter で即時送信されるため、長文プロンプト執筆中の誤確定が頻発している。
- プロンプトの「執筆」と「送信」を UI で明確に分離する最小機能（パレットの開閉・編集・送信）を先行リリースし、早期に実利を得る。
- パス挿入のディスパッチ切替（F2）や下書き・IME・競合整理（F3）は後続フェーズに切り出し、F1 では触れない。

## 要件一覧

### 機能要件

#### F1-1: `promptPaletteStore` 新設（WBS F1-1）

- **説明**: パレットの開閉状態・送信先情報・タブごとの下書きを保持する Zustand ストアを新規追加する。`insertAtCaret` 等のパス挿入連携 API は F2 で追加するため、F1 ではスタブのみ。
- **受け入れ条件**:
  - [ ] `isOpen`, `targetPtyId`, `targetTabName`, `drafts: Record<string, string>` を保持する
  - [ ] `open(ptyId, tabName)` / `close()` / `setDraft(ptyId, value)` / `getDraft(ptyId)` / `clearDraft(ptyId)` が提供される
  - [ ] `persist` ミドルウェアは使用しない（メモリのみ）
  - [ ] ユニットテスト（`promptPaletteStore.test.ts`）で open/close/setDraft/clearDraft の基本動作を検証

#### F1-2: `PromptPalette.tsx` の UI 骨格（WBS F1-2）

- **説明**: Radix `Dialog` で中央モーダルを表示し、ヘッダ・textarea・フッタ（キーヒント + 送信/キャンセルボタン）で構成する。
- **受け入れ条件**:
  - [ ] Radix `Dialog.Root` + `Dialog.Content` でモーダルとして表示される
  - [ ] ヘッダに「プロンプトを編集 → {targetTabName} に送信」が表示される
  - [ ] `<textarea>` は初期 8 行、`resize: vertical`
  - [ ] フッタ左にキーヒント（`Enter: 改行 / Cmd+Enter: 送信 / Esc: 閉じる`）、右に「キャンセル」「送信」ボタン
  - [ ] モーダルオープン時に textarea に自動フォーカス・キャレット末尾
  - [ ] i18n キー `promptPalette.*` が `ja.json` / `en.json` に追加される
  - [ ] Tailwind v4 のカラーパレット（`--color-bg-elevated` 等）を使用

#### F1-3: 送信ロジック（WBS F1-3）

- **説明**: `Cmd+Enter`（macOS）/ `Ctrl+Enter`（Win/Linux）および「送信」ボタンで、本文 + `\n` をアクティブターミナルへ `writePty` で 1 回書き込む。空本文は no-op。
- **受け入れ条件**:
  - [ ] `Cmd+Enter` / `Ctrl+Enter` で送信される（プラットフォーム分岐）
  - [ ] 送信ボタンクリックで送信される
  - [ ] 本文が空 or 空白のみのときは送信ボタンが disable、ショートカットも no-op
  - [ ] 送信成功時に `clearDraft(targetPtyId)` → `close()` → ターミナルへフォーカスを戻す
  - [ ] F1 では `write_pty` 失敗時の詳細トースト対応は行わない（コンソールエラーに留め、F3 で仕上げる）

#### F1-4: `Cmd+Shift+P` グローバルショートカット（WBS F1-4）

- **説明**: `AppLayout.tsx` にグローバル keydown リスナを追加し、アクティブターミナルを解決してパレットを開く。
- **受け入れ条件**:
  - [ ] macOS では `Cmd+Shift+P`、Win/Linux では `Ctrl+Shift+P` でパレットが開く
  - [ ] 既存 `Ctrl+P`（パス検索）とは別キー
  - [ ] アクティブターミナルが解決できないときは no-op
  - [ ] パレット表示中に同ショートカットを再押下しても多重起動しない

#### F1-5: `TabContextMenu.tsx` に「プロンプトを編集...」項目追加（WBS F1-5）

- **説明**: ターミナルタブの右クリックメニュー先頭に「プロンプトを編集...」項目を追加し、クリックでパレットを開く。
- **受け入れ条件**:
  - [ ] 既存項目（リネーム / 自動タイトルに戻す / 閉じる）の先頭に追加される
  - [ ] キーヒント（`Cmd+Shift+P` / `Ctrl+Shift+P`）が表示される
  - [ ] クリック時に対象タブの `ptyId` / タイトルでパレットを開く

#### F1-6: `PromptPalette.test.tsx`（WBS F1-6）

- **説明**: パレット UI の基本動作を vitest + @testing-library/react で検証する。
- **受け入れ条件**:
  - [ ] ドラフトからの初期値ロードを検証
  - [ ] `Enter` で改行（送信しない）を検証
  - [ ] `Cmd+Enter` / `Ctrl+Enter` で `writePty` が呼ばれる
  - [ ] 本文空で送信ボタンが disable
  - [ ] `Esc` でパレットが閉じる

#### F1-7: 動作確認 → ユーザー確認 → コミット（WBS F1-7）

- **説明**: `testing.md` に沿った手動 E2E を実施し、受け入れ基準 1〜5, 14 をユーザーと確認してからコミット・マージする。
- **受け入れ条件**:
  - [ ] `testing.md` の全ケースが OK
  - [ ] `npm run lint` / `npm run build`（型チェック含む）がエラーなし
  - [ ] `npx vitest run` がパス
  - [ ] `cd src-tauri && cargo check` がパス
  - [ ] ユーザー承認後にコミット

### 非機能要件

- **パフォーマンス**: パレット開閉は 50ms 以内。10,000 文字入力時も textarea の入力遅延が目視で気にならないこと（NFR-02）。
- **ユーザビリティ**: モーダル表示中はフォーカストラップ（Radix Dialog 既定）。`aria-label` に送信先タブ名を含める。
- **保守性**: 既存 `write_pty` を流用し、新規 Rust コマンドは追加しない。ストアは `src/stores/` 直下の既存パターンを踏襲。
- **外観・デザイン**: `PathPalette` / `ShortcutsModal` と同系の Radix Dialog + Tailwind v4。CSS カスタムプロパティ（`--color-bg-elevated` / `--color-border` / `--color-text-primary` / `--color-accent`）を使用。

### F1 で扱わない項目（後続フェーズに持ち越し）

- **F2 に持ち越し**: パス挿入（`Ctrl+Click` / 右クリック / `Ctrl+P`）のパレット向けディスパッチ、textarea ref 登録 API、`insertAtCaret` 実装、`Ctrl+P` 確定時のフォーカス戻し、`usePathInsertion` 分岐テスト。
- **F3 に持ち越し**: タブ閉鎖時の下書き破棄、IME（`compositionStart/End` / `isComposing`）抑止の仕上げ、グローバルショートカット競合整理（`Ctrl+Tab` / `F2` の skip 共通ガード）、送信失敗時のトースト。
- **F4 以降**: ターミナル本体の右クリック起動、挿入プレビューのハイライト。
- **v1 スコープ外**（元要件 §6）: プロンプト履歴、テンプレート、Markdown プレビュー、下書き永続化、複数パレット同時表示、変数展開。

## スコープ

### 対象

- `promptPaletteStore` 新設
- `PromptPalette.tsx` モーダル UI
- 送信ロジック（`writePty(ptyId, body + "\n")`）
- `Cmd+Shift+P` / `Ctrl+Shift+P` グローバルショートカット
- `TabContextMenu.tsx` の項目追加
- `promptPalette.*` i18n キー（ja / en）
- ユニット＋コンポーネントテスト

### 対象外

- パス挿入のディスパッチ分岐（F2）
- タブ閉鎖時の下書きクリア・IME・競合整理（F3）
- Rust 側の変更（新規コマンド・capabilities 変更は不要）
- エラートースト UI（F3）

## 実装対象ファイル（予定）

**新設**
- `src/components/PromptPalette/PromptPalette.tsx`
- `src/components/PromptPalette/PromptPalette.test.tsx`
- `src/stores/promptPaletteStore.ts`
- `src/stores/promptPaletteStore.test.ts`

**変更**
- `src/components/TerminalPanel/TabContextMenu.tsx` — 「プロンプトを編集...」項目追加
- `src/components/AppLayout.tsx`（もしくは同等の親レイアウト）— `Cmd+Shift+P` リスナ追加、`<PromptPalette />` のマウント
- `src/i18n/locales/ja.json` / `src/i18n/locales/en.json` — `promptPalette.*` 名前空間追加

**参照のみ**
- `src/lib/tauriApi.ts#writePty`
- `src/stores/terminalStore.ts` — アクティブタブ解決

## 依存関係

- 既存 Rust コマンド: `write_pty`（`src-tauri/src/commands/pty.rs:199`） — 変更なし、流用のみ
- 既存 UI パターン: `PathPalette` / `ShortcutsModal`（Radix Dialog）
- 既存ストア: `terminalStore`（アクティブ `ptyId` / タブ名の解決）

## 既知の制約

- F1 のみでは、パレット表示中の `Ctrl+Click` / 右クリック / `Ctrl+P` は **従来どおり PTY へ直書き込み** される（F2 で切替）。この期間は受け入れ基準 6〜8 は未達で構わない。
- F1 段階では `Ctrl+Tab` / `F2` 等のグローバルショートカット抑止を完全には行わない（**F3-3** で集約対応）。2026-04-18 の手動 E2E（testing.md ケース 8）で NG を確認し、**受け入れ基準 14 は F3 へ繰越**の合意。

## 参考資料

- `docs/local/20260415-プロンプト編集パレット/01_要件定義書.md` — 要件定義
- `docs/local/20260415-プロンプト編集パレット/02_概要設計書.md` — 概要設計
- `docs/local/20260415-プロンプト編集パレット/03_WBS.md` — WBS（F1 定義）
- `docs/steering/02_functional_design.md` — 既存パレット / モーダル設計パターン
- `CLAUDE.md` — パス挿入・コミット運用規約
