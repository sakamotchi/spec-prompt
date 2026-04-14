# 要件定義書 - unread-notification-mark（P4: 未読通知マーク / タブ強調表示）

## 概要

SpecPrompt の統合ターミナルで OSC 9 経由の OS 通知が発火したとき、発火元のタブに「未読印」を付けてユーザーが戻ってきたときに視覚的に判別できるようにする。ユーザーがそのタブを実際に見た瞬間にマークを解除する。

本ドキュメントは 4 フェーズ計画のうち **Phase 4** を対象とする。これで Phase 1〜4 の計画がすべて揃う。

## 背景・目的

- Phase 1 で通知タイトルにタブ名が含まれるようになり、Phase 2/3 でタブ名自体が動的・手動に扱えるようになった。
- しかし、通知を見逃した場合や複数タブで通知が発火した場合に「どのタブで承認待ちが残っているか」がアプリ復帰後に分からない。
- macOS Terminal.app / iTerm2 などではタブに未読インジケーター（ドット / 色変化）が付き、該当タブを見ると解除される挙動が一般的。SpecPrompt でも同等の体験を提供したい。
- Phase 1 で追加済みの通知発火パス（`src-tauri/src/commands/pty.rs` の OSC 9 検出ブロック、非フォーカス時のみ OS 通知を発火）にイベント emit を 1 本追加するだけで、フロント側の状態と連動できる。

## 要件一覧

### 機能要件

#### F-1: 通知発火時の未読マーク付与

- **説明**:
  OSC 9 検出で **OS 通知が実際に発火** した（＝アプリが非フォーカス状態だった）タブに `hasUnreadNotification = true` をセットする。アプリがフォーカス中のときは通知自体が抑制されるため、マークも立たない。
- **受け入れ条件**:
  - [ ] アプリをバックグラウンドにした状態で claude（またはテスト用 `printf '\033]9;...\007'`）を実行 → 該当タブに `hasUnreadNotification=true` がセットされる
  - [ ] アプリがフォアグラウンドで発火しても（通知抑制されるため）マークは立たない
  - [ ] 同一タブから連続して通知が来ても `hasUnreadNotification` は `true` のまま（冪等）
  - [ ] 通知 OFF のときは通知自体が発火しないためマークも立たない

#### F-2: マークの視覚表現

- **説明**:
  マーク付きタブは:
  1. ラベル先頭に `●`（アクセントカラーのドット）を表示
  2. タブ背景に薄いアクセントハイライト（非アクティブでも視認できる濃度）
  3. 非アクティブタブでも明確に区別できる左ボーダーアクセント
- **受け入れ条件**:
  - [ ] 表示タイトル（`computeDisplayTitle`）の前に `●` が付く
  - [ ] 背景に `var(--color-accent)` 系の薄いハイライト（透明度 15% 程度）
  - [ ] 左ボーダー 2px のアクセント色
  - [ ] アクティブなタブでもマーク付きは視覚的に区別できる
  - [ ] 既存の `max-w-[12rem] truncate` / ツールチップ表示を壊さない（ツールチップは `●` なしの純粋な表示タイトル）

#### F-3: マーク解除条件

- **説明**:
  タブがアクティブ **かつ** アプリウィンドウがフォーカス中の両方を満たした瞬間にマークを解除する。
- **受け入れ条件**:
  - [ ] マーク付きタブをクリックしてアクティブ化すると、`document.hasFocus()` が true なら即座に解除される
  - [ ] アプリがバックグラウンドの間はタブ切り替えしてもマークは残る
  - [ ] アプリがフォアグラウンドに戻った瞬間、現在アクティブなタブがマーク付きなら解除される
  - [ ] 他のタブのマークは影響を受けない（独立性）

#### F-4: マーク付与の冪等性とレース条件の防御

- **説明**:
  すでにマークが立っている状態で `markUnread` が呼ばれたとき、およびすでにアクティブ+フォーカスの状態で `markUnread` が呼ばれたときはスキップする。
- **受け入れ条件**:
  - [ ] 同一 pty への `markUnread` 連続呼び出しで state 参照が変化しない
  - [ ] アクティブ+フォーカス中のタブへの `markUnread` は no-op（ユーザーはすでに見ているため）
  - [ ] 未知の pty_id に対する `markUnread` はクラッシュせず no-op

#### F-5: セッション内のみ保持

- **説明**:
  `hasUnreadNotification` はアプリ再起動をまたいで保持しない。
- **受け入れ条件**:
  - [ ] 既存 Zustand ストアは `persist` を使っていないため、再起動で自動的に初期化される
  - [ ] タブを閉じた際にも特別な確認はしない

### 非機能要件

- **パフォーマンス**:
  - マーク付与/解除は O(1) 相当（該当 pty/tab を見つけて 1 フィールド更新のみ）
  - 同一値では state 参照を保持し、不要な再描画と `subscribe` 発火を抑止
- **ユーザビリティ**:
  - マークは視覚的に十分目立ち、かつアクセシビリティを損なわない色・コントラストを確保（アクセント色は既存の `--color-accent` を活用）
  - ホバーで出るツールチップには `●` を含めない（テキスト的に純粋な表示タイトルのまま）
- **保守性**:
  - Rust 側の変更は `pty.rs` の通知送信ブロック内で 1 行 emit を足すだけ
  - フロント側はアクション 2 本（`markUnread` / `clearUnread`）と UI の style 調整のみ
- **外観・デザイン**:
  - カラーは `src/index.css` の CSS カスタムプロパティ（`--color-accent`）を活用し、テーマ切替（dark / light）に追従

## スコープ

### 対象

- Rust: `src-tauri/src/commands/pty.rs` の OSC 9 発火ブロックで `claude-notification-fired { pty_id }` を emit
- Front: `TerminalTab` に `hasUnreadNotification: boolean` を追加
- Front: `markUnread` / `clearUnread` アクション
- Front: `AppLayout` で `claude-notification-fired` 購読、ウィンドウフォーカス復帰イベント購読
- Front: `TerminalTabs.tsx` のラベル前に `●` を合成、背景/左ボーダーのハイライト
- Front: タブクリック時に条件を満たせば `clearUnread` を呼ぶ
- テスト: Rust 側の emit 追加は既存テストに影響なし（新規テストは emit のモックが必要なためスキップ）、Front 側の `markUnread` / `clearUnread` のユニットテスト、手動 E2E

### 対象外

- 通知の履歴表示（通知センター風のパネル）
- 通知クリックで該当タブをフォーカスするディープリンク
- タブ全体に未読件数のバッジ（`●` のみで件数は表示しない）
- 未読マーク状態の永続化（アプリ再起動で失われる）
- Claude Code 以外のエージェント向けの分類

## 実装対象ファイル（予定）

- `src-tauri/src/commands/pty.rs` — OSC 9 通知発火ブロックに `app.emit("claude-notification-fired", { pty_id })` を追加
- `src/stores/terminalStore.ts` — `TerminalTab.hasUnreadNotification` フィールド、`markUnread` / `clearUnread` アクション
- `src/stores/terminalStore.test.ts` — 新アクションのテスト追加
- `src/lib/tauriApi.ts` — `onClaudeNotificationFired` リスナー追加
- `src/components/Layout/AppLayout.tsx` — `onClaudeNotificationFired` 購読、ウィンドウフォーカス復帰時の解除ロジック
- `src/components/TerminalPanel/TerminalTabs.tsx` — ラベルへの `●` 合成、背景/左ボーダーの未読スタイル、クリック時 `clearUnread`

## 依存関係

- Phase 1〜3 の成果物すべて:
  - `TerminalTab` 型（`ptyId` / `fallbackTitle` / `oscTitle` / `manualTitle` / `pinned`）
  - `computeDisplayTitle` 関数
  - `AppLayout` での Zustand subscribe
  - OSC 9 検出 + 通知発火パス（`pty.rs` 内のフォーカス判定）
- `@tauri-apps/api/window` の `getCurrentWindow().onFocusChanged`
- `@tauri-apps/api/event` の `listen`

## 既知の制約

- `document.hasFocus()` は WebView 内の判定。Tauri のウィンドウフォーカスと完全一致しない可能性があるが、P4 ではタブクリック時の解除条件にこれを使用する。復帰時の解除は Tauri の `onFocusChanged` を使うため、片方が厳密でなくても安全側に倒れる（アプリフォーカス復帰イベントが来ない限り解除しない）。
- ペインが Content モード（ターミナル非表示）のまま復帰した場合、アクティブタブ側の解除は行うが、UI にはそもそも表示されていない。次にターミナルモードに切り替えたときにマークが消えた状態で見えるので問題にはならない。
- Rust 側で通知発火時に emit する `claude-notification-fired` は **非フォーカス時のみ** emit する（既存の `is_app_focused` 判定ブロック内で行う）。フォーカス中の OSC 9 では emit しない。

## 参考資料

- `docs/local/20260414-タブ識別通知と動的タブタイトル/01_要件定義書.md` — 全体要件（FR-05, FR-06 が本フェーズ相当）
- `docs/local/20260414-タブ識別通知と動的タブタイトル/02_概要設計書.md` — 全体設計（3-X 未読通知マーク章）
- `docs/local/20260414-タブ識別通知と動的タブタイトル/03_WBS.md` — Phase 4 セクション
- `docs/working/20260414_notification-tab-name/` — Phase 1 の要件・設計・テスト
- `docs/working/20260414_dynamic-tab-title/` — Phase 2
- `docs/working/20260414_manual-tab-rename/` — Phase 3
- Tauri ウィンドウフォーカスイベント: https://v2.tauri.app/reference/javascript/api/namespacewindow/
