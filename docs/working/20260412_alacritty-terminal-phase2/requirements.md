# 要件定義書 - alacritty-terminal Phase 2（WebView セルレンダラー実装）

## 概要

Phase 1 で構築した Rust 側の `terminal-cells` IPC を受け取り、WebView 側に Canvas ベースのセルレンダラーを実装する。
xterm.js を並行稼働させたまま、`TerminalRenderer` コンポーネントを Feature Flag で切り替えられる状態にする。

## 背景・目的

xterm.js が WKWebView のフォント計測 API（CSS `offsetWidth`）に依存しており、CJK 文字・セパレータ文字の文字化けが根本的に解消できない。
Canvas 2D API の `ctx.measureText()` はレンダリングコンテキストに直接クエリするため WKWebView の CSS カスケード遅延の影響を受けず、正確なセル幅を取得できる。

Phase 2 の目標は「`TerminalRenderer` で `echo "test"` が文字化けなく表示できること」。

## 要件一覧

### 機能要件

#### F-1: TerminalRenderer コンポーネント（Canvas 描画）

- **説明**: `terminal-cells` イベントを受け取り、Canvas 2D API でセルグリッドを描画する
- **受け入れ条件**:
  - [ ] `echo "test"` の出力がセルグリッドとして Canvas に描画される
  - [ ] `ctx.measureText('W').width` で cellWidth を計算し、CSS 計測に依存しない
  - [ ] 半角文字は cellWidth × 1、全角文字（wide=true）は cellWidth × 2 の幅で描画される
  - [ ] カーソル位置が `cursor: { row, col }` に従って描画される
  - [ ] カーソルが点滅アニメーションする

#### F-2: ANSI カラー対応

- **説明**: `ColorData`（Named / Indexed / Rgb）を Canvas の色文字列に変換して描画する
- **受け入れ条件**:
  - [ ] ANSI 16色（Named 0-15）がダーク／ライトテーマ別のパレットで描画される
  - [ ] xterm-256色（Indexed 0-255）が正しい RGB で描画される
  - [ ] Rgb 直接指定（truecolor）が正しい色で描画される
  - [ ] テーマ変更時に Canvas が再描画される

#### F-3: キーボード入力（useTerminalInput）

- **説明**: `keydown` イベントを PTY 入力バイト列にエンコードして `write_pty` に送る
- **受け入れ条件**:
  - [ ] 通常の文字入力（英数字・記号）が PTY に送信される
  - [ ] Ctrl+A〜Z、Ctrl+C / Ctrl+D などの制御文字が正しくエンコードされる
  - [ ] 矢印キー・Enter・Backspace・Tab・Escape が正しいエスケープシーケンスで送信される
  - [ ] F1〜F12 が正しいエスケープシーケンスで送信される

#### F-4: TerminalPanel への Feature Flag 統合

- **説明**: `VITE_USE_CANVAS_RENDERER` 環境変数または設定フラグで xterm.js と TerminalRenderer を切り替える
- **受け入れ条件**:
  - [ ] フラグ OFF 時は従来の xterm.js が動作する（既存機能を壊さない）
  - [ ] フラグ ON 時は TerminalRenderer が使用される
  - [ ] TerminalPanel の PTY ライフサイクル（spawn / close）は共通で動作する
  - [ ] `resize_terminal` コマンドが呼ばれ、PTY と Term 両方がリサイズされる

### 非機能要件

- **パフォーマンス**: 大量出力時（`cat` 大ファイル）でも Canvas 描画が詰まらないこと。差分セルのみ再描画することで最小化する
- **ユーザビリティ**: 既存の xterm.js と同等のキーボード操作感を提供する
- **保守性**: カラーパレット・キーマップは定数ファイルに分離し、テスタブルな純粋関数で実装する
- **外観・デザイン**: 背景色・前景色は `settingsStore` のテーマ設定を参照する。カーソル色は既存の `#7c6af7` を継続使用する

## スコープ

### 対象

- `src/components/TerminalPanel/TerminalRenderer.tsx`（新規）
- `src/components/TerminalPanel/useTerminalInput.ts`（新規）
- `src/components/TerminalPanel/TerminalPanel.tsx`（Feature Flag 追加・`resize_terminal` 切り替え）
- `src/lib/tauriApi.ts`（`resizeTerminal` / `onTerminalCells` 追加）

### 対象外

- スクロールバック（Phase 3）
- テキスト選択・コピー（Phase 3）
- xterm.js の完全削除（Phase 4）
- Rust 側の変更（Phase 1 で完結済み）

## 実装対象ファイル（予定）

- `src/components/TerminalPanel/TerminalRenderer.tsx`
- `src/components/TerminalPanel/useTerminalInput.ts`
- `src/components/TerminalPanel/TerminalPanel.tsx`
- `src/lib/tauriApi.ts`

## 依存関係

- Phase 1 完了済み（`terminal-cells` IPC 確認済み）
- `@tauri-apps/api/event` の `listen` / `UnlistenFn`（既存）

## 既知の制約

- WKWebView の Canvas 2D API は Chrome/Safari と同等の実装であり、`ctx.measureText()` の精度は問題ない
- `terminal-cells` イベントは毎フレーム届く可能性があるため、Canvas への描画は `requestAnimationFrame` でスロットリングする設計を検討する
- キーボード入力エンコードの完全な網羅は Phase 2 では行わない。主要キーに絞り、Phase 3 で拡充する
