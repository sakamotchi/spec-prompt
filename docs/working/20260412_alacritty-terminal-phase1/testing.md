# テスト手順書 - alacritty-terminal Phase 1（Rust側実装）

## 概要

Phase 1 は Rust 側のみの変更であり、WebView の表示は変わらない。
確認の中心は「既存機能が壊れていないこと」と「新しい `terminal-cells` イベントが正しく届いていること」の2点。

## 前提条件

- `npx tauri dev` でアプリが起動していること
- ブラウザ DevTools が使用できること（Tauri dev モードでは `Cmd+Option+I` で開く）

---

## 手動テスト

### ケース 1: アプリが正常に起動する

**手順:**

1. `npx tauri dev` を実行する
2. アプリウィンドウが表示されることを確認する

**期待結果:**

- コンパイルエラーなくビルドが完了する
- アプリウィンドウが表示される

**確認結果:**

- [x] OK / NG

---

### ケース 2: 既存のターミナル（xterm.js）が正常動作する

**手順:**

1. アプリを起動する
2. ターミナルタブを開く
3. `echo "hello"` を入力して Enter する
4. `ls` を入力して Enter する
5. Claude Code（`claude`）を起動する

**期待結果:**

- `echo "hello"` の出力が表示される
- `ls` のファイル一覧が表示される
- Claude Code が起動し、プロンプトが表示される（文字化けの有無は Phase 1 のスコープ外）

**確認結果:**

- [x] OK / NG

---

### ケース 3: `terminal-cells` イベントが届いている

**手順:**

1. DevTools を開く（`Cmd+Option+I`）
2. Console タブで以下のコードを実行してイベントリスナーを登録する（Tauri v2 用）:
   ```js
   const handler = window.__TAURI_INTERNALS__.transformCallback(
     (e) => console.log('terminal-cells:', JSON.stringify(e, null, 2)),
     true
   )
   window.__TAURI_INTERNALS__.invoke('plugin:event|listen', {
     event: 'terminal-cells',
     target: { kind: 'Any' },
     handler
   })
   ```
3. ターミナルで `echo "test"` を実行する

**期待結果:**

- Console に `terminal-cells:` と続くオブジェクトが出力される
- `cells` 配列に `{ row, col, ch, width, fg, bg, flags }` 形式のオブジェクトが含まれる
- `cursor` に `{ row, col }` が含まれる

**確認結果:**

- [x] OK / NG

---

### ケース 4: `pty-output` イベントが引き続き届いている

**手順:**

1. DevTools の Console で以下を実行する（Tauri v2 用）:
   ```js
   const handler2 = window.__TAURI_INTERNALS__.transformCallback(
     (e) => console.log('pty-output:', e),
     true
   )
   window.__TAURI_INTERNALS__.invoke('plugin:event|listen', {
     event: 'pty-output',
     target: { kind: 'Any' },
     handler: handler2
   })
   ```
2. ターミナルで `echo "pty-test"` を実行する

**期待結果:**

- Console に `pty-output: ...` と生バイト列文字列が出力される（xterm.js との並行動作確認）

**確認結果:**

- [x] OK / NG

---

### ケース 5: リサイズ後も正常動作する

**手順:**

1. ターミナルを起動する
2. ウィンドウサイズを変更する
3. Network タブで `resize_pty` が呼ばれることを確認する
4. ターミナルで `tput cols` を実行し、列数が変化していることを確認する

**期待結果:**

- `tput cols` の出力が新しいウィンドウ幅に対応した列数になる

**備考:**

- フロントエンドは現在 `resize_pty` を呼んでいる。`resize_terminal`（PTY + Term 両方リサイズ）への切り替えは Phase 2 で対応予定。

**確認結果:**

- [x] OK / NG（resize_pty が動作することを確認。resize_terminal 切り替えは Phase 2）

---

### ケース 6: タブ追加・削除で TerminalInstance が正しく管理される

**手順:**

1. ターミナルタブを2つ開く
2. 両タブで `echo "tab test"` を実行し、それぞれで `terminal-cells` イベントが届くことを確認する
3. タブを1つ閉じる
4. 閉じたタブの `id` に対する `terminal-cells` イベントが届かなくなることを確認する

**期待結果:**

- 各タブが独立した `terminal-cells` イベントを受信する
- タブ削除後はそのタブのイベントが送信されなくなる

**確認結果:**

- [ ] OK / NG

---

## 自動テスト

### Rust テスト

```bash
cd src-tauri && cargo test
```

確認事項:
- `terminal::grid` モジュールの `CellData` シリアライズテストがパスする
- 既存の `commands::pty` テスト（`test_resolve_cwd_*`）がパスする

### 型チェック

```bash
cd src-tauri && cargo check
```

---

## エッジケース

| ケース | 期待動作 | 確認結果 |
|--------|---------|---------|
| 存在しない `id` で `resize_terminal` を呼ぶ | エラーなくスルーする | |
| 大量出力（`cat` で大きなファイル）時 | `terminal-cells` が詰まらず届く | |
| PTY が閉じた後にイベントが来ない | `close_pty` 後はイベントが止まる | |

## 回帰テスト

既存機能への影響がないことを確認します。

- [ ] ファイルツリーが正常に表示される
- [ ] マークダウンプレビューが正常に動作する
- [ ] ターミナルが正常に起動・動作する（xterm.js）
- [ ] 設定ダイアログが正常に開く
- [ ] パス挿入（Ctrl+Click / Ctrl+P）が正常に動作する
