# 要件定義書 - manual-tab-rename（P3: 手動リネーム UI）

## 概要

SpecPrompt の統合ターミナルで、ユーザーが任意のタブに好きなラベルを付けられるようにする。ユーザーが手動で名前を付けたタブ（"pinned"）は、それ以降 OSC 0/1/2 由来の自動タイトル更新（Phase 2）を**無視する**。macOS 標準ターミナル（Terminal.app）の "Permanent Title" 相当の挙動を提供する。

リネームの UI は:
- **ダブルクリック** でタブラベルを編集モードにし、Enter / blur で確定、Esc でキャンセル
- **右クリックメニュー** に「タブ名を変更」「自動タイトルに戻す」（pinned 時のみ活性）

本ドキュメントは 4 フェーズ計画のうち **Phase 3** を対象とする。未読マーク UI（P4）は本フェーズのスコープ外。

## 背景・目的

- Phase 1・2 で通知タイトルとタブラベルを動的に連動させる基盤が整った（OSC 0/1/2 → `oscTitle` → `computeDisplayTitle` → UI / 通知タイトル）。
- しかし、OSC を出さないコマンド（例: `python`, `make`, 一部のビルドツール）ではタブ名が `Terminal N` のまま。ユーザーは「このタブはビルド監視」「このタブは API 動作確認」など**意味のある名前**を付けたいユースケースがある。
- macOS Terminal.app はユーザーが手動で名前を付けるとそれを固定（permanent title）し、以降のシェル側タイトル出力を無視する。SpecPrompt でも同等の挙動を提供したい。
- Phase 2 で `TerminalTab.oscTitle` とフォールバック名は分離済み。P3 では `manualTitle` / `pinned` フラグを追加して `computeDisplayTitle` の優先順位を 3 段に拡張する。

## 要件一覧

### 機能要件

#### F-1: 手動タイトルとピン留めフラグの追加

- **説明**:
  `TerminalTab` に `manualTitle: string | null` と `pinned: boolean` を追加する。`pinned = true` のときユーザーが設定した `manualTitle` を表示タイトルとして優先し、以降 OSC タイトル更新を UI に反映しない。
- **受け入れ条件**:
  - [ ] `TerminalTab` 型に `manualTitle` / `pinned` が追加される
  - [ ] `computeDisplayTitle(tab)` の優先順位が `pinned ? manualTitle : (oscTitle ?? fallbackTitle)` に拡張される
  - [ ] 既存タブ（`pinned=false`）の表示挙動（P2 時点）は変わらない

#### F-2: ダブルクリックによるインライン編集

- **説明**:
  タブラベル上でダブルクリックすると、その場でテキスト入力欄に切り替わる。Enter or blur で確定、Esc でキャンセル。空文字での確定はフォールバック（`Terminal N`）に戻す扱い。
- **受け入れ条件**:
  - [ ] ダブルクリックで該当タブが編集モードになる
  - [ ] 編集中は現在の表示タイトルが初期値としてセットされ、全選択された状態でフォーカスされる
  - [ ] Enter で確定 → `renameTab(tabId, title)` が呼ばれる
  - [ ] Esc で入力値を破棄し編集モードを抜ける
  - [ ] blur（外側クリック）で Enter と同じ確定扱いにする
  - [ ] 空文字または空白のみで確定した場合は `unpinTab(tabId)` を呼んで自動タイトルに戻す
  - [ ] 編集中はタブ選択（activeTab 切り替え）やドラッグが発火しない

#### F-3: 右クリックコンテキストメニュー

- **説明**:
  タブの右クリックで以下のメニューを表示する。既存の `TreeContextMenu`（Radix UI）のデザインを踏襲する。
- **受け入れ条件**:
  - [ ] 「タブ名を変更」: インライン編集モードに切り替える（F-2 と同じ挙動）
  - [ ] 「自動タイトルに戻す」: `pinned` のときのみ活性化。選択すると `unpinTab(tabId)` が呼ばれ、直近の `oscTitle` またはフォールバックが表示される
  - [ ] 「タブを閉じる」: 既存の閉じるボタンと同等（複数タブがある場合のみ活性）

#### F-4: ピン留めタブでの OSC 更新無視

- **説明**:
  `pinned = true` のタブでは `setOscTitle` の結果が UI に出ないようにする。`oscTitle` フィールド自体は **記録し続ける**（unpin 時に最新の OSC タイトルに即復帰できるように）。
- **受け入れ条件**:
  - [ ] `pinned=true` のタブに OSC 2 が届いても `manualTitle` が表示されたまま変わらない
  - [ ] `oscTitle` は内部的に更新され続ける（ストア状態を確認）
  - [ ] `unpinTab` を呼ぶと `pinned=false` に戻り、最新の `oscTitle` が即座に表示される
  - [ ] Rust `DisplayTitleCache` への同期（P2 で追加済）が新しい `computeDisplayTitle` の結果で駆動される → pinned なら `manualTitle`、unpin すれば `oscTitle` に追随

#### F-5: リネーム挙動の同期先

- **説明**:
  P2 で追加した Zustand subscribe → `tauriApi.setPtyDisplayTitle` 経路により、手動リネームの結果も **OS 通知のタイトルに反映される**。追加実装は不要（`computeDisplayTitle` が変わるだけで既存経路が機能する）。
- **受け入れ条件**:
  - [ ] 手動リネーム後にバックグラウンドで OSC 9 通知を発火すると、通知タイトルに `manualTitle` が差し込まれる（例: `Claude Code — watcher`）
  - [ ] `unpinTab` 後は `oscTitle` or `fallbackTitle` に追随する

### 非機能要件

- **パフォーマンス**:
  - リネーム UI のオープン/クローズは 50ms 以内（既存 `InlineInput` 相当）
  - 編集モード中の入力はフレーム落ちなし
- **ユーザビリティ**:
  - Enter 確定・Esc キャンセル・blur 確定という一般的なキー操作を踏襲
  - ダブルクリックと「タブ選択の単発クリック」を区別する（ダブルクリック判定は OS/ブラウザ標準に任せる）
  - 右クリックメニューのアイコン・色は既存の `TreeContextMenu` と統一
- **保守性**:
  - `TabInlineRenameInput` を独立コンポーネントとして `TerminalPanel/` 配下に配置、UI ロジックを UI 層に閉じ込める
  - Zustand アクション（`renameTab` / `unpinTab`）は純粋な状態変更のみに留める
- **外観・デザイン**:
  - カラーは `src/index.css` の CSS カスタムプロパティを踏襲（`--color-bg-base`, `--color-accent`, `--color-text-primary`）
  - Radix UI の `ContextMenu` を使用して既存の Tree と一貫性のある見た目・キーボード操作を確保
  - アイコンは `lucide-react`（`Pencil` / `RotateCcw` / `X` 等）

## スコープ

### 対象

- Front: `TerminalTab` 型拡張（`manualTitle` / `pinned`）、`renameTab` / `unpinTab` アクション
- Front: `computeDisplayTitle` の優先順位拡張
- Front: `TabInlineRenameInput` コンポーネント新規追加
- Front: `TabContextMenu` コンポーネント新規追加（Radix UI ベース）
- Front: `TerminalTabs.tsx` のラベル部分を差し替え、ダブルクリック/右クリック処理
- テスト: Zustand ユニットテスト（`renameTab` / `unpinTab` / `computeDisplayTitle` の 3 段優先順位）、手動 E2E

### 対象外

- 未読マーク `●` / タブハイライト / 解除ロジック（Phase 4）
- 手動タイトルの再起動後も保持する永続化（`persist` ミドルウェア導入は別スコープ）
- 複数タブ同時リネーム、リネーム履歴の Undo/Redo
- タブのアイコン変更・色分け

## 実装対象ファイル（予定）

- `src/stores/terminalStore.ts` — `TerminalTab` 型拡張、`computeDisplayTitle` 3 段優先順位、`renameTab` / `unpinTab` アクション
- `src/stores/terminalStore.test.ts` — 新アクションと優先順位のテスト追加
- `src/components/TerminalPanel/TabInlineRenameInput.tsx`（新規） — インライン編集用コンポーネント
- `src/components/TerminalPanel/TabContextMenu.tsx`（新規） — タブ右クリックメニュー
- `src/components/TerminalPanel/TerminalTabs.tsx` — ダブルクリック・右クリック・編集モード切替の統合
- `src/i18n/locales/{ja,en}/common.json`（既存 i18n に沿って）— メニュー文言の翻訳追加

## 依存関係

- Phase 1 の `DisplayTitleCache` / `set_pty_display_title` / `setPtyDisplayTitle`
- Phase 2 の:
  - `TerminalTab.fallbackTitle` / `oscTitle` フィールド
  - `computeDisplayTitle` 関数
  - `setOscTitle` アクション
  - `AppLayout` の Zustand subscribe による Rust 同期
- 既存 UI: `@radix-ui/react-context-menu`（`TreeContextMenu` で使用中）、`lucide-react`、`react-i18next`

## 既知の制約

- 手動タイトルは現状セッション内のみ保持。アプリ再起動で失われる（永続化は P3 のスコープ外）。
- ダブルクリックでラベル編集を入れるため、ドラッグ操作（タブ並び替え）との競合に注意。ダブルクリック時はドラッグ開始を抑止する必要がある（実装時にイベント順序を要確認）。
- `TreePanel` の `InlineInput` はツリー専用のインデント前提なので、タブ向けには別実装（`TabInlineRenameInput`）を用意する。

## 参考資料

- `docs/local/20260414-タブ識別通知と動的タブタイトル/01_要件定義書.md` — 全体要件（FR-03 の pinned 関連が本フェーズ相当）
- `docs/local/20260414-タブ識別通知と動的タブタイトル/02_概要設計書.md` — 全体設計（3-5 タブのリネーム UI セクション）
- `docs/local/20260414-タブ識別通知と動的タブタイトル/03_WBS.md` — Phase 3 セクション
- `docs/working/20260414_dynamic-tab-title/` — Phase 2 の要件・設計・テスト
- `docs/working/20260414_notification-tab-name/` — Phase 1 の要件・設計・テスト
- 既存コンテキストメニュー: `src/components/TreePanel/ContextMenu.tsx`
- 既存インライン入力: `src/components/TreePanel/InlineInput.tsx`
- macOS Terminal.app の "Permanent Title" 挙動
