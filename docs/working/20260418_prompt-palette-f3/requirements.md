# 要件定義書 - prompt-palette-f3

## 概要

プロンプト編集パレットのフェーズ F3（体験の仕上げ）として、見落としがちな挙動を潰す。具体的には (1) タブ閉鎖時の下書き破棄、(2) IME 抑止の仕上げ、(3) グローバルショートカット競合の整理（**F1 から繰越**）、(4) 送信失敗時のトーストを実装する。F3 完了をもって v1 リリース可能とする。

- 元仕様: `docs/local/20260415-プロンプト編集パレット/01_要件定義書.md`, `02_概要設計書.md`, `03_WBS.md`
- WBS 対応: フェーズ F3（F3-1 〜 F3-5）
- 対応する受け入れ基準（元要件 §7）: **9, 10, 11, 13, 14, 15**（14 は F1 からの繰越）
- 前提:
  - F1 コミット済み: `d6076ed`
  - F2 コミット済み: `2773a53`

## 背景・目的

F1 / F2 で主要機能は揃ったが、以下の積み残しがある：

- パレット下書きがターミナルタブを閉じてもメモリに残り続け、新しいタブに同じ `ptyId`（実際には新規 UUID のため起きないが、論理的に破棄の責務を定義しておく必要がある）や、予期せぬタイミングで開き直したときの UX が崩れる。
- F1 の E2E（ケース 8）で、`Ctrl+Tab` / `F2` / `Cmd+T` / `Cmd+W` などのグローバルショートカットがパレット表示中に発火してしまう問題が判明。F1 では textarea 側の `stopPropagation` に頼っていたが、`AppLayout.tsx` のキャプチャフェーズリスナが先に走るため抑止できず F3 に繰越となった。
- IME 変換中の `Enter` / `Cmd+Enter` は F1 で `e.nativeEvent.isComposing` による 1 段階のガードのみ。`onCompositionStart/End` との二重ガードで堅牢化する必要がある（日本語 IME の macOS / Windows 差異）。
- `write_pty` が失敗した場合、現状はコンソールに出すだけでユーザーへの通知がなく、送信された／されないの判別がつかない。トースト通知 + パレット維持の仕様を完成させる。

## 要件一覧

### 機能要件

#### F3-1: タブ閉鎖時の下書き破棄（WBS F3-1）

- **説明**: ターミナルタブが閉じられた／PTY が終了した際に、該当タブの下書きを `promptPaletteStore.drafts` から破棄する。もしパレットが開いておりその `targetPtyId` が閉じられたタブに一致する場合は `close()` する。
- **受け入れ条件**:
  - [ ] `terminalStore.closeTab(id, pane)` 実行時、閉じられるタブの `ptyId` があれば `promptPaletteStore.clearDraft(ptyId)` を呼ぶ
  - [ ] `terminalStore.handlePtyExited(ptyId)` 実行時、PTY が終了したタブが実際に削除されたケースで `clearDraft(ptyId)` を呼ぶ
  - [ ] `terminalStore.closeActiveTab(pane)` 実行時も同様
  - [ ] 上記いずれかでパレットが `targetPtyId===閉じられた ptyId` なら `close()` を呼ぶ
  - [ ] store 間の循環依存を避けるため、依存方向は `terminalStore` → `promptPaletteStore`（import）。`getState()` で一方向参照に留める
  - [ ] ユニットテスト: 下書きがある状態で `closeTab` / `handlePtyExited` を呼び、該当下書きが消え、他タブの下書きは残ることを検証

#### F3-2: IME 抑止の仕上げ（WBS F3-2）

- **説明**: 日本語 IME の変換確定中に `Enter` / `Cmd+Enter` が送信として処理されないことを、`onCompositionStart/End` と `e.nativeEvent.isComposing` の 2 段ガードで担保する。
- **受け入れ条件**:
  - [ ] `PromptPalette.tsx` で `isComposing` ローカル state を `onCompositionStart` / `onCompositionEnd` で切り替え
  - [ ] `handleKeyDown` の送信判定で `(isComposing || e.nativeEvent.isComposing)` のどちらかが true なら送信しない
  - [ ] 変換確定直後の Enter（`isComposing` は false に戻ったが `isComposing` state の反映が遅延するケース）でも、`e.nativeEvent.isComposing` で拾える
  - [ ] ユニットテスト: `compositionstart` → `Cmd+Enter` → `writePty` が呼ばれない、`compositionend` 後の `Cmd+Enter` で送信されることを検証

#### F3-3: グローバルショートカット競合の整理（WBS F3-3、**F1 から繰越**）

- **説明**: `AppLayout.tsx` の keydown リスナ冒頭に `usePromptPaletteStore.getState().isOpen` の早期 return を集約する。パレット表示中は以下のみ通す：
  - textarea のプレーン入力（任意キー）
  - `Cmd+Enter` / `Ctrl+Enter`（送信、PromptPalette の textarea ハンドラで処理）
  - `Esc`（Radix Dialog の既定ハンドラで close）
  - `Ctrl+P`（パス検索パレット、F2 で textarea に挿入経路を整備済み）
  - `Cmd+Shift+P` / `Ctrl+Shift+P`（Prompt Palette の再起動キー。重複起動は `isOpen` チェックで no-op）
- **受け入れ条件**:
  - [ ] `AppLayout.tsx` の keydown 最上部に `if (usePromptPaletteStore.getState().isOpen) { /* allow list */ return }` を配置
  - [ ] `Ctrl+Tab` / `F2` / `Cmd+T` / `Cmd+W` / `Cmd+0` / `Cmd+1-9` / `Cmd+\` / `Cmd+Shift+\` / `?` / `Ctrl+Shift+Tab` がパレット表示中は発火しない
  - [ ] 上記 allow list のショートカットはパレット表示中でも従来どおり動作
  - [ ] ユニットテストは optional（AppLayout のキー処理ロジックは純関数に切り出しづらいため手動 E2E を主とする）

#### F3-4: 送信失敗時のトースト（WBS F3-4）

- **説明**: `writePty` が失敗した場合、`toast.error` でユーザーに失敗を通知し、パレットは閉じず本文も保持する。
- **受け入れ条件**:
  - [ ] `PromptPalette.handleSubmit` の `await tauriApi.writePty(...)` が reject した場合、`toast.error(t('promptPalette.error.sendFailed', { message: String(err) }))` を呼ぶ
  - [ ] 失敗時は `clearDraft` / `close` を呼ばない（本文・パレット表示を維持）
  - [ ] 成功時の既存動作（`clearDraft` → `close` → `terminal:focus` 発火）は変更しない
  - [ ] i18n キー `promptPalette.error.sendFailed` を ja / en に追加
  - [ ] コンポーネントテストで `writePty` を reject させ、toast エラーが発火し、`isOpen=true` が維持されることを検証

#### F3-5: 動作確認 → ユーザー確認 → コミット（WBS F3-5）

- **説明**: `testing.md` に沿って受け入れ基準 9, 10, 11, 13, 14, 15 を手動で確認し、ユーザー承認を得てからコミットする。
- **受け入れ条件**:
  - [ ] 受け入れ基準 9（下書き復元が同一タブで動作）
  - [ ] 受け入れ基準 10（送信成功時に下書きクリア）
  - [ ] 受け入れ基準 11（タブ閉鎖で下書き破棄）
  - [ ] 受け入れ基準 13（IME 変換中の Enter / Cmd+Enter 抑止）
  - [ ] 受け入れ基準 14（グローバルショートカット抑止）
  - [ ] 受け入れ基準 15（送信失敗時トースト + パレット維持）
  - [ ] `npm run lint` / `npm run build` / `npx vitest run` / `cd src-tauri && cargo check` が全てパス

### 非機能要件

- **パフォーマンス**: タブ閉鎖時のフック追加で既存の close 処理が遅延しないこと（100ms 以内）。
- **ユーザビリティ**: トーストは既存 `ToastHost` のスタイルと整合。エラー文言は短く原因がわかる形式（`プロンプトの送信に失敗しました: {{message}}`）。
- **保守性**: `terminalStore` から `promptPaletteStore` への参照は `getState()` による一方向依存に統一。循環を避ける。
- **アクセシビリティ**: IME 抑止はキーボードのみで完結。スクリーンリーダには影響しない。

### F3 で扱わない項目

- **F4 以降（v1.1 候補）**: ターミナル本体右クリックからの起動、挿入プレビューのハイライト。
- **v1 スコープ外**（元要件 §6）: プロンプト履歴、テンプレート、下書きディスク永続化、複数パレット同時表示。

## スコープ

### 対象

- `terminalStore` のタブ閉鎖系アクションに `promptPaletteStore.clearDraft` フック
- `PromptPalette.tsx` の IME ガード強化（`compositionstart/end` state + `isComposing` の二重）
- `AppLayout.tsx` keydown 冒頭に `isOpen` 早期 return（allow list 運用）
- `PromptPalette.handleSubmit` に `writePty` 失敗時のトースト処理
- i18n キー `promptPalette.error.sendFailed` 追加
- ユニット / コンポーネントテスト追加

### 対象外

- 新規 Rust コマンド（変更なし）
- `Ctrl+P` 自体の挙動変更（F2 で対応済み）
- secondary pane のアクティブタブ解決強化（F4 候補）

## 実装対象ファイル（予定）

**変更**
- `src/stores/terminalStore.ts` — タブ閉鎖時に `promptPaletteStore.clearDraft` 呼び出し
- `src/stores/terminalStore.test.ts` — 下書き破棄の連携テスト追加
- `src/components/PromptPalette/PromptPalette.tsx` — IME state / トースト呼び出し
- `src/components/PromptPalette/PromptPalette.test.tsx` — IME / トーストのテスト追加
- `src/components/Layout/AppLayout.tsx` — keydown 冒頭に `isOpen` allow list 早期 return
- `src/i18n/locales/ja.json` / `src/i18n/locales/en.json` — `promptPalette.error.sendFailed` 追加

## 依存関係

- 既存 Toast 基盤: `src/components/Toast/toastBus.ts`（`toast.error(message)`）
- `promptPaletteStore` (F1/F2 で実装済み) の `clearDraft` / `close`
- `AppLayout.tsx` の既存 keydown リスナ

## 既知の制約

- `terminalStore` からの store 間依存が増えるが、モジュール初期化順によっては問題になる可能性がある。`getState()` による遅延参照で回避する。
- IME 挙動は macOS / Windows / Linux で微差があるため、`testing.md` のケース 13 は macOS で必ず実施、他 OS は可能な範囲で。

## 参考資料

- `docs/local/20260415-プロンプト編集パレット/02_概要設計書.md` §2.4, §2.5, §2.6, §7
- `docs/working/20260418_prompt-palette-f1/testing.md` ケース 8 — NG 根因
- `src/components/Toast/toastBus.ts` — 既存トースト API
- `src/components/Layout/AppLayout.tsx:22-125` — 現行 keydown リスナ
- `src/stores/terminalStore.ts:100-138, 277-286` — `closeTab` / `handlePtyExited` / `closeActiveTab`
