# 要件定義書 - prompt-palette-history-template-p2-history

## 概要

プロンプトパレット履歴・テンプレート機能（プロジェクト `docs/projects/20260418-プロンプトパレット履歴テンプレート/`）のうち、**Phase 2: 履歴機能** を実装する。Phase 1 で整備した `promptPaletteStore` の `history` と `pushHistory` / `setHistoryCursor` / `openDropdown` / `closeDropdown` を活用し、UI から履歴を呼び出して textarea に流し込める状態までを完成させる。

- 親プロジェクト: `docs/projects/20260418-プロンプトパレット履歴テンプレート/`
- WBS 対応: Phase 2（T2-1〜T2-5、※T2-6 は T3-6 として Phase 3 へ移動済み）
- ブランチ: `feature/prompt-palette-history-template`
- 前提コミット: `31e8c1e feat(prompt-palette): 履歴・テンプレート機能の基盤整備（Phase 1）`

## 背景・目的

- 現状、プロンプトパレットで送信した本文は `clearDraft` で即時破棄されるため、同じ内容を再送するには毎回手入力または外部からのコピペが必要
- Phase 1 でストアに `history` 配列と `pushHistory` を用意済み。ここに UI を接続することで、日常の再送・微修正コストを最小化する
- 主動線は「履歴から選択 → textarea に流し込み → そのまま、または編集して `Cmd+Enter` で送信」。選択＝即送信はしない（誤爆防止）

## 要件一覧

### 機能要件

#### F2-1: 送信成功時の履歴 push（WBS T2-1）

- **説明**: `PromptPalette.tsx` の `handleSubmit` で `tauriApi.writePty` が成功したら、`promptPaletteStore.pushHistory(body)` を呼ぶ。送信失敗時は push しない（誤登録防止、Phase 1 設計書の仕様と整合）
- **受け入れ条件**:
  - [ ] `handleSubmit` 成功時に `pushHistory(body)` が呼ばれる
  - [ ] 送信失敗時（`tauriApi.writePty` が throw）は履歴に追加されない
  - [ ] push に渡す body は trim 済みのもの（末尾改行含む現状の送信前処理と整合）
  - [ ] 履歴への追加は `clearDraft` より前に行い、drafts が空になる前の本文がキャプチャされる

#### F2-2: `↑`/`↓` 直近履歴巡回（WBS T2-2 + T2-3）

- **説明**: textarea が空または直近履歴由来の値のときに `↑` で直近履歴を流し込み、連続 `↑` でさらに過去、`↓` で新しい側へ戻る。最新より新しい側で `↓` を押すと空に戻る。履歴巡回中にユーザーが文字を編集すると巡回状態をリセット
- **受け入れ条件**:
  - [ ] textarea 値が空かつ履歴が 1 件以上あるときに `↑` で直近履歴（index 0）が textarea に反映される
  - [ ] 連続 `↑` で `historyCursor` が +1 されより古い履歴へ進む（上限は `history.length - 1`）
  - [ ] `↓` で `historyCursor` が -1 され、0 の状態で `↓` を押すと巡回解除（draft 空、`historyCursor = null`）
  - [ ] IME 変換中（`isComposing` or `e.nativeEvent.isComposing`）は発動しない
  - [ ] `Shift` / `Alt` / `Cmd` / `Ctrl` いずれかを伴う `↑` / `↓` では発動しない（選択や段落移動などと衝突を避けるため）
  - [ ] 履歴選択を流し込んだ直後、カーソル位置は textarea の末尾
  - [ ] ユーザーが textarea を編集（入力・貼り付け・削除）した時点で `historyCursor` が null にリセットされる
  - [ ] 履歴巡回中に別の履歴 `↑` / `↓` で切り替わっても、既存の draft 編集内容とは混ざらない（履歴巡回中は draft を「巡回由来」として扱う）

#### F2-3: 履歴ドロップダウン UI（WBS T2-4）

- **説明**: パレット内に履歴一覧のドロップダウンを表示する新規コンポーネント `PromptHistoryDropdown`。`PathPalette` の検索＋`↑`/`↓`/`Enter` パターンを踏襲し、選択で textarea に流し込み
- **受け入れ条件**:
  - [ ] ドロップダウンは`promptPaletteStore.dropdown === 'history'` のときパレット Dialog 内に表示される
  - [ ] 検索入力にフォーカスがあたった状態でオープン。`↑` / `↓` で候補移動、`Enter` で textarea に流し込み、`Esc` でドロップダウンのみ閉じる（パレットは開いたまま）
  - [ ] 検索は Phase 1 の fuzzy 実装と同等（`PathPalette` の `fuzzyMatch` を流用）。body の小文字化で照合
  - [ ] 行の表示は 1 行プレビュー（80 字でトリム、改行はスペースに変換）＋相対日時（例: `2 分前`）
  - [ ] 履歴が 0 件のときは `promptPalette.history.empty` メッセージを表示
  - [ ] 100 件制限のスクロール可能リスト。ドロップダウンは `max-height: 320px` 程度で縦スクロール
  - [ ] ドロップダウン本体 DOM に `data-palette-dropdown` 属性を付与（パレット Dialog の `onPointerDownOutside` 例外判定用）
  - [ ] 選択＝textarea 流し込みのみ。自動送信はしない（ユーザーが `⌘Enter` を押すまで送信されない）

#### F2-4: ヘッダアイコン + `⌘H` 導線（WBS T2-5）

- **説明**: パレットヘッダに「履歴」アイコンボタンを追加。クリックで履歴ドロップダウンを開く。パレットがフォーカスされている間は `⌘H` / `Ctrl+H` でも開閉できる
- **受け入れ条件**:
  - [ ] ヘッダに `lucide-react` の `History` アイコン（または相当）を設置。tooltip で「履歴を開く (⌘H)」を表示
  - [ ] アイコンクリックで `openDropdown('history')`
  - [ ] パレット textarea フォーカス中に `⌘H`（macOS）/ `Ctrl+H`（Windows/Linux）で同等に開く。ドロップダウン表示中の再押下は閉じる
  - [ ] `⌘H` / `Ctrl+H` はパレットがオープン中のみ発動（グローバル挙動への影響なし）
  - [ ] IME 変換中はグローバル動作のまま（`⌘H` によるトリガは抑制）
  - [ ] `src/lib/shortcuts.ts` の `SHORTCUT_DEFS` に「パレット内: 履歴を開く」の表示用エントリを追加（ヘルプ `?` 表示用）

### 非機能要件

- **パフォーマンス**: 履歴 100 件の fuzzy フィルタ・レンダは 60 fps を維持。`↑` / `↓` の応答遅延 16ms 以下
- **ユーザビリティ**: 直近送信の再送が `F4 → ↑ → ⌘Enter` の 3 ストロークで完結
- **アクセシビリティ**:
  - ドロップダウンリストに `role="listbox"`、各行に `role="option"` と `aria-selected`
  - ヘッダアイコンに `aria-label` とキーヒントを tooltip で提示
  - 既存の `prefers-reduced-motion` 配慮（挿入フラッシュ抑制）を維持
- **保守性**: `PromptHistoryDropdown` は `PathPalette` の実装パターンを踏襲し、将来のテンプレドロップダウン（Phase 3）でも再利用できるよう小さな共通 hook `useListboxNavigation`（任意）を検討
- **外観・デザイン**:
  - 既存のカラーパレット（`var(--color-bg-elevated)` / `var(--color-border)` / `var(--color-accent)`）を使用
  - ヘッダアイコンの配置は `PromptPalette.tsx` 既存ヘッダ右端。`TabContextMenu` で使われている Lucide アイコンと同じサイズ感

## スコープ

### 対象

- `PromptPalette.tsx` の以下改修:
  - ヘッダ右端の履歴アイコン
  - `handleKeyDown` に `↑` / `↓` / `⌘H` / `Ctrl+H` ハンドラ追加
  - `handleChange` で `historyCursor` リセット
  - `handleSubmit` 成功時の `pushHistory` 呼び出し
  - ドロップダウン子コンポーネントの配置
- `PromptHistoryDropdown.tsx` 新規実装
- `usePromptHistoryCursor.ts` フック新規実装（`↑`/`↓` 巡回ロジックの独立切り出し）
- `shortcuts.ts` のヘルプ表示エントリ追加
- i18n 翻訳文字列の確定（Phase 1 で追加した `promptPalette.history.*` のコピー調整）
- テスト追加:
  - `usePromptHistoryCursor.test.ts`
  - `PromptHistoryDropdown.test.tsx`
  - `PromptPalette.test.tsx` への送信時 push テスト、`↑`/`↓` 動作の結合テスト

### 対象外

- テンプレートドロップダウン・エディタ・プレースホルダ展開・`⌘T`・`/` サジェスト（Phase 3）
- 履歴→テンプレ昇格（T3-6 に移動済み、Phase 3）
- 履歴クリア UI（プロジェクト全体で将来拡張）
- 履歴の検索結果ハイライト（Phase 4 以降の余剰演出）
- 履歴のエクスポート / インポート

## 実装対象ファイル（予定）

**新設**
- `src/components/PromptPalette/PromptHistoryDropdown.tsx` — 履歴一覧ドロップダウン
- `src/components/PromptPalette/PromptHistoryDropdown.test.tsx` — 同テスト
- `src/hooks/usePromptHistoryCursor.ts` — `↑`/`↓` 巡回ロジック
- `src/hooks/usePromptHistoryCursor.test.ts` — 同テスト

**変更**
- `src/components/PromptPalette/PromptPalette.tsx` — ヘッダアイコン・キーハンドラ・ドロップダウン配置・送信後 push
- `src/components/PromptPalette/PromptPalette.test.tsx` — 送信後 push、`↑`/`↓` 結合テスト追加
- `src/lib/shortcuts.ts` — ヘルプ表示用エントリ追加
- `src/i18n/locales/ja.json` / `en.json` — Phase 1 で追加したキーのコピー確定

## 依存関係

- Phase 1 コミット `31e8c1e` の成果物:
  - `promptPaletteStore` の `history`, `historyCursor`, `dropdown`, `pushHistory`, `setHistoryCursor`, `openDropdown`, `closeDropdown`
  - i18n キー `promptPalette.history.*` と `promptPalette.hint.historyUp/Down/Open`
- 既存機能:
  - `@radix-ui/react-dialog`（パレット本体）
  - `PathPalette` の fuzzy / ↑↓Enter パターン
  - `lucide-react`（アイコン）
  - `tauriApi.writePty`（`handleSubmit` から呼び出し済み）

## 既知の制約

- パレットは既に `modal={false}` で外側クリック透過しているため、ドロップダウン追加時も同じ外側クリック制御（`onPointerDownOutside`）の例外判定にドロップダウン自身を含める必要がある（`data-palette-dropdown` 属性で対応）
- `⌘H` は macOS の Finder 等で「ウィンドウを隠す」に割り当てられている。アプリ内ショートカットはウィンドウフォーカス時のみ発動するため衝突は限定的だが、**パレットが開いているときのみ**に限定することで誤爆を防ぐ
- shortcuts.ts の既存 `⌘T`（newTerminalTab）は Phase 3 の `⌘T`（テンプレ）とスコープ衝突する。Phase 2 では `⌘H` のみ導入するので影響なし（Phase 3 で別途解決）
- textarea が空でないとき `↑` / `↓` は通常の段落移動・選択として動作させる（preventDefault しない）

## 参考資料

- `docs/projects/20260418-プロンプトパレット履歴テンプレート/01_要件定義書.md` §FR-01, FR-02
- `docs/projects/20260418-プロンプトパレット履歴テンプレート/02_概要設計書.md` §3.1〜3.3
- `docs/projects/20260418-プロンプトパレット履歴テンプレート/03_WBS.md` Phase 2（T2-1〜T2-5）
- `docs/working/20260418_prompt-palette-history-template-p1-foundation/design.md` — Phase 1 実装済み API 一覧
- `src/components/PathPalette/PathPalette.tsx` — 参考実装（fuzzy + ↑↓Enter）
- `src/components/PromptPalette/PromptPalette.tsx` — 改修対象
- `src/stores/promptPaletteStore.ts` — Phase 1 で拡張済み
- `docs/steering/features/prompt-palette.md` — 既存機能仕様
