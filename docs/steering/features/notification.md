# Claude Code 通知機能仕様書

**バージョン**: 1.0
**作成日**: 2026年4月14日
**最終更新**: 2026年4月14日

---

## 1. 概要

Claude Code などの AI CLI ツールから、SpecPrompt アプリ外でも処理状況をユーザーに通知する機能。ウィンドウが非フォーカス状態でも OS のネイティブ通知で「許可待ち」「完了」「エラー」などを知らせる。

**関連コミット**: v0.1.10（Phase 1〜3）、v0.1.11（タブ識別通知）

---

## 2. 機能要件

### 2.1 通知トリガー

| 要件ID | 要件 | 詳細 |
|--------|------|------|
| N-01 | OSC 9 検出 | PTY 出力中の `ESC ] 9 ; <message> BEL` を検知して通知を発火 |
| N-02 | HTTP フックサーバ | `127.0.0.1:19823` に Claude Code の hook からの POST を受けて通知を発火 |
| N-03 | 通知種別分類 | message 内容から Permission / Completed / Error / Waiting / Attention を自動判定 |
| N-04 | フォーカス判定 | アプリがフォーカス中かつ発火元タブがアクティブなときは通知を抑止 |

### 2.2 通知内容

| 要件ID | 要件 | 詳細 |
|--------|------|------|
| N-05 | タイトル差し込み | `Claude Code — {タブの表示タイトル}` 形式で発火元タブを識別 |
| N-06 | メッセージ整形 | hook payload の `message`/`body`/`text`/`description` などから優先順で本文を抽出 |
| N-07 | OS ネイティブ通知 | `tauri-plugin-notification` で通知。debug ビルドでは `osascript` にフォールバック |

### 2.3 設定

| 要件ID | 要件 | 詳細 |
|--------|------|------|
| N-08 | 通知 ON/OFF | 設定画面で通知の有効/無効を切り替え（デフォルト: 有効） |
| N-09 | 設定永続化 | `~/.config/spec-prompt/config.json` の `appearance.notificationEnabled` に保存 |

### 2.4 未読マーク連携

| 要件ID | 要件 | 詳細 |
|--------|------|------|
| N-10 | 未読フラグ付与 | 通知発火時、発火元タブに `hasUnreadNotification = true` を立てる |
| N-11 | 未読表示 | 琥珀色（#F59E0B）のドット＋左ボーダー＋薄い背景でタブを強調 |
| N-12 | 未読クリア | タブをアクティブ化またはウィンドウにフォーカスが戻ると自動解除 |

---

## 3. 技術仕様

### 3.1 バックエンド

**モジュール**: `src-tauri/src/commands/notification.rs`

**主な構造体**:

```rust
pub struct DisplayTitleCache {
    inner: Mutex<HashMap<String, String>>,  // ptyId -> displayTitle
}

pub enum NotificationType {
    Permission, Completed, Error, Waiting, Attention,
}

pub struct ClaudeHookPayload {
    message: Option<String>,
    body: Option<String>,
    text: Option<String>,
    description: Option<String>,
    error: Option<String>,
    last_assistant_message: Option<String>,
    notification: Option<String>,
    tool_name: Option<String>,
}
```

**HTTP フックサーバ**:

- `tiny_http` クレートで `127.0.0.1:19823` に LISTEN
- エンドポイント:
  - `GET /health` — ヘルスチェック
  - `POST /claude-hook/{event}` — Claude Code の hook イベントを受信
- 起動: `tauri::Builder::setup()` 内で `start_hook_server(app_handle)` を呼び出し、別スレッドで常駐

**OSC 9 検出**:

- `src-tauri/src/terminal/event.rs` の `TermEventHandler` が alacritty_terminal の OSC 9 イベントを受信
- `src-tauri/src/commands/pty.rs` の PTY 読み取りループでも補助検出を行い `send_native_notification()` を呼ぶ

### 3.2 Tauri コマンド

| コマンド名 | 引数 | 戻り値 | 説明 |
|-----------|------|--------|------|
| `send_notification` | `title: String, body: String` | `Result<(), String>` | フロントから明示的に通知を発火 |
| `set_pty_display_title` | `ptyId: String, title: String` | `()` | フロントで算出した表示タイトルをキャッシュに登録 |

### 3.3 Tauri イベント

| イベント名 | ペイロード | タイミング |
|-----------|----------|----------|
| `claude-notification-fired` | `{ pty_id: string }` | 通知発火直後。フロントで未読マークを立てるために使用 |

### 3.4 フロントエンド

**関連ファイル**:

- `src/components/Layout/AppLayout.tsx` — `claude-notification-fired` を listen、未読管理、`set_pty_display_title` 呼び出し
- `src/components/Settings/` — 通知 ON/OFF トグル UI
- `src/stores/settingsStore.ts` — `notificationEnabled` の状態管理
- `src/stores/terminalStore.ts` — `hasUnreadNotification` / `markUnread` / `clearUnread`

**未読同期フロー**:

```
[Rust] OSC 9 / HTTP hook を検出
   │
   ▼
[Rust] DisplayTitleCache から発火元タブ名を取得
   │
   ▼
[Rust → OS] ネイティブ通知送信（tauri-plugin-notification）
   │
   ▼
[Rust → Frontend] emit("claude-notification-fired", { pty_id })
   │
   ▼
[Frontend] terminalStore.markUnread(ptyId) でタブに琥珀ハイライト付与
   │
   ▼
[Frontend] ユーザーがタブをアクティブ化またはウィンドウ focus 復帰
   │
   ▼
[Frontend] terminalStore.clearUnread(tabId)
```

### 3.5 設定ファイル

`~/.config/spec-prompt/config.json` の `appearance` セクション:

```json
{
  "appearance": {
    "theme": "dark",
    "content_font_family": "Geist",
    "content_font_size": 16,
    "terminal_font_family": "Geist Mono",
    "terminal_font_size": 14,
    "notification_enabled": true
  }
}
```

---

## 4. 権限設定

`src-tauri/capabilities/default.json` に `notification:default` を追加済み。

---

## 5. 注意事項

- HTTP フックサーバはループバック（`127.0.0.1`）のみで LISTEN し、外部ネットワークへは公開しない
- `DisplayTitleCache` は PTY close 時に該当エントリを削除する
- フロント側で表示タイトルが変わるたびに `set_pty_display_title` を呼び、Rust 側のキャッシュと同期する
- 通知発火の判定はアプリの `window.isFocused()` と「発火元タブがアクティブか」の両方で行う

---

## 変更履歴

| 日付 | バージョン | 変更内容 | 作成者 |
|------|----------|---------|--------|
| 2026-04-14 | 1.0 | 初版作成（v0.1.10〜v0.1.11 実装内容を反映） | - |
