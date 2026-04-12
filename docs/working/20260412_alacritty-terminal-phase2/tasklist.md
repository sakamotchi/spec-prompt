# タスクリスト - alacritty-terminal Phase 2（WebView セルレンダラー実装）

## 進捗サマリー

| 状態 | 件数 |
|------|------|
| 完了 | 10 |
| 進行中 | 0 |
| 未着手 | 0 |

## タスク一覧

### T-1: tauriApi 拡張（2-A 準備）✅

- [x] `tauriApi.ts` に `resizeTerminal(id, cols, rows)` を追加する
- [x] `tauriApi.ts` に `onTerminalCells(callback)` を追加する（`TerminalCellsPayload` 型定義を含む）
- [x] `cargo check` / `npm run build` でエラーなし

### T-2: Canvas セットアップと cellSize 計算（2-A-1, 2-A-2）✅

- [x] `TerminalRenderer.tsx` を新規作成する（`<canvas>` 2 枚構成：メイン + カーソルオーバーレイ）
- [x] `ResizeObserver` でコンテナサイズを監視し、Canvas の `width` / `height` を同期する
- [x] `ctx.measureText('W').width` で `cellWidth` を計算する（WKWebView CSS 計測非依存）
- [x] `cellHeight = Math.ceil(fontSize * 1.2)` で `cellHeight` を計算する
- [x] Retina 対応：`devicePixelRatio` で Canvas を拡大し CSS サイズはそのまま
- [x] `cargo check` / `npm run build` でエラーなし

### T-3: cols/rows 計算と resize_terminal 呼び出し（2-A-3）✅

- [x] `Math.floor(containerWidth / cellWidth)` / `Math.floor(containerHeight / cellHeight)` で cols/rows を計算する
- [x] コンテナリサイズ時に `tauriApi.resizeTerminal(ptyId, cols, rows)` を呼ぶ
- [x] `TerminalPanel.tsx` の `resize_pty` 呼び出しを `resize_terminal` に切り替える（Feature Flag ON 時）

### T-4: セル描画実装（2-A-4, 2-A-5, 2-A-6）✅

- [x] `onTerminalCells` で受け取ったセルを最新ペイロードとして保持し描画する
- [x] `fillRect`（背景色）+ `fillText`（文字）でセルを描画する
- [x] `wide: true` のセルは `cellWidth × 2` の背景を描画する
- [x] `CellFlags.bold` → `font-weight: bold`、`CellFlags.italic` → `font-style: italic` を canvas font に反映する
- [x] `CellFlags.underline` → `fillRect` でアンダーラインを手動描画する
- [x] `CellFlags.strikeout` → `fillRect` で打ち消し線を手動描画する
- [x] `CellFlags.inverse` → `fg` と `bg` を入れ替えて描画する
- [x] `CellFlags.dim` → `globalAlpha` を下げて描画する
- [x] `requestAnimationFrame` でリドローをスロットリング（大量出力時の入力遅延対策）

### T-5: カーソル描画（2-A-7）✅

- [x] カーソル Canvas に `cursor: { row, col }` 位置へブロックカーソルを描画する
- [x] `setInterval` + 500ms で点滅する

### T-6: カラーテーマ対応（2-B）✅

- [x] `src/components/TerminalPanel/colors.ts` を新規作成し ANSI 16色パレット（dark/light）を定義する
- [x] xterm-256 色テーブルを実装する（`Indexed 16-231` は 6×6×6 cube、`232-255` はグレースケール）
- [x] `resolveColor(color, theme, role)` を実装する（role='fg'|'bg' で Default 色を解決）
- [x] `settingsStore` のテーマ変更を監視し、変更時に Canvas を全再描画する
- [x] **バグ修正**: Rust 側で `NamedColor::Background(257)` が `as u8` でオーバーフローして赤背景になる問題を修正（`ColorData::Default` バリアントを追加）

### T-7: キーボード入力（2-C）✅

- [x] `useTerminalInput.ts` を新規作成する
- [x] `encodeKey(e: KeyboardEvent): string | null` を純粋関数で実装する
- [x] 通常文字（printable）：`e.key` をそのまま送信する
- [x] 制御文字：Ctrl+A〜Z → `\x01`〜`\x1a` のエンコードを実装する
- [x] カーソルキー（↑↓←→）/ Enter / Backspace / Tab / Escape のエスケープシーケンスを実装する
- [x] F1〜F12 のエスケープシーケンスを実装する
- [x] `encodeKey` の単体テスト（14 件）を `src/test/encodeKey.test.ts` に追加する
- [x] **IME 対応**: hidden textarea + `compositionend` で日本語入力を実装する
- [x] **IME 確定バグ修正**: `justComposed` フラグで確定 Enter が PTY に送られる問題を修正
- [x] **IME ウィンドウ位置**: textarea をカーソル座標に追従させ変換候補の位置を修正する
- [x] **変換中テキスト表示**: `compositionupdate` でカーソル Canvas に変換中文字列を描画する

### T-8: TerminalPanel Feature Flag 統合（2-A, F-4）✅

- [x] `TerminalPanel.tsx` に `import.meta.env.VITE_USE_CANVAS_RENDERER` フラグを追加する
- [x] フラグ ON 時に `<TerminalRenderer>` を使用し、フラグ OFF 時は従来の xterm.js を維持する
- [x] PTY ライフサイクル（spawn / close）は両モードで共通動作することを確認する
- [x] フラグ OFF で `npx tauri dev` を実行し、既存 xterm.js が正常動作することを確認する
- [x] `npm run build` でエラーなし
- [x] **バグ修正**: `containerRef.current` guard で Canvas モード時に PTY が spawn されない問題を修正

### T-9: 動作確認 ✅

- [x] `VITE_USE_CANVAS_RENDERER=true npx tauri dev` でアプリが起動する
- [x] `echo "hello"` が Canvas に正しく描画される
- [x] `ls` のファイル一覧（色付き）が正しい色で描画される
- [x] Claude Code（`claude`）が起動し、CJK 文字・セパレータ文字が文字化けなく表示される
- [x] ウィンドウリサイズ後も正しく再描画される
- [x] キーボード入力（矢印キー・Ctrl+C・Backspace）が正常に動作する
- [x] 日本語 IME 入力が正常に動作する
- [x] testing.md の手動テストを全件実施する

### T-10: フラグ OFF での回帰テスト ✅

- [x] `VITE_USE_CANVAS_RENDERER` なし（デフォルト）で xterm.js が正常動作する
- [x] ファイルツリー・マークダウンプレビュー・設定ダイアログが正常動作する

## 完了条件

- [x] 全タスクが完了している
- [x] `npm run lint` がエラーなし
- [x] `npm run build` がエラーなし（型チェック完了）
- [x] `cd src-tauri && cargo test` がパス
- [x] `VITE_USE_CANVAS_RENDERER=true` で Claude Code が文字化けなく表示される
- [x] `VITE_USE_CANVAS_RENDERER` なしで xterm.js が正常動作する（回帰なし）
