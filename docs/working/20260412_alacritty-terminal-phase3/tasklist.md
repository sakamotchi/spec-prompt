# タスクリスト - alacritty-terminal Phase 3（スクロールバック・選択コピー・パス挿入）

## 進捗サマリー

| 状態 | 件数 |
|------|------|
| 完了 | 8 |
| 進行中 | 0 |
| 未着手 | 0 |

## タスク一覧

### T-1: scrollback history 有効化（Rust）

- [x] `terminal/instance.rs` の `Config::default()` を `Config { scrolling: Scrolling { history: 10_000, .. }, .. }` に変更する
- [x] `TermSize::total_lines()` を `screen_lines + 10_000` を返すよう変更する
- [x] `terminal/mod.rs` の `TerminalCellsPayload` に `scroll_offset: u32` と `scrollback_len: u32` を追加する
- [x] `collect_damage` の返り値にスクロール情報を含める（`term.grid().display_offset()` / `term.grid().history_size()`）
- [x] `cargo check` でエラーなし

### T-2: scroll_terminal コマンド（Rust + tauriApi）

- [x] `commands/pty.rs` に `scroll_terminal(id, delta: i32)` コマンドを追加する
- [x] `term.scroll_display(Scroll::Delta(delta))` を呼び、即時 cells emit する
- [x] `lib.rs` にコマンドを登録する
- [x] `tauriApi.ts` に `scrollTerminal(id: string, delta: number): Promise<void>` を追加する
- [x] `TerminalCellsPayload` 型に `scrollOffset` / `scrollbackLen` を追加する
- [x] `cargo check` / `npm run build` でエラーなし

### T-3: TerminalRenderer にスクロール機能を追加

- [x] `scrollOffsetRef` / `scrollbackLenRef` を追加し、payload 受信時に更新する
- [x] container div の `onWheel` で `scrollTerminal` を呼ぶ（`e.preventDefault()`）
- [x] キー入力時に `scrollOffset > 0` なら `scrollTerminal(id, -scrollOffset)` で末尾に戻す
- [x] スクロールバー UI（右端の半透明 div、高さ・位置をスクロール率から計算）を追加する
- [x] 動作確認: `yes` コマンドでスクロールバックが貯まり、ホイールで遡れる

### T-4: テキスト選択（マウスイベント）

- [x] `selectionRef` / `isDraggingRef` を追加する
- [x] `pixelToCell(x, y, cw, ch, dpr)` ユーティリティ関数を実装する
- [x] `normalizeSelection(sel)` で start/end を行・列順に正規化する関数を実装する
- [x] container div に `onMouseDown` / `onMouseMove` / `onMouseUp` を追加する
- [x] `drawCursor()` に選択ハイライト描画を追加する（`rgba(124,106,247,0.35)` で塗る）
- [x] キー入力時に選択を解除する

### T-5: コピー（Cmd+C）

- [x] `extractSelectedText(cells, sel, cols)` 関数を実装する（行ごとに文字を結合、末尾空白をトリム）
- [x] `TerminalRenderer` の `keydown` ハンドラ（container の `onKeyDown`）に Cmd+C 処理を追加する
- [x] `navigator.clipboard.writeText(text)` でクリップボードに書き込む
- [x] 選択なし時は何もしない

### T-6: ペースト（Cmd+V）

- [x] `TerminalRenderer` の `keydown` ハンドラに Cmd+V 処理を追加する
- [x] `navigator.clipboard.readText()` → `writePty(ptyId, text)` を実装する
- [x] `e.preventDefault()` で hidden textarea への貼り付けを防ぐ

### T-7: パス挿入の動作確認と修正

- [x] `TerminalPanel.tsx` が PTY spawn 後に `terminalStore.updateTab(tabId, { ptyId })` を呼んでいることを確認する
- [x] 呼んでいない場合は追記する
- [x] Ctrl+Click でのパス挿入が動作することを手動確認する
- [x] PathPalette（Ctrl+P）からのパス挿入が動作することを手動確認する

### T-8: Feature Flag 廃止・xterm.js 削除

- [x] `TerminalPanel.tsx` から `USE_CANVAS_RENDERER` フラグと xterm.js コードを削除し `<TerminalRenderer>` を直接レンダリングする
- [x] `terminalStore.ts` から `appendScrollback` / `scrollback` フィールドを削除する
- [x] `package.json` から `@xterm/xterm` / `@xterm/addon-fit` を削除して `npm install` する
- [x] `npm run lint` がエラーなし
- [x] `npm run build` がエラーなし
- [x] `cd src-tauri && cargo test` がパス

## 完了条件

- [x] 全タスクが完了している
- [x] `npm run lint` がエラーなし
- [x] `npm run build` がエラーなし（型チェック完了）
- [x] `cd src-tauri && cargo test` がパス
- [x] マウスホイールで過去の出力を遡れる
- [x] Cmd+C でテキストをコピーできる
- [x] Cmd+V でテキストを貼り付けられる
- [x] Ctrl+Click でパスがターミナルに挿入される
- [x] `VITE_USE_CANVAS_RENDERER` なしで `npx tauri dev` が正常動作する
