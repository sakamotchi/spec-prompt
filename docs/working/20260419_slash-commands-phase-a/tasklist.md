# タスクリスト - Claude Code スラッシュコマンドサジェスト統合 Phase A

## 進捗サマリー

| 状態 | 件数 |
|------|------|
| 完了 | 11 |
| 進行中 | 0 |
| 未着手 | 0 |

WBS 上のタスク ID（`TA-1`〜`TA-9`）＋追加で TA-10（キー委譲 PE-47）・TA-11（オーバーフロー抑止 PE-48）。実装確認完了 2026-04-19。

## タスク一覧

### T-1（WBS: TA-1）: `SlashSuggestItem` 型と合成関数の定義

- [x] `src/lib/slashSuggestItem.ts` を新規作成
- [x] `SlashSuggestKind` / `SlashSuggestItem` 判別共用体を定義（Phase B 用の `user-skill` / `project-skill` も含む）
- [x] `SlashSuggestSection` インターフェースを定義
- [x] `getSlashSuggestCandidates` 関数を実装（fuzzy + セクション合成 + maxPerSection + 空セクション除去）
- [x] 同名衝突はユーザー優先で 1 件に絞るロジック（Phase B 用、Phase A は空配列なので実質 no-op）
- [x] 型が通る（`npm run build`）

### T-2（WBS: TA-2）: 組み込み + バンドル Skill 静的リスト

- [x] `src/lib/builtInCommands.ts` を新規作成
- [x] `BuiltInCommand` 型 export
- [x] 組み込みコマンド 23 件収録
- [x] バンドル Skill 5 件収録（`debug` / `simplify` / `batch` / `loop` / `claude-api`）
- [x] コメントで「2026-04 時点の公式 docs 準拠」と出典 URL を明記
- [x] 名前重複がないことを unit test で担保（T-3 で）

### T-3（WBS: TA-3）: 合成関数・静的リストの単体テスト

- [x] `src/lib/builtInCommands.test.ts` を新規作成
  - [x] `name` の重複なし
  - [x] 各エントリに空でない `description` がある
- [x] `src/lib/slashSuggestItem.test.ts` を新規作成
  - [x] 空クエリ時に builtin / template セクションの順で返る
  - [x] fuzzy クエリで横断マッチ
  - [x] `maxPerSection` の上限適用
  - [x] 空セクションは結果から除外
  - [x] query が `/` で始まる場合は除去して検索（`parseSlashQuery` が抽出した query がそのまま渡される前提で、合成関数自体は `/` を前提にしない）
- [x] `npm run test` グリーン

### T-4（WBS: TA-4）: `SlashSuggest` コンポーネント改修

- [x] 候補を `SlashSuggestSection[]` 受け取りに変更
- [x] セクション見出しと `role="group"` でグルーピング
- [x] 各行にバッジ（`CMD` / `TPL`）を表示
- [x] `activeIndex` をセクション跨ぎのグローバル index で管理
- [x] `↑` / `↓` / `Enter` の挙動を維持（既存の動作を壊さない）
- [x] `onMouseEnter` で `activeIndex` 更新 / `onClick` で選択確定（既存踏襲）
- [x] 候補 0 件（全セクション空）時の非表示挙動は現状維持

### T-5（WBS: TA-5）: `SlashSuggest` テスト更新

- [x] `src/components/PromptPalette/SlashSuggest.test.tsx` を改修
- [x] セクション見出しが描画されるテスト
- [x] バッジテキスト（CMD/TPL）のテスト
- [x] `↓` でセクション境界を越えるテスト
- [x] 既存の fuzzy / Enter / 非表示テストが通ること（回帰チェック）

### T-6（WBS: TA-6）: `handleSlashSelect` kind 分岐

- [x] `src/lib/templateApply.ts`（または新規ファイル）に `insertInlineCommand(name: string): void` を追加
  - draft を `/<name> ` に置換
  - caret を末尾に設定
- [x] `src/components/PromptPalette/PromptPalette.tsx` の `handleSlashSelect` を `(item: SlashSuggestItem) => void` に変更
  - `kind === 'template'` → 既存 `applyTemplateBodyToDraft(item.body)`
  - `kind === 'builtin' | 'user-skill' | 'project-skill'` → `insertInlineCommand(item.name)`

### T-7（WBS: TA-7）: `PromptPalette` テスト更新

- [x] `src/components/PromptPalette/PromptPalette.test.tsx`
  - [x] 既存のテンプレ選択テストを `SlashSuggestItem` 化して継続動作
  - [x] builtin 選択時に draft が `/<name> ` になる新規テスト
  - [x] IME 変換中の Enter で誤挿入しないテスト（既存カバー確認）

### T-8（WBS: TA-8）: i18n リソース追加

- [x] `src/i18n/locales/ja.json` / `en.json` に以下のキーを追加
  - `promptPalette.slashSuggest.section.commands` — ja/en 共通: "Claude Code"（組み込みコマンドとバンドル Skill は共に Claude Code 本体由来のため "Claude Code" に統一）
  - `promptPalette.slashSuggest.section.templates` — ja: "テンプレート" / en: "Templates"
  - `promptPalette.slashSuggest.badge.command` — ja/en: "CMD"
  - `promptPalette.slashSuggest.badge.template` — ja/en: "TPL"
- [x] 既存の `promptPalette.template.title` との重複がないこと

### T-9（WBS: TA-9）: Phase A 手動動作確認

- [x] `npx tauri dev` でアプリ起動
- [x] `Cmd+Shift+P` でパレットを開き、`/` を入力 → `Claude Code` セクションが表示される
- [x] `/rev` で `review` / `rewind` が絞り込まれる
- [x] 既存のテンプレ（あれば）も同時表示される
- [x] `↑`/`↓` でセクション跨ぎが機能する
- [x] `Enter` で `/<name> ` が draft に挿入される（送信されないこと）
- [x] 既存のテンプレ選択挙動に回帰なし
- [x] `testing.md` の全ケースを実施し、結果を記録

### T-10（追加）: SlashSuggest のキー委譲（PE-47）

- [x] `SlashSuggest` を `forwardRef` 化し `SlashSuggestHandle.handleKeyDown(e) => boolean` を `useImperativeHandle` で公開
- [x] `PromptPalette.handleKeyDown`（textarea 上）で `slashActive` 時に最優先でハンドルに委譲
- [x] Tab（Shift 有無不問）で activeIndex の候補を確定（Enter と同等）
- [x] Cmd+Enter / Ctrl+Enter は SlashSuggest で非消費、親の送信ハンドラへ
- [x] 単体テスト: Tab / Shift+Tab / Cmd+Enter 非消費、textarea 委譲経路（4 件）

### T-11（追加）: SlashSuggest のオーバーフロー抑止（PE-48）

- [x] ルートに `max-height: 40vh` + `overflow-y: auto` を付与
- [x] 各候補行に `data-slash-index` を付与
- [x] activeIndex 変更時に該当行を `scrollIntoView({ block: 'nearest' })` で可視範囲へ追従
- [x] jsdom 環境向けに `scrollIntoView` 未定義時のガード

## 完了条件

- [x] 全 9 タスクが完了
- [x] `npm run lint` エラーなし
- [x] `npm run build` TypeScript エラーなし
- [x] `npm run test` 全件グリーン
- [x] `testing.md` の手動テストが全件 OK
- [x] `docs/steering/features/prompt-palette.md` の PE-46 を「Phase A 実装済み」に更新（Phase B 残り）
- [x] PR 作成（ユーザー承認後）

## ブランチ・コミット運用

- 作業ブランチ: `feature/claude-code-slash-commands`（既存）
- コミットは T-1〜T-3 / T-4〜T-5 / T-6〜T-8 / T-9 の単位で分割推奨
- `feat(slash-suggest): ...` のスコープでコミットメッセージを揃える
- マージは Phase A 完了時点で 1 PR（Phase B は別 PR）

## 備考

- Rust 変更なし → `cargo test` / `cargo check` のステップはこの Phase では省略可
- 本 Phase で Rust 側の変更が発生した場合は design.md に追記してから実装する
