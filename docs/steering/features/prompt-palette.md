# プロンプト編集パレット機能仕様書

**バージョン**: 1.2
**作成日**: 2026年4月18日
**最終更新**: 2026年4月19日

---

## 1. 概要

プロンプト編集パレットは、Claude Code などの対話 CLI へ送るプロンプトを **誤送信なく推敲** できる軽量なモーダル編集 UI です。複数行のプロンプトを textarea で組み立て、明示的な送信操作（`Cmd+Enter` / `Ctrl+Enter` またはボタン）で初めてアクティブなターミナル PTY へ書き込みます。パレット表示中はファイルツリーの `⌘+Click`（macOS）/ `Ctrl+Click`（Windows/Linux）/ 右クリック挿入 / `Ctrl+P` パス検索パレットの確定がすべて **パレットの textarea にキャレット挿入** されるように挙動を切り替えます。

v1.1 で **プロンプト履歴**（送信時に自動蓄積、`↑`/`↓` 巡回・`⌘H` ドロップダウン）と **プロンプトテンプレート**（`{{placeholder}}` 対応の再利用プロンプト、`⌘T` ドロップダウン・`/` インラインサジェスト・エディタ）を追加しました。

v1.2 で **Claude Code スラッシュコマンドサジェスト** を追加しました。Phase A として Claude Code の組み込みコマンド（`/resume` `/clear` 等）とバンドル Skill（`/debug` `/simplify` 等）を `SlashSuggest` の候補に静的リストとして統合し、`Claude Code` / `Templates` のセクション見出し＋バッジ（`CMD` / `TPL`）で混在表示します。合わせて、textarea にフォーカスがある状態でも `↑`/`↓`/`Enter`/`Tab` でサジェストを操作できるよう委譲経路を整備し、候補リストが長くなっても親ウィンドウ下端で切れないようオーバーフロー抑止を追加しました。Phase B（`~/.claude/skills/` / プロジェクト `.claude/skills/` のファイルスキャン）は次段階で実装予定。

**機能ID**: FR-15

---

## 2. 機能要件

### 2.1 パレットの起動

| 要件ID | 要件 | 詳細 |
|--------|------|------|
| PE-01 | ショートカット起動 | `Cmd+Shift+P`（macOS）/ `Ctrl+Shift+P`（Win/Linux）でアクティブターミナル宛に開く |
| PE-02 | タブ右クリック起動 | ターミナルタブの右クリックメニュー先頭「プロンプトを編集...」 |
| PE-03 | ターミナル本体右クリック起動 | ターミナル描画領域の右クリックメニュー「プロンプトを編集...」（v1.1 追加） |
| PE-04 | アクティブタブなしは no-op | ターミナルタブが無い、または `ptyId` 未解決時は起動しない |
| PE-05 | 送信先の固定 | 起動時点のアクティブターミナル（`ptyId`）を固定。表示中にタブを切り替えても送信先は変えない |
| PE-06 | 重複起動防止 | パレット表示中に同ショートカットを再押下しても多重起動しない |

### 2.2 編集 UX

| 要件ID | 要件 | 詳細 |
|--------|------|------|
| PE-07 | textarea 8 行・縦リサイズ可 | 初期 8 行、CSS `resize: vertical` |
| PE-08 | Enter は改行 | 通常 Enter は送信せず改行のみ |
| PE-09 | Cmd/Ctrl+Enter で送信 | 本文 + `\n` をアクティブ PTY に 1 回で書き込み、パレットを閉じる |
| PE-10 | 送信ボタン | フッタの「送信」ボタンでも同じ送信処理 |
| PE-11 | 空本文は no-op | `body.trim().length === 0` なら送信ボタン disable、ショートカットは無視 |
| PE-12 | Esc / キャンセル | パレットを閉じる。下書き（テキスト）はメモリに保持 |
| PE-13 | 非モーダル | Radix Dialog を `modal={false}` + overlay `pointer-events: none` で表示。ツリーやターミナルへのクリックを遮らない |

### 2.3 パス挿入ディスパッチ

| 要件ID | 要件 | 詳細 |
|--------|------|------|
| PE-14 | パレット閉時は従来どおり PTY 直書き | `Cmd+Click` / 右クリック挿入 / `Ctrl+P` 確定は `writePty` 経由（既存挙動維持） |
| PE-15 | パレット開時は textarea に挿入 | 上記 3 経路とも `promptPaletteStore.insertAtCaret` で textarea のキャレット位置に挿入 |
| PE-16 | 選択範囲は置換 | textarea に選択範囲があれば置換。なければキャレット位置に挿入 |
| PE-17 | `Ctrl+P` 確定後のフォーカス | パレット開時は `Ctrl+P` だけ閉じ textarea にフォーカスを戻す |
| PE-18 | フォーカスを textarea に維持 | 挿入後 `terminal:focus` は発火させない |

### 2.4 下書き管理

| 要件ID | 要件 | 詳細 |
|--------|------|------|
| PE-19 | タブごとに下書き保持 | `drafts: Record<ptyId, string>` で保持（メモリのみ、永続化しない） |
| PE-20 | 開き直しで復元 | 同一タブで再度開くと直前の下書きを初期値にロード |
| PE-21 | 送信成功でクリア | `writePty` 成功時に `clearDraft(ptyId)` を呼ぶ |
| PE-22 | タブ閉鎖で破棄 | `terminalStore.closeTab` / `handlePtyExited` / `closeActiveTab` 時に `clearDraft`。パレットの送信先なら `close()` |

### 2.5 入力・エラー

| 要件ID | 要件 | 詳細 |
|--------|------|------|
| PE-23 | IME 二重ガード | `compositionstart/end` の state と `e.nativeEvent.isComposing` の OR で判定。変換中の Enter / Cmd+Enter は送信しない |
| PE-24 | グローバルショートカット抑止 | 表示中は allow list（`Ctrl+P` / `Cmd+Shift+P` / `Ctrl+Shift+P`）以外のグローバルショートカット（`Ctrl+Tab` / `F2` / `Cmd+T/W/0/1-9/\` 等）を `AppLayout` で早期 return |
| PE-25 | 送信失敗時トースト | `writePty` reject 時は `toast.error` を出し、パレットと本文を維持して再送信を可能にする |

### 2.6 視覚フィードバック

| 要件ID | 要件 | 詳細 |
|--------|------|------|
| PE-26 | ヘッダに送信先表示 | 「プロンプトを編集 → {タブ名} に送信」を表示 |
| PE-27 | キーヒント | フッタに `Enter: 改行 · ⌘Enter: 送信 · Esc: 閉じる`（プラットフォーム分岐） |
| PE-28 | 挿入フラッシュ | パス挿入直後に textarea 枠を 300ms フラッシュ（`--color-accent` の box-shadow）。`prefers-reduced-motion: reduce` ではスキップ |

### 2.7 プロンプト履歴（v1.1）

| 要件ID | 要件 | 詳細 |
|--------|------|------|
| PE-29 | 送信成功で自動蓄積 | `handleSubmit` 成功時に trim 済み本文を `pushHistory` で履歴に追加。送信失敗時は追加しない |
| PE-30 | 100 件上限・重複排除 | 新しい順に最大 100 件保持。101 件目以降は最古から破棄。直前と完全一致の連続 push は無視 |
| PE-31 | localStorage 永続化 | Zustand `persist` middleware で `spec-prompt:prompt-palette`（`version: 1`）に永続化。端末ローカルのみ、平文保存 |
| PE-32 | `↑`/`↓` 直近巡回 | textarea が空のとき `↑` で直近履歴を流し込み、連続 `↑`/`↓` で過去・新しい側へ巡回。最新より新しい側で `↓` で空に戻る。IME・修飾キー付きは抑止 |
| PE-33 | `⌘H` / `Ctrl+H` ドロップダウン | パレット内スコープで履歴一覧を開閉。検索 input + fuzzy + `↑`/`↓`/`Enter` 操作・`Esc` で段階剥離 |
| PE-34 | 行表示 | 1 行プレビュー（80 字トリム、改行は `↵` に変換）＋相対日時（秒/分/時間/日/月日） |
| PE-35 | 選択＝流し込みのみ | 履歴選択で textarea へ流し込み、送信は別途 `⌘Enter` が必要（誤爆防止） |
| PE-36 | テンプレ昇格アクション | 行右端の `FilePlus` アイコンでテンプレエディタを `initialBody` 付き create モードで起動 |

### 2.8 プロンプトテンプレート（v1.1）

| 要件ID | 要件 | 詳細 |
|--------|------|------|
| PE-37 | テンプレ作成・編集 | `PromptTemplateEditor`（Radix Dialog、modal）で name/body を CRUD。name は必須・ユニーク・255 字以内、body は必須・10,000 字以内 |
| PE-38 | `⌘T` / `Ctrl+T` ドロップダウン | パレット内スコープでテンプレ一覧を開閉。検索（name/body fuzzy）、行内 Edit/Delete アイコン、下部「+ 新規作成」 |
| PE-39 | プレースホルダ | `{{name}}` 記法。流し込み直後に最初のプレースホルダが `setSelectionRange` で選択状態。`Tab` で次へ、`Shift+Tab` で前へ巡回。エスケープ記法 `\{\{` は未対応 |
| PE-40 | ツリー連携 | プレースホルダ選択状態でツリー `⌘+Click`・右クリック・`⌘P` パスパレットで該当パスに置換される（既存 `insertAtCaret` の選択範囲置換挙動を流用） |
| PE-41 | `/` インラインサジェスト | textarea 先頭の `/` + 改行・空白なしトークンで `SlashSuggest` を表示。候補は name fuzzy で最大 10 件。`Enter` で全置換 → プレースホルダ選択状態化 |
| PE-42 | 削除確認 | 行アイコン / エディタの削除は Radix `AlertDialog` で確認 |
| PE-43 | localStorage 永続化 | 履歴と同じ `spec-prompt:prompt-palette` キーに `templates: PromptTemplate[]` を保存 |
| PE-44 | エディタの段階剥離 | エディタ表示中の Esc はエディタのみ閉じる（親パレットは残る）。`Dialog.Content.onEscapeKeyDown` で `editorState !== null` のとき preventDefault |

### 2.9 ショートカット衝突回避

| 要件ID | 要件 | 詳細 |
|--------|------|------|
| PE-45 | グローバル `⌘T` 衝突回避 | パレット閉中は `AppLayout` のグローバル `⌘T`（新規ターミナルタブ）として動作。パレット開中は `AppLayout:43-48` の allow-list 早期 return により抑制され、パレット内の `⌘T` が有効 |
| PE-46 | Claude Code スラッシュコマンド（Phase A 実装済み / v1.2） | `SlashSuggest` の候補を判別共用体 `SlashSuggestItem = { kind: 'template' \| 'builtin' \| 'user-skill' \| 'project-skill' }` で表現し、セクション（`Claude Code` / `User Skills` / `Project Skills` / `Templates`）＋バッジ（`CMD` / `USER` / `PROJ` / `TPL`）で混在表示する。Phase A は `builtin`（組み込みコマンド + バンドル Skill 静的リスト `src/lib/builtInCommands.ts`）と既存 `template` を実装。`user-skill` / `project-skill` は Phase B で `~/.claude/skills/` / `<projectRoot>/.claude/skills/` のファイルスキャンにて有効化予定。プラグイン Skill と MCP プロンプトは恒久スコープ外 |
| PE-47 | SlashSuggest のキー委譲（v1.2） | textarea にフォーカスがある状態でも `↑`/`↓`/`Enter`/`Tab` がサジェストに届くよう、`SlashSuggest` を `forwardRef` 化し `SlashSuggestHandle.handleKeyDown` を `useImperativeHandle` で公開。`PromptPalette.handleKeyDown` がスラッシュアクティブ時に最優先で委譲する。`Tab`（Shift 有無不問）は `activeIndex` の候補を確定（Enter と同等）。`Cmd+Enter` / `Ctrl+Enter` は SlashSuggest で非消費のまま送信ハンドラへ委譲 |
| PE-48 | SlashSuggest のオーバーフロー抑止（v1.2） | 候補リストに `max-height: 40vh` + `overflow-y: auto` を付与。`activeIndex` 変更時は該当行を `scrollIntoView({ block: 'nearest' })` で可視範囲へ追従。`~/.claude/skills/` 側の Skill が増えた将来でも親ウィンドウ下端で切れない |

---

## 3. 技術仕様

### 3.1 フロントエンド

**コンポーネント**:
- `src/components/PromptPalette/PromptPalette.tsx` — Radix Dialog（`modal={false}`）ベースのパレット本体
- `src/components/PromptPalette/PromptHistoryDropdown.tsx` — 履歴ドロップダウン（v1.1）
- `src/components/PromptPalette/PromptTemplateDropdown.tsx` — テンプレドロップダウン（v1.1）
- `src/components/PromptPalette/PromptTemplateEditor.tsx` — テンプレエディタ Dialog（v1.1）
- `src/components/PromptPalette/SlashSuggest.tsx` — `/` インラインサジェスト。v1.2 で forwardRef 化し `SlashSuggestHandle` を公開（PE-47）、候補リストに `max-height: 40vh` + `scrollIntoView` 追従を追加（PE-48）
- `src/components/TerminalPanel/TerminalBodyContextMenu.tsx` — ターミナル本体の右クリック起動（v1.1）
- `src/components/TerminalPanel/TabContextMenu.tsx` — タブ右クリック起動項目（先頭）
- `src/components/Layout/AppLayout.tsx` — `Cmd+Shift+P` グローバルリスナと `isOpen` 早期 return（allow list）

**フック・ユーティリティ**:
- `src/hooks/usePromptHistoryCursor.ts` — `↑`/`↓` 履歴巡回ロジック（v1.1）
- `src/lib/templatePlaceholders.ts` — `{{...}}` パース / `findNextPlaceholder` / `findPreviousPlaceholder`（v1.1）
- `src/lib/templateValidation.ts` — テンプレ name/body の純関数バリデーション（v1.1）
- `src/lib/templateApply.ts` — `applyTemplateBodyToDraft`（流し込み + プレースホルダ選択状態化、v1.1）・`insertInlineCommand`（`/<name> ` の挿入、v1.2）
- `src/lib/slashQuery.ts` — `parseSlashQuery`（v1.1）
- `src/lib/slashSuggestItem.ts` — `SlashSuggestItem` 判別共用体型と `getSlashSuggestCandidates`（セクション合成関数、v1.2）
- `src/lib/builtInCommands.ts` — Claude Code 組み込みコマンド + バンドル Skill の静的リスト（v1.2）

**ストア**: `src/stores/promptPaletteStore.ts`

```typescript
interface PromptPaletteState {
  // v1.0
  isOpen: boolean
  targetPtyId: string | null
  targetTabName: string | null
  drafts: Record<string, string>
  textareaRef: RefObject<HTMLTextAreaElement | null> | null
  lastInsertAt: number  // 挿入シグナル（UI フラッシュ購読用、単調増加）

  // v1.1
  history: PromptHistoryEntry[]          // 最大 100 件、新しい順
  templates: PromptTemplate[]            // name ユニーク、name 昇順表示
  historyCursor: number | null           // ↑/↓ 巡回状態
  dropdown: 'none' | 'history' | 'template'
  editorState: { mode: 'create'; initialBody?: string } | { mode: 'edit'; templateId: string } | null

  open(ptyId: string, tabName: string): void
  close(): void
  setDraft(ptyId: string, value: string): void
  getDraft(ptyId: string): string
  clearDraft(ptyId: string): void
  registerTextarea(ref): void
  insertAtCaret(text: string): void  // 選択範囲置換 + drafts 同期 + rAF でキャレット復元

  // v1.1 追加
  pushHistory(body: string): void              // 送信成功時の副作用
  setHistoryCursor(index: number | null): void
  openDropdown(kind: 'history' | 'template'): void
  closeDropdown(): void
  upsertTemplate(input): PromptTemplate
  removeTemplate(id: string): void
  openEditor(state): void
  closeEditor(): void
}
```

**永続化**: Zustand `persist` middleware で `spec-prompt:prompt-palette`（`version: 1`）に `history` / `templates` のみ書き出す（`partialize`）。`drafts` / `isOpen` / `dropdown` / `editorState` はランタイム状態として永続化対象外。

**ディスパッチ**: `src/hooks/usePathInsertion.ts`

```typescript
// 呼び出し側（TreeNode / ContextMenu / PathPalette）は無改修。
// hook 内部で分岐する。
const insertPath = (paths) => {
  const formatted = formatPaths(paths, pathFormat, projectRoot)
  const palette = usePromptPaletteStore.getState()
  if (palette.isOpen && palette.targetPtyId) {
    palette.insertAtCaret(formatted)    // パレット開時
    return
  }
  if (ptyId) {
    tauriApi.writePty(ptyId, formatted) // パレット閉時（従来）
    window.dispatchEvent(new CustomEvent('terminal:focus'))
  }
}
```

### 3.2 バックエンド

新規 Rust コマンドは追加せず、既存 `write_pty`（`src-tauri/src/commands/pty.rs`）を流用する。

### 3.3 状態の連携

- `terminalStore.closeTab` / `handlePtyExited` / `closeActiveTab` から `promptPaletteStore.clearDraft(ptyId)` を呼ぶ（依存方向は `terminalStore` → `promptPaletteStore`、`getState()` による一方向参照）。
- パレットの `targetPtyId` と閉じられた `ptyId` が一致する場合は `promptPaletteStore.close()` を呼ぶ。

---

## 4. UX考慮事項

- パレットは **非モーダル** なので、ツリー・ターミナル・コンテンツビューアを同時に操作できる（VS Code のコマンドパレット的な UX）。
- ツリーから Cmd+Click した場合、クリック自体で Radix Dialog が close するのを避けるため `onPointerDownOutside` / `onFocusOutside` をツリー系セレクタ（`[data-panel="tree"]` / `[role="menu"]` / `[data-radix-*-content]` / `[data-radix-popper-content-wrapper]`）で preventDefault する。
- 送信成功時は `terminal:focus` イベントを発火させてターミナルにフォーカスを戻す。失敗時はパレットと textarea のフォーカスを維持。
- IME の発火順序差異に対応するため、state と `e.nativeEvent.isComposing` の二重ガードで判定。
- ターミナル本体の右クリックメニューは PTY 未生成時は disabled。

---

## 5. 制約

- `usePathInsertion` は primary ペインのアクティブタブのみを PTY 先として解決する（secondary ペイン未対応。既知制約）。
- 下書きは **メモリのみ** 保持し、アプリ再起動では消える（履歴・テンプレは v1.1 で localStorage 永続化）。
- textarea 内の挿入範囲単位のハイライト（文字単位）は未実装。挿入フラッシュは textarea 全体の枠フラッシュに留まる（v1.2 以降候補）。
- 履歴はグローバル（全ターミナル共有）で、PTY ID ごとには分離していない。PTY ID はセッション毎に変わるため PTY 単位の永続化は困難。「このタブに送ったもの」フィルタは将来拡張候補。
- プレースホルダのエスケープ記法（`\{\{`）・デフォルト値記法（`{{path=foo}}`）は未対応。
- 履歴・テンプレートは localStorage に **平文保存**。APIキー等の機密情報をプロンプトに含めた場合もそのまま保存されるため、機密情報の扱いはユーザーの注意に依存。

---

## 6. スコープ外

- 履歴・テンプレートのクラウド同期、インポート/エクスポート
- 履歴・テンプレートの暗号化保存
- Markdown プレビュー、シンタックスハイライト
- 複数パレットの同時表示（タブ別の別パレット）
- Claude Code プラグイン Skill（`/plugin-name:name` 形式）と MCP プロンプト（`/mcp__<server>__<prompt>` 形式）のサジェスト統合。プラグインは有効化判定方法の調査が必要なためニーズが高まってから、MCP プロンプトは恒久スコープ外
- タグによるテンプレ絞り込み UI（データ構造としての `tags` フィールドは定義済み）
- 履歴一括クリア UI

---

## 変更履歴

| 日付 | バージョン | 変更内容 | 作成者 |
|------|----------|---------|--------|
| 2026-04-18 | 1.0 | 初版作成（F1 MVP + F2 パス挿入ディスパッチ + F3 体験仕上げ + F4 UX 向上を一括反映） | - |
| 2026-04-19 | 1.1 | 履歴機能（PE-29〜PE-36）・テンプレート機能（PE-37〜PE-44）・`⌘T` 衝突回避（PE-45〜PE-46）を追加 | - |
| 2026-04-19 | 1.2 | Claude Code スラッシュコマンドサジェスト統合の Phase A を実装（PE-46 具体化）、SlashSuggest のキー委譲（PE-47）と候補リストのオーバーフロー抑止（PE-48）を追加 | - |
