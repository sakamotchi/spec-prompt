# 要件定義書 - prompt-palette-f4

## 概要

プロンプト編集パレットのフェーズ F4（任意、v1.1 候補）として、v1 の中核機能は触らずに UX を底上げする。具体的には (1) **ターミナル本体の右クリックメニュー** から「プロンプトを編集...」を起動できるようにし、(2) **パス挿入プレビュー** の視覚フィードバックを追加する。F4 は受け入れ基準の追加ではなく、v1 リリース後の体験向上を目的とする。

- 元仕様: `docs/local/20260415-プロンプト編集パレット/01_要件定義書.md` §4 FR-06, `02_概要設計書.md` §3.3, `03_WBS.md` フェーズ F4
- WBS 対応: フェーズ F4（F4-1, F4-2）
- **受け入れ基準外**（元要件 §7 の 1〜15 は F1〜F3 で達成済み）
- 前提:
  - F1 コミット済み: `d6076ed`
  - F2 コミット済み: `2773a53`
  - F3 コミット済み: `c8a851f`
  - v1 リリース可能な状態

## 背景・目的

- v1 ではプロンプトパレットの起動口がタブ右クリック / `Cmd+Shift+P` の 2 経路のみ。ターミナル本体の中で操作しているときに「今すぐプロンプトを書きたい」と思ったら、わざわざタブまでマウスを戻す必要がある。Claude Code の CLI 操作中はカーソルがターミナル上に留まっている時間が長く、ここから直接起動できれば UX が大きく改善する。
- F2 でパス挿入経路をパレット向けに切り替えたが、挿入が成功したこと自体の視覚フィードバックは無い（textarea の内容が増えるのみで、キャレットの動きに気づかないと分かりづらい）。一瞬のハイライトで「挿入された」と即座に認識できるようにする。
- どちらも v1 の受け入れ基準外だが、日常的に頻繁に使う経路のため v1.1 で取り込む価値が高い。

## 要件一覧

### 機能要件

#### F4-1: ターミナル本体の右クリックメニュー（WBS F4-1）

- **説明**: `TerminalRenderer` のコンテナを Radix ContextMenu でラップし、右クリックで「プロンプトを編集...」を表示する。選択中に既存のコピー/ペースト動作を壊さないこと。
- **受け入れ条件**:
  - [ ] ターミナル本体（ターミナル描画領域）の右クリックでコンテキストメニューが表示される
  - [ ] メニュー項目 1 つ: `プロンプトを編集...`（キーヒント `⌘⇧P` / `Ctrl+⇧+P`）
  - [ ] 項目クリックで `usePromptPaletteStore.open(ptyId, tabTitle)` を呼ぶ
  - [ ] `ptyId` 未解決時（生成前）はメニュー項目 disable、または右クリック自体を抑止
  - [ ] 選択テキストがある状態の右クリックでも既存のターミナル操作（macOS 標準のコピー等）を壊さない（メニューは表示する）
  - [ ] パレット表示中の右クリックは no-op（Radix Dialog が非モーダルだが、二重起動を防止）もしくは既存どおりメニュー表示（仕様は実装時に決定、シンプル側）

#### F4-2: 挿入プレビューのハイライト（WBS F4-2）

- **説明**: パレット表示中にパス挿入が実行された直後、挿入文字列を一瞬ハイライトする。textarea 内の文字単位のハイライトは実装コストが高いので、v1.1 スコープでは **「挿入が起きたこと」を textarea 全体のフラッシュで示す簡易実装** に留める。精密な挿入範囲ハイライトは v1.2 以降で検討。
- **受け入れ条件**:
  - [ ] `insertAtCaret` 実行直後、textarea の枠線または背景が 300ms 程度フラッシュする（CSS アニメーション）
  - [ ] 連続挿入時もアニメーションが上書き・リトリガーされる
  - [ ] アニメーション中も通常の入力操作が可能
  - [ ] アクセシビリティ: `prefers-reduced-motion` を尊重し、設定 on の環境ではフラッシュを 100ms の静的変化に縮める、あるいはスキップする

### 非機能要件

- **パフォーマンス**: F4-1 のメニュー表示は 50ms 以内。F4-2 のハイライト中に入力遅延がないこと。
- **保守性**: `TerminalRenderer` の描画ロジック（Canvas）には触らず、ラッパ DOM でメニューを提供する。
- **アクセシビリティ**: Radix ContextMenu の標準アクセシビリティ属性に従う。ハイライトは `prefers-reduced-motion` を尊重。
- **クロスプラットフォーム**: F4-1 は macOS / Windows / Linux のいずれでも Radix の挙動に準じて動作。F4-2 は CSS のみで差異なし。

### F4 で扱わない項目

- **v1.2 候補**: textarea 内の挿入文字列に限定したハイライト（オーバーレイ実装）
- **v2 候補**: ターミナル本体右クリックメニューへの他項目追加（コピー・ペースト・Clear など）
- **対象外**: プロンプト履歴、テンプレート、下書き永続化

## スコープ

### 対象

- `TerminalRenderer` のコンテナ DOM への Radix ContextMenu ラッパ追加（新規の薄いコンポーネント）
- メニュー項目からの `promptPaletteStore.open()` 呼び出し
- `PromptPalette.tsx` の textarea に挿入フラッシュ用 state / CSS アニメーションを追加
- `promptPaletteStore.insertAtCaret` に「挿入が起きた」シグナル（tick 値など）を追加し、UI 側で購読

### 対象外

- Canvas 描画ロジックの変更
- 新規 Rust コマンド
- secondary pane のアクティブ解決ロジック変更（F2 からの既知制約を据え置き）

## 実装対象ファイル（予定）

**新設**
- `src/components/TerminalPanel/TerminalBodyContextMenu.tsx`（または同階層）
  - Radix ContextMenu で TerminalRenderer をラップする薄いコンポーネント
  - 項目 1 つのみ（「プロンプトを編集...」）

**変更**
- `src/components/TerminalPanel/TerminalTabs.tsx`（または `TerminalPanel.tsx`）
  - `TerminalPanel` の描画結果を `TerminalBodyContextMenu` でラップ、`ptyId` と `tabTitle` を渡す
- `src/stores/promptPaletteStore.ts`
  - 挿入シグナル用の状態（`lastInsertAt: number | null` など）を追加。`insertAtCaret` 実行時に `Date.now()` / 単調増加カウンタを書き込む
- `src/components/PromptPalette/PromptPalette.tsx`
  - `lastInsertAt` を購読し、変化したら textarea にフラッシュクラスを付与 → 300ms 後に剥がす
  - `prefers-reduced-motion` 判定
- `src/i18n/locales/ja.json` / `src/i18n/locales/en.json`
  - `terminalBody.menu.openPalette` もしくは既存 `promptPalette.menu.openPalette` を流用
- ユニットテスト:
  - `promptPaletteStore.test.ts` — `insertAtCaret` で `lastInsertAt` が更新されることを検証
  - `TerminalBodyContextMenu.test.tsx`（必要に応じて）

## 依存関係

- `@radix-ui/react-context-menu`（既存 `TabContextMenu` で利用中）
- `promptPaletteStore` の既存 `open` / `insertAtCaret`
- `useTerminalStore` の `computeDisplayTitle`

## 既知の制約

- ターミナルの Canvas は独自入力を持つため、右クリックを Radix のトリガとして受けるには、`onContextMenu` が Canvas 上でも発火することを確認する必要がある（DOM コンテナへのイベントは届くので問題にならない見込み）。
- 挿入フラッシュは textarea 全体の視覚変化に留めるため、「どこに挿入されたか」までは伝わらない（キャレット位置自体は挿入末尾にあるのでそれで補う）。

## 参考資料

- `src/components/TerminalPanel/TabContextMenu.tsx` — 既存 Radix ContextMenu の実装パターン
- `src/components/TerminalPanel/TerminalRenderer.tsx:632-685` — コンテナ DOM 構造
- `src/stores/promptPaletteStore.ts` — 既存 `insertAtCaret` 実装
- `src/components/PromptPalette/PromptPalette.tsx` — textarea の現行スタイル
- `docs/local/20260415-プロンプト編集パレット/02_概要設計書.md` §3.3, §9（F4 は任意）
