# 要件定義書 - alacritty-terminal Phase 3（スクロールバック・選択コピー・パス挿入）

## 概要

Phase 2 で実装した Canvas セルレンダラーにターミナルとして最低限必要な残機能を追加し、
xterm.js を完全に置き換えて Feature Flag を廃止する。

## 背景・目的

Phase 2 完了時点での Canvas レンダラーの未実装項目：

- スクロールバック（過去出力をマウスホイールで遡れない）
- テキスト選択・コピー（マウスドラッグで範囲選択 → Cmd+C でクリップボードへ）
- ペースト（Cmd+V でクリップボード内容を PTY に送信）
- パス挿入（`usePathInsertion` フックが Canvas モードで未検証）

これらを実装することで xterm.js と同等の基本操作を提供し、`VITE_USE_CANVAS_RENDERER` Feature Flag を廃止する。

---

## 機能要件

### 3-A: スクロールバック

| ID | 要件 |
|----|------|
| 3-A-1 | alacritty-terminal の scrollback history を有効化する（10,000 行） |
| 3-A-2 | マウスホイール（trackpad スクロール含む）で過去の出力を遡れる |
| 3-A-3 | スクロール中も PTY への入力が可能である |
| 3-A-4 | キー入力時にスクロール位置が末尾に戻る（scroll-to-bottom on input） |
| 3-A-5 | スクロール位置を示すスクロールバー UI を表示する |

### 3-B: テキスト選択・コピー・ペースト

| ID | 要件 |
|----|------|
| 3-B-1 | マウスドラッグ（mousedown → mousemove → mouseup）でセル範囲を選択できる |
| 3-B-2 | 選択範囲が Canvas 上に半透明ハイライトで視覚的に示される |
| 3-B-3 | Cmd+C で選択範囲のテキストをクリップボードにコピーできる |
| 3-B-4 | Cmd+V でクリップボードの内容を PTY に貼り付けられる |
| 3-B-5 | 選択後に任意のキー入力をすると選択が解除される |

### 3-C: パス挿入（Canvas モード互換確認）

| ID | 要件 |
|----|------|
| 3-C-1 | `usePathInsertion` フックが Canvas モードで正常動作する |
| 3-C-2 | ファイルツリーの Ctrl+Click でパスがターミナルに挿入される |
| 3-C-3 | PathPalette（Ctrl+P）でパスを検索して Enter で挿入できる |
| 3-C-4 | 右クリックメニュー「パスをターミナルに挿入」が動作する |

### 3-D: Feature Flag 廃止・xterm.js 削除

| ID | 要件 |
|----|------|
| 3-D-1 | `VITE_USE_CANVAS_RENDERER` 環境変数が不要になる |
| 3-D-2 | xterm.js 関連コード（`@xterm/xterm`、`@xterm/addon-fit`）を削除する |
| 3-D-3 | `terminalStore.appendScrollback` など xterm.js 専用 API を削除する |
| 3-D-4 | `npm run build` が通る |

---

## 非機能要件

| 項目 | 要件 |
|------|------|
| スクロールパフォーマンス | ホイール入力から再描画まで 1 フレーム（16ms）以内 |
| 選択描画の遅延 | mousemove から選択ハイライト更新まで 1 フレーム以内 |
| メモリ | scrollback 10,000 行保持時の追加メモリ < 20MB |

---

## 対象外

- マウス報告モード（VT200 マウスプロトコル）のターミナルへの転送
- 選択範囲の行方向選択（矩形選択）
- ダブルクリックによる単語選択
