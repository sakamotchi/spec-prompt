# 要件定義書 - Claude Code スラッシュコマンドサジェスト統合 Phase A

## 概要

プロンプトパレットの `/` インラインサジェスト（`SlashSuggest`）に、**Claude Code の組み込みスラッシュコマンド** および **バンドル Skill** の候補を静的リストとして追加する。Rust 変更・IPC 追加なしでフロントエンド内に閉じた変更で完結させる。

Phase B（ユーザー/プロジェクト Skill のファイルスキャン）の型基盤としても機能する。

## 背景・目的

- 現状、`SlashSuggest` は `PromptTemplate`（ユーザー定義）のみをサジェストし、Claude Code 実コマンドの発見性がゼロ
- steering `docs/steering/features/prompt-palette.md` **PE-46** に「将来 `SlashSuggestItem = { kind: 'template' | 'command' }` で混在表示」と方針のみ記載
- Phase A では **Rust 変更ゼロ・IPC ゼロ** でリスク最小に実装し、Phase B 以降の型基盤を用意する

## 要件一覧

### 機能要件

#### F-1: `SlashSuggestItem` 判別共用体型の導入

- **説明**: 複数種別の候補を単一リストで扱うための判別共用体型を `src/lib/slashSuggestItem.ts` に定義する。Phase A では `template` と `builtin` の 2 種別のみ。Phase B 追加予定の `user-skill` / `project-skill` も型の段階で予約しておく
- **受け入れ条件**:
  - [ ] `SlashSuggestItem` が `kind: 'template' | 'builtin' | 'user-skill' | 'project-skill'` の 4 種別で定義される
  - [ ] `getSlashSuggestCandidates(input)` 関数で templates + builtIn + skills をセクション単位で合成できる
  - [ ] 単体テストで fuzzy マッチ・同名衝突（ユーザー優先）・maxPerSection を網羅する

#### F-2: 組み込み + バンドル Skill 静的リスト

- **説明**: Claude Code の組み込みコマンド (`/resume` `/clear` 等) とバンドル Skill (`/debug` `/simplify` 等) を `src/lib/builtInCommands.ts` に静的配列として定義する
- **受け入れ条件**:
  - [ ] 組み込みコマンド 20 件以上が収録される（2026-04 時点の公式ドキュメント準拠）
  - [ ] バンドル Skill 5 件（`debug` `simplify` `batch` `loop` `claude-api`）が収録される
  - [ ] `name` は重複なし
  - [ ] 各エントリに英語の `description` が 1 行で記載される

#### F-3: SlashSuggest の混在表示対応

- **説明**: `SlashSuggest` コンポーネントがセクション見出し + バッジを伴って複数種別を 1 つのリストに混在表示する。キーボード操作（↑↓/Enter）はセクション横断で機能する
- **受け入れ条件**:
  - [ ] セクション見出し（`Claude Code` / `Templates`）が i18n で表示される
  - [ ] 各候補行の左端にバッジ（`CMD` / `TPL`）が表示される
  - [ ] `↑`/`↓` がセクション境界をまたいで機能する
  - [ ] `Enter` で `activeIndex` の候補が確定される
  - [ ] fuzzy 検索が種別横断で動作する
  - [ ] 候補 0 件時の非表示挙動は現状維持

#### F-4: 候補選択時の kind 分岐

- **説明**: `PromptPalette.handleSlashSelect` が `item.kind` で分岐する。`template` は既存の `applyTemplateBodyToDraft`（全置換＋プレースホルダ選択）、`builtin` は `/<name> `（末尾スペース）を draft に挿入する
- **受け入れ条件**:
  - [ ] `template` 選択時の挙動は既存テストがグリーンのまま維持される
  - [ ] `builtin` 選択時は draft が `/<name> ` に置換される（送信はしない、PE-35 の思想）
  - [ ] 挿入後 textarea にフォーカスが残る
  - [ ] IME 変換中の Enter で誤挿入されない

#### F-5: i18n リソース追加

- **説明**: セクション見出し（`Claude Code` / `Templates`）とバッジラベル（`CMD` / `TPL`）を `ja.json` / `en.json` に追加する。組み込みコマンドとバンドル Skill は共に Claude Code 本体由来のため、セクション見出しは "Claude Code"（ja/en 共通表記）に統一。Phase B で追加される 2 種別のキーは本 Phase では未追加（必要になった時点で追記）
- **受け入れ条件**:
  - [ ] `promptPalette.slashSuggest.section.commands` / `section.templates` が追加される
  - [ ] `promptPalette.slashSuggest.badge.command` / `badge.template` が追加される
  - [ ] ja/en 双方で記載される

### 非機能要件

- **パフォーマンス**: 静的配列参照のみでランタイムオーバーヘッドなし。fuzzy 検索は 50ms 以内（既存と同等）
- **ユーザビリティ**: 既存 `PromptTemplate` の挙動に回帰バグなし。既存ユーザーが `/` を打ったときに候補が増える体験
- **保守性**: 組み込みコマンド追加は `builtInCommands.ts` への 1 行追記のみ。型拡張は Phase B 以降を見越して用意済み
- **外観・デザイン**: セクション見出しは既存の `--color-text-muted`、バッジは `--color-bg-panel` 背景と `--color-text-muted` テキスト。既存のカラーパレットのみ使用

## スコープ

### 対象

- `SlashSuggestItem` 型定義（Phase B の `user-skill` / `project-skill` も型レベルで含む）
- 組み込みコマンド + バンドル Skill の静的リスト
- `SlashSuggest` のセクション + バッジ UI
- `handleSlashSelect` の kind 分岐
- 単体テスト（Vitest）
- i18n リソース追加
- 手動動作確認

### 対象外

- **ファイルスキャン**: `~/.claude/skills/` / プロジェクト `.claude/skills/` の列挙は **Phase B**
- **Rust 変更**: 本 Phase では Rust コードには一切触れない
- **IPC 追加**: `tauriApi` への新規関数追加なし
- **プラグイン Skill**: `/plugin-name:name` 形式は Phase C（恒久スコープ外扱い）
- **MCP プロンプト**: `/mcp__<server>__<prompt>` 形式は恒久スコープ外
- **Skill エディタ**: SpecPrompt から SKILL.md を作成・編集する UI
- **組み込みコマンド一覧の自動追従**: 手動メンテ運用

## 実装対象ファイル（予定）

- `src/lib/slashSuggestItem.ts` — 新規（型定義 + 候補合成関数）
- `src/lib/slashSuggestItem.test.ts` — 新規
- `src/lib/builtInCommands.ts` — 新規
- `src/lib/builtInCommands.test.ts` — 新規
- `src/components/PromptPalette/SlashSuggest.tsx` — 改修
- `src/components/PromptPalette/SlashSuggest.test.tsx` — 改修
- `src/components/PromptPalette/PromptPalette.tsx` — `handleSlashSelect` 分岐追加
- `src/components/PromptPalette/PromptPalette.test.tsx` — 改修
- `src/lib/templateApply.ts` — `insertInlineCommand` ヘルパ追加（または別ファイルで追加）
- `src/i18n/locales/ja.json` / `en.json` — キー追加

## 依存関係

- なし（Phase A は他 Phase に非依存で先行マージ可能）
- 本作業のマージ後に Phase B が着手する

## 既知の制約

- Claude Code の組み込みコマンドは 2026-04 時点の公式ドキュメント（https://code.claude.com/docs/en/commands.md）に準拠。将来の増減は手動追随
- Phase A では Skill ファイルスキャンがないため、ユーザー/プロジェクト Skill は候補に出ない。この体験ギャップは Phase B で解消
- `SlashSuggestItem` の型には Phase B 用の `user-skill` / `project-skill` が含まれるが、Phase A では実値が生成されない（合成関数で空配列として扱う）

## 参考資料

- `docs/steering/features/prompt-palette.md` — PE-46 の記載
- `docs/projects/20260419-claude-code-slash-commands/01_要件定義書.md` — プロジェクト全体の要件
- `docs/projects/20260419-claude-code-slash-commands/02_概要設計書.md` — `SlashSuggestItem` の詳細設計
- `docs/projects/20260419-claude-code-slash-commands/03_WBS.md` — Phase A タスク（TA-1〜TA-9）
- Claude Code 公式ドキュメント: https://code.claude.com/docs/en/commands.md
