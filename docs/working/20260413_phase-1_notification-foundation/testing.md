# テスト手順書 - Phase 1: 通知基盤

## 概要

HTTP サーバーと macOS 通知の基盤が正しく動作することを確認する。

## 前提条件

- `npx tauri dev` でアプリが起動していること
- macOS の「システム設定 → 通知」で SpecPrompt の通知が許可されていること

## 手動テスト

### ケース 1: ヘルスチェック

**手順:**

1. `npx tauri dev` でアプリを起動する
2. **別のターミナル**（Terminal.app や iTerm2）で `curl http://127.0.0.1:19823/health` を実行する

**期待結果:**

- `OK` が返る

**確認結果:**

- [ ] OK / NG

---

### ケース 2: Notification イベントで通知が表示される

**手順:**

1. アプリが起動している状態で、**SpecPrompt 以外のウィンドウにフォーカス**する
2. **別のターミナル**（Terminal.app や iTerm2）で以下を実行:
   ```bash
   curl -s -X POST -H "Content-Type: application/json" \
     -d '{"message":"Claude Code needs your permission to edit file.txt"}' \
     http://127.0.0.1:19823/claude-hook/notification
   ```

**期待結果:**

- macOS デスクトップ通知が表示される
- タイトル: `SpecPrompt / Claude Code`
- サブタイトル: 「承認待ち」（permission を含むため）
- 本文: `Claude Code needs your permission to edit file.txt`

**確認結果:**

- [ ] OK / NG

---

### ケース 3: Stop イベントで完了通知が表示される

**手順:**

1. SpecPrompt 以外のウィンドウにフォーカスする
2. **別のターミナル**で以下を実行:
   ```bash
   curl -s -X POST -H "Content-Type: application/json" \
     -d '{"last_assistant_message":"ファイルを3つ作成し、テストが全件パスしました。"}' \
     http://127.0.0.1:19823/claude-hook/stop
   ```

**期待結果:**

- macOS 通知が表示される
- サブタイトル: 「完了」

**確認結果:**

- [ ] OK / NG

---

### ケース 4: フォーカス中は通知が抑制される

**手順:**

1. **SpecPrompt ウィンドウにフォーカス**した状態で
2. **別のターミナル**で以下を実行（SpecPrompt のフォーカスを外さないよう注意）:
   ```bash
   curl -s -X POST -H "Content-Type: application/json" \
     -d '{"message":"test notification"}' \
     http://127.0.0.1:19823/claude-hook/notification
   ```

**期待結果:**

- macOS デスクトップ通知が**表示されない**

**確認結果:**

- [ ] OK / NG

---

### ケース 5: 不正な JSON でもサーバーがクラッシュしない

**手順:**

1. **別のターミナル**で以下を実行:
   ```bash
   curl -s -X POST -H "Content-Type: application/json" \
     -d 'invalid json' \
     http://127.0.0.1:19823/claude-hook/notification
   ```
2. 続けてヘルスチェックを実行:
   ```bash
   curl http://127.0.0.1:19823/health
   ```

**期待結果:**

- エラーレスポンス（400 等）が返るが、サーバーはクラッシュしない
- ヘルスチェックが `OK` を返す

**確認結果:**

- [ ] OK / NG

---

## 自動テスト

### Rust テスト

```bash
cd src-tauri && cargo test
```

対象:
- `classify_notification()` の分類ロジック
- `extract_message()` のメッセージ抽出優先順位
- `ClaudeHookPayload` の JSON デシリアライズ

### Rust の型チェック

```bash
cd src-tauri && cargo check
```

## エッジケース

| ケース | 期待動作 | 確認結果 |
|---|---|---|
| JSON ボディが空 `{}` | フォールバックメッセージで通知 | |
| ポート 19823 が使用中 | エラーログを出力し、通知機能は無効化（アプリ自体はクラッシュしない） | |
| アプリ起動前に curl | 接続拒否（curl がエラー） | |

## 回帰テスト

既存機能への影響がないことを確認します。

- [ ] ファイルツリーが正常に表示される
- [ ] ターミナルが正常に起動・動作する
- [ ] コンテンツビューアでファイルが正常に表示される
- [ ] マークダウンプレビューのコードブロックが正常にハイライトされる
