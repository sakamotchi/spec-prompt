# 設計書 - Phase 1: 通知基盤（HTTP サーバー + 通知プラグイン）

## アーキテクチャ

### 対象コンポーネント

```
外部プロセス（hooks スクリプト / curl）
    ↓ HTTP POST (JSON)
Rust HTTP サーバー (127.0.0.1:19823)
    ↓
notification.rs（分類・メッセージ抽出）
    ↓
tauri-plugin-notification
    ↓
macOS デスクトップ通知
```

### 影響範囲

- **フロントエンド**: 変更なし（Phase 1 では UI 変更しない）
- **バックエンド（Rust）**: HTTP サーバー追加、通知コマンド追加、プラグイン追加

## 実装方針

### 概要

Tauri のセットアップフックで軽量 HTTP サーバーをバックグラウンドスレッドで起動する。`/claude-hook/{event}` エンドポイントで JSON を受け取り、通知分類 → メッセージ抽出 → フォーカス判定 → macOS 通知の順で処理する。

### HTTP サーバーライブラリの選定

| ライブラリ | バイナリ増加 | 非同期ランタイム | 備考 |
|---|---|---|---|
| `tiny_http` | 小 | 不要（スレッドベース） | 最小構成、依存少 |
| `actix-web` | 大 | Tokio | フル機能、オーバースペック |
| `axum` | 中 | Tokio | Tauri 2 は内部で Tokio を使用 |

**推奨: `tiny_http`** — 受けるのは1エンドポイントだけなので最小構成で十分。非同期ランタイムの競合リスクもない。

### 詳細

1. `tauri-plugin-notification` を Cargo.toml に追加し、lib.rs でプラグイン登録
2. `notification.rs` に通知分類・メッセージ抽出の純関数を実装
3. `tiny_http` で HTTP サーバーを起動し、`/claude-hook/{event}` をルーティング
4. Tauri の `AppHandle` を HTTP サーバースレッドに渡し、通知発火・フォーカス判定に使用

## データ構造

### 型定義（Rust）

```rust
use serde::{Deserialize, Serialize};

/// Claude Code hooks から受け取る JSON（フィールドはすべて Optional）
#[derive(Debug, Clone, Deserialize, Default)]
pub struct ClaudeHookPayload {
    pub message: Option<String>,
    pub body: Option<String>,
    pub text: Option<String>,
    pub description: Option<String>,
    pub error: Option<String>,
    #[serde(alias = "last_assistant_message")]
    #[serde(alias = "lastAssistantMessage")]
    pub last_assistant_message: Option<String>,
    pub notification: Option<serde_json::Value>,
    pub tool_name: Option<String>,
}

/// 通知分類結果
#[derive(Debug, Clone, Serialize)]
pub enum NotificationType {
    Permission,   // 承認待ち
    Completed,    // 完了
    Error,        // エラー
    Waiting,      // 入力待ち
    Attention,    // 注意喚起（デフォルト）
}
```

## API設計

### HTTP エンドポイント

| メソッド | パス | ボディ | 説明 |
|---|---|---|---|
| `GET` | `/health` | なし | ヘルスチェック（`OK` を返す） |
| `POST` | `/claude-hook/{event}` | `ClaudeHookPayload` (JSON) | 通知イベント受信 |

### Tauri コマンド

| コマンド名 | 引数 | 戻り値 | 説明 |
|---|---|---|---|
| `send_notification` | `title: String, body: String` | `Result<(), String>` | テスト・デバッグ用の直接通知 |

## 通知分類ロジック

cmux の実装（`cmux.swift:13303-13326`）を参考にした分類ルール:

```rust
pub fn classify_notification(event: &str, payload: &ClaudeHookPayload) -> NotificationType {
    // イベント名による判定
    if event == "stop" {
        return NotificationType::Completed;
    }

    // メッセージ内容による判定
    let searchable = extract_searchable_text(payload).to_lowercase();

    if searchable.contains("permission") || searchable.contains("approve") {
        NotificationType::Permission
    } else if searchable.contains("error") || searchable.contains("failed") {
        NotificationType::Error
    } else if searchable.contains("complet") || searchable.contains("finish") {
        NotificationType::Completed
    } else if searchable.contains("idle") || searchable.contains("wait") || searchable.contains("input") {
        NotificationType::Waiting
    } else {
        NotificationType::Attention
    }
}
```

### メッセージ抽出の優先順位

```rust
pub fn extract_message(payload: &ClaudeHookPayload) -> String {
    // 1. message フィールド
    // 2. notification.message（ネスト）
    // 3. last_assistant_message（末尾 200 文字）
    // 4. body / text / description
    // 5. フォールバック: "Claude Code needs your attention"
}
```

## フォーカス判定

```rust
fn is_app_focused(app: &AppHandle) -> bool {
    app.get_webview_window("main")
        .and_then(|w| w.is_focused().ok())
        .unwrap_or(false)
}
```

## 設計上の決定事項

| 決定事項 | 理由 | 代替案 |
|---|---|---|
| HTTP サーバーに `tiny_http` を使用 | 最小依存、1エンドポイントに十分 | axum（Tokio 競合リスク）、actix-web（オーバースペック） |
| ポート固定 19823 | ユーザー設定不要にするため | ランダムポート + ファイルで通知（発見が複雑に） |
| `127.0.0.1` のみバインド | セキュリティ（外部アクセス遮断） | `0.0.0.0`（不要なリスク） |

## 未解決事項

- [ ] ポート 19823 が他アプリと衝突した場合のフォールバック戦略
- [ ] HTTP サーバーの graceful shutdown（アプリ終了時）
