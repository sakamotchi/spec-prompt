# テスト手順書 - Phase 2: hooks 注入

## 概要

claude ラッパースクリプトと hooks コマンドスクリプトが正しく動作し、SpecPrompt 内の Claude Code で自動通知が機能することを確認する。

## 前提条件

- Phase 1 が完了していること（HTTP サーバー + 通知が動作）
- `npx tauri dev` でアプリが起動していること
- Claude Code がインストールされていること

## 手動テスト

### ケース 1: スクリプトが正しく配置される

**手順:**

1. `~/.config/spec-prompt/` ディレクトリを削除する（存在する場合）
2. `npx tauri dev` でアプリを起動する
3. 以下のファイルが作成されていることを確認:
   ```bash
   ls -la ~/.config/spec-prompt/bin/claude
   ls -la ~/.config/spec-prompt/hooks/claude-notify.sh
   ```

**期待結果:**

- 両ファイルが存在し、実行権限（`-rwxr-xr-x`）が付与されている

**確認結果:**

- [ ] OK / NG

---

### ケース 2: ラッパーが本物の claude を見つける

**手順:**

1. SpecPrompt のターミナルで以下を実行:
   ```bash
   which claude
   claude --version
   ```

**期待結果:**

- `which claude` が `~/.config/spec-prompt/bin/claude` を返す
- `claude --version` が本物の Claude Code のバージョンを返す（ラッパーが素通しで動作）

**確認結果:**

- [ ] OK / NG

---

### ケース 3: hooks が注入されて通知が表示される

**手順:**

1. SpecPrompt のターミナルで `claude` を起動する
2. ファイル編集など承認が必要な操作を依頼する
3. **SpecPrompt を背面にする**（他のウィンドウをクリック）
4. Claude Code が承認待ちになったとき、macOS 通知を確認する

**期待結果:**

- macOS デスクトップ通知が表示される
- タイトル: `SpecPrompt / Claude Code`

**確認結果:**

- [ ] OK / NG

---

### ケース 4: タスク完了で通知が表示される

**手順:**

1. SpecPrompt のターミナルで `claude` にタスクを依頼する
2. SpecPrompt を背面にする
3. Claude Code がタスクを完了するのを待つ

**期待結果:**

- 完了通知が macOS デスクトップに表示される

**確認結果:**

- [ ] OK / NG

---

### ケース 5: SpecPrompt 外のターミナルでは hooks が注入されない

**手順:**

1. macOS の標準ターミナル（Terminal.app または iTerm2）を開く
2. `echo $SPEC_PROMPT_NOTIFICATION` を実行する
3. `which claude` を実行する

**期待結果:**

- `SPEC_PROMPT_NOTIFICATION` が空（未設定）
- `which claude` が SpecPrompt のラッパーではなく、本物の claude パスを返す

**確認結果:**

- [ ] OK / NG

---

### ケース 6: SpecPrompt 未起動時に hooks スクリプトがエラーにならない

**手順:**

1. SpecPrompt を終了する
2. 標準ターミナルで以下を実行:
   ```bash
   echo '{"message":"test"}' | SPEC_PROMPT_HOOK_EVENT=notification ~/.config/spec-prompt/hooks/claude-notify.sh
   echo $?
   ```

**期待結果:**

- 終了コード 0（エラーなし）
- 通知は表示されない（接続先がないため）

**確認結果:**

- [ ] OK / NG

---

## 自動テスト

### Rust テスト

```bash
cd src-tauri && cargo test
```

### 型チェック

```bash
npm run build
cd src-tauri && cargo check
```

## エッジケース

| ケース | 期待動作 | 確認結果 |
|---|---|---|
| claude がインストールされていない | ラッパーが `Error: claude not found in PATH` を表示 | |
| cmux も同時にインストールされている | PATH の順序に依存。SpecPrompt のラッパーが先に見つかる | |
| `--resume` フラグ付きで claude を起動 | ラッパーが `--settings` を付与しつつ素通し | |

## 回帰テスト

- [ ] ファイルツリーが正常に表示される
- [ ] ターミナルが正常に起動・動作する
- [ ] コンテンツビューアでファイルが正常に表示される
- [ ] Phase 1 の curl テストが引き続き動作する
