use std::collections::HashMap;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tauri_plugin_notification::NotificationExt;

/// 通知クリック後にフォアグラウンド化するウィンドウ・アクティブ化するタブを示す。
/// `tauri-plugin-notification` v2.3 系の desktop 実装はクリックハンドラを公開していないため、
/// 「次にフォーカスが返ってきたタイミングでアクティブ化する目標」をメモリに保持し、
/// `WindowEvent::Focused(true)` をトリガーに消費するモデルを採用する。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClickTarget {
    pub window_label: String,
    /// PTY ID。HTTP `/claude-hook/{event}` 経由など解決できない経路では None
    pub pty_id: Option<String>,
}

/// 直近に発火された通知のクリック対象。フォーカス復帰のたびに `take` して消費する。
#[derive(Default)]
pub struct PendingNotificationTarget {
    inner: Mutex<Option<ClickTarget>>,
}

impl PendingNotificationTarget {
    pub fn set(&self, target: ClickTarget) {
        if let Ok(mut guard) = self.inner.lock() {
            *guard = Some(target);
        }
    }

    pub fn take(&self) -> Option<ClickTarget> {
        self.inner.lock().ok().and_then(|mut g| g.take())
    }
}

/// pty_id → 表示タイトルのキャッシュ。OSC 9 通知発火時にタイトル差し込みに利用する。
/// フロントから `set_pty_display_title` コマンドで書き込み、`close_pty` で削除される。
pub struct DisplayTitleCache {
    map: Mutex<HashMap<String, String>>,
}

impl DisplayTitleCache {
    pub fn new() -> Self {
        Self {
            map: Mutex::new(HashMap::new()),
        }
    }

    pub fn set(&self, pty_id: &str, title: &str) {
        if let Ok(mut guard) = self.map.lock() {
            guard.insert(pty_id.to_string(), title.to_string());
        }
    }

    pub fn get(&self, pty_id: &str) -> Option<String> {
        self.map
            .lock()
            .ok()
            .and_then(|g| g.get(pty_id).cloned())
    }

    pub fn remove(&self, pty_id: &str) {
        if let Ok(mut guard) = self.map.lock() {
            guard.remove(pty_id);
        }
    }
}

impl Default for DisplayTitleCache {
    fn default() -> Self {
        Self::new()
    }
}

/// フロントから呼び出してタブの表示タイトルを Rust 側キャッシュへ同期する。
#[tauri::command]
pub fn set_pty_display_title(
    pty_id: String,
    title: String,
    cache: tauri::State<DisplayTitleCache>,
) -> Result<(), String> {
    cache.set(&pty_id, &title);
    Ok(())
}

/// Claude Code hooks から受け取る JSON（フィールドはすべて Optional）
#[derive(Debug, Clone, Deserialize, Default)]
#[serde(default)]
pub struct ClaudeHookPayload {
    pub message: Option<String>,
    pub body: Option<String>,
    pub text: Option<String>,
    pub description: Option<String>,
    pub error: Option<String>,
    #[serde(alias = "lastAssistantMessage")]
    pub last_assistant_message: Option<String>,
    pub notification: Option<serde_json::Value>,
    pub tool_name: Option<String>,
}

/// 通知分類
#[derive(Debug, Clone, PartialEq)]
pub enum NotificationType {
    Permission,
    Completed,
    Error,
    Waiting,
    Attention,
}

impl NotificationType {
    pub fn label(&self) -> &'static str {
        match self {
            Self::Permission => "承認待ち",
            Self::Completed => "完了",
            Self::Error => "エラー",
            Self::Waiting => "入力待ち",
            Self::Attention => "注意",
        }
    }
}

/// イベント名と JSON ペイロードから通知タイプを分類する
pub fn classify_notification(event: &str, payload: &ClaudeHookPayload) -> NotificationType {
    if event == "stop" {
        return NotificationType::Completed;
    }

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

/// 通知本文を抽出する
pub fn extract_message(payload: &ClaudeHookPayload) -> String {
    // 1. message
    if let Some(m) = &payload.message {
        if !m.is_empty() {
            return m.clone();
        }
    }
    // 2. notification.message (nested)
    if let Some(n) = &payload.notification {
        if let Some(m) = n.get("message").and_then(|v| v.as_str()) {
            if !m.is_empty() {
                return m.to_string();
            }
        }
    }
    // 3. last_assistant_message (末尾 200 文字)
    if let Some(m) = &payload.last_assistant_message {
        if !m.is_empty() {
            let chars: Vec<char> = m.chars().collect();
            if chars.len() > 200 {
                return chars[chars.len() - 200..].iter().collect();
            }
            return m.clone();
        }
    }
    // 4. body / text / description / error
    for field in [&payload.body, &payload.text, &payload.description, &payload.error] {
        if let Some(m) = field {
            if !m.is_empty() {
                return m.clone();
            }
        }
    }
    // 5. fallback
    "Claude Code needs your attention".to_string()
}

/// 分類用のテキストを結合する
fn extract_searchable_text(payload: &ClaudeHookPayload) -> String {
    let mut parts = Vec::new();
    for field in [
        &payload.message,
        &payload.body,
        &payload.text,
        &payload.description,
        &payload.error,
    ] {
        if let Some(s) = field {
            parts.push(s.as_str());
        }
    }
    if let Some(n) = &payload.notification {
        if let Some(m) = n.get("message").and_then(|v| v.as_str()) {
            parts.push(m);
        }
    }
    parts.join(" ")
}

/// 任意のウィンドウラベルがフォーカス中かを返す。複数ウィンドウ運用に対応する。
pub fn is_window_focused(app: &AppHandle, label: &str) -> bool {
    app.get_webview_window(label)
        .and_then(|w| w.is_focused().ok())
        .unwrap_or(false)
}

/// macOS ネイティブ通知を送信する。
/// プロダクションビルドでは tauri-plugin-notification（SDDesk アイコン表示）、
/// デバッグビルドでは osascript にフォールバックする。
///
/// `target` を指定すると、次にいずれかのウィンドウへフォーカスが返ってきたタイミングで
/// `WindowEvent::Focused(true)` ハンドラが消費し、対象ウィンドウへ
/// `notification-activate` を emit_to する（複数ウィンドウ・タブ復帰用途）。
pub fn send_native_notification(
    app: &AppHandle,
    title: &str,
    body: &str,
    target: Option<ClickTarget>,
) {
    // クリック復帰先を保留キューに登録（None なら従来挙動と同じ）
    if let Some(target) = target {
        if let Some(state) = app.try_state::<PendingNotificationTarget>() {
            state.set(target);
        }
    }

    // まず tauri-plugin-notification を試行
    let plugin_result = app
        .notification()
        .builder()
        .title(title)
        .body(body)
        .show();

    if plugin_result.is_ok() && !cfg!(debug_assertions) {
        // プロダクションビルドではプラグインが正常に機能する
        return;
    }

    // デバッグビルド or プラグイン失敗時は osascript にフォールバック
    let escaped_body = body.replace('\\', "\\\\").replace('"', "\\\"");
    let escaped_title = title.replace('\\', "\\\\").replace('"', "\\\"");
    let script = format!(
        "display notification \"{}\" with title \"{}\"",
        escaped_body, escaped_title
    );
    let _ = std::process::Command::new("osascript")
        .arg("-e")
        .arg(&script)
        .output();
}

// --- OSC 9 検出 ---

/// OSC 9 エスケープシーケンス (`ESC ] 9 ; <message> BEL`) を検出するステートマシン。
/// PTY 出力はチャンク分割されるため、バッファ境界をまたぐ OSC 9 にも対応する。
pub struct Osc9Detector {
    state: Osc9State,
    buffer: Vec<u8>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
enum Osc9State {
    Normal,
    Esc,        // ESC を検出
    OscBracket, // ESC ] を検出
    Osc9,       // ESC ] 9 を検出
    Collecting,  // ESC ] 9 ; を検出、メッセージ蓄積中
    CollectEsc, // 蓄積中に ESC を検出（ST 終端の可能性）
}

const OSC9_MAX_LEN: usize = 4096;

impl Osc9Detector {
    pub fn new() -> Self {
        Self {
            state: Osc9State::Normal,
            buffer: Vec::new(),
        }
    }

    /// バイト列をスキャンし、完了した OSC 9 メッセージを返す。
    pub fn feed(&mut self, data: &[u8]) -> Vec<String> {
        let mut messages = Vec::new();
        for &b in data {
            match self.state {
                Osc9State::Normal => {
                    if b == 0x1b {
                        self.state = Osc9State::Esc;
                    }
                }
                Osc9State::Esc => {
                    if b == b']' {
                        self.state = Osc9State::OscBracket;
                    } else {
                        self.state = Osc9State::Normal;
                    }
                }
                Osc9State::OscBracket => {
                    if b == b'9' {
                        self.state = Osc9State::Osc9;
                    } else {
                        self.state = Osc9State::Normal;
                    }
                }
                Osc9State::Osc9 => {
                    if b == b';' {
                        self.state = Osc9State::Collecting;
                        self.buffer.clear();
                    } else {
                        self.state = Osc9State::Normal;
                    }
                }
                Osc9State::Collecting => {
                    if b == 0x07 {
                        // BEL 終端
                        if let Ok(msg) = String::from_utf8(self.buffer.clone()) {
                            messages.push(msg);
                        }
                        self.buffer.clear();
                        self.state = Osc9State::Normal;
                    } else if b == 0x1b {
                        // ST 終端の開始の可能性
                        self.state = Osc9State::CollectEsc;
                    } else if self.buffer.len() < OSC9_MAX_LEN {
                        self.buffer.push(b);
                    } else {
                        // バッファ上限超過 → リセット
                        self.buffer.clear();
                        self.state = Osc9State::Normal;
                    }
                }
                Osc9State::CollectEsc => {
                    if b == b'\\' {
                        // ESC \ (ST) 終端
                        if let Ok(msg) = String::from_utf8(self.buffer.clone()) {
                            messages.push(msg);
                        }
                        self.buffer.clear();
                        self.state = Osc9State::Normal;
                    } else {
                        // ESC の後に \ が来なかった → ESC をバッファに追加して継続
                        if self.buffer.len() < OSC9_MAX_LEN {
                            self.buffer.push(0x1b);
                            self.buffer.push(b);
                        }
                        self.state = Osc9State::Collecting;
                    }
                }
            }
        }
        messages
    }
}

/// HTTP サーバーを起動する（バックグラウンドスレッド）
pub fn start_hook_server(app: AppHandle) {
    std::thread::spawn(move || {
        let server = match tiny_http::Server::http("127.0.0.1:19823") {
            Ok(s) => s,
            Err(e) => {
                log::error!("Failed to start notification HTTP server: {}", e);
                return;
            }
        };
        log::info!("Notification HTTP server listening on 127.0.0.1:19823");

        for mut request in server.incoming_requests() {
            let url = request.url().to_string();
            let method = request.method().to_string();

            // GET /health
            if method == "GET" && url == "/health" {
                let response = tiny_http::Response::from_string("OK");
                let _ = request.respond(response);
                continue;
            }

            // POST /claude-hook/{event}
            if method == "POST" && url.starts_with("/claude-hook/") {
                let event = url.trim_start_matches("/claude-hook/").to_string();
                let mut body = String::new();
                if let Err(_) = request.as_reader().read_to_string(&mut body) {
                    let response = tiny_http::Response::from_string("Bad request")
                        .with_status_code(400);
                    let _ = request.respond(response);
                    continue;
                }

                let payload: ClaudeHookPayload =
                    serde_json::from_str(&body).unwrap_or_default();

                let notification_type = classify_notification(&event, &payload);
                let message = extract_message(&payload);

                // HTTP hook 経由は発信元ウィンドウ・PTY を特定できないため、
                // ベストエフォートで「いずれかのウィンドウがフォーカス中なら抑制」する既存挙動を維持する。
                let any_focused = app
                    .webview_windows()
                    .keys()
                    .any(|label| is_window_focused(&app, label));
                if !any_focused {
                    let title = "SDDesk / Claude Code".to_string();
                    let body = format!("[{}] {}", notification_type.label(), message);
                    // HTTP 経路では pty_id を解決できないため、復帰先はメインウィンドウへフォールバック。
                    // 受け側 (`notification-activate`) は pty_id == None ならタブ切替をスキップする。
                    let target = ClickTarget {
                        window_label: "main".to_string(),
                        pty_id: None,
                    };
                    send_native_notification(&app, &title, &body, Some(target));
                }

                let response = tiny_http::Response::from_string("OK");
                let _ = request.respond(response);
                continue;
            }

            // 404
            let response = tiny_http::Response::from_string("Not found")
                .with_status_code(404);
            let _ = request.respond(response);
        }
    });
}

#[tauri::command]
pub fn send_notification(app: AppHandle, title: String, body: String) -> Result<(), String> {
    // フロントから明示発火されるケースは戻り先を持たないため target = None
    send_native_notification(&app, &title, &body, None);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_classify_stop_event() {
        let payload = ClaudeHookPayload::default();
        assert_eq!(classify_notification("stop", &payload), NotificationType::Completed);
    }

    #[test]
    fn test_classify_permission() {
        let payload = ClaudeHookPayload {
            message: Some("Claude Code needs your permission to edit file.txt".into()),
            ..Default::default()
        };
        assert_eq!(
            classify_notification("notification", &payload),
            NotificationType::Permission
        );
    }

    #[test]
    fn test_classify_error() {
        let payload = ClaudeHookPayload {
            message: Some("Command failed with exit code 1".into()),
            ..Default::default()
        };
        assert_eq!(
            classify_notification("notification", &payload),
            NotificationType::Error
        );
    }

    #[test]
    fn test_classify_completed() {
        let payload = ClaudeHookPayload {
            message: Some("Task completed successfully".into()),
            ..Default::default()
        };
        assert_eq!(
            classify_notification("notification", &payload),
            NotificationType::Completed
        );
    }

    #[test]
    fn test_classify_waiting() {
        let payload = ClaudeHookPayload {
            message: Some("Waiting for user input".into()),
            ..Default::default()
        };
        assert_eq!(
            classify_notification("notification", &payload),
            NotificationType::Waiting
        );
    }

    #[test]
    fn test_classify_attention_fallback() {
        let payload = ClaudeHookPayload {
            message: Some("Something happened".into()),
            ..Default::default()
        };
        assert_eq!(
            classify_notification("notification", &payload),
            NotificationType::Attention
        );
    }

    #[test]
    fn test_extract_message_priority() {
        // message が最優先
        let payload = ClaudeHookPayload {
            message: Some("primary".into()),
            body: Some("secondary".into()),
            ..Default::default()
        };
        assert_eq!(extract_message(&payload), "primary");
    }

    #[test]
    fn test_extract_message_last_assistant() {
        let payload = ClaudeHookPayload {
            last_assistant_message: Some("assistant said this".into()),
            ..Default::default()
        };
        assert_eq!(extract_message(&payload), "assistant said this");
    }

    #[test]
    fn test_extract_message_last_assistant_truncation() {
        let long_msg: String = "x".repeat(300);
        let payload = ClaudeHookPayload {
            last_assistant_message: Some(long_msg),
            ..Default::default()
        };
        assert_eq!(extract_message(&payload).len(), 200);
    }

    #[test]
    fn test_extract_message_fallback() {
        let payload = ClaudeHookPayload::default();
        assert_eq!(extract_message(&payload), "Claude Code needs your attention");
    }

    #[test]
    fn test_extract_message_nested_notification() {
        let payload = ClaudeHookPayload {
            notification: Some(serde_json::json!({"message": "nested msg"})),
            ..Default::default()
        };
        assert_eq!(extract_message(&payload), "nested msg");
    }

    #[test]
    fn test_deserialize_empty_json() {
        let payload: ClaudeHookPayload = serde_json::from_str("{}").unwrap();
        assert!(payload.message.is_none());
    }

    #[test]
    fn test_deserialize_camel_case_alias() {
        let json = r#"{"lastAssistantMessage":"hello"}"#;
        let payload: ClaudeHookPayload = serde_json::from_str(json).unwrap();
        assert_eq!(payload.last_assistant_message, Some("hello".into()));
    }

    // --- Osc9Detector tests ---

    #[test]
    fn test_osc9_bel_terminator() {
        let mut d = Osc9Detector::new();
        let input = b"\x1b]9;Hello World\x07";
        let msgs = d.feed(input);
        assert_eq!(msgs, vec!["Hello World"]);
    }

    #[test]
    fn test_osc9_st_terminator() {
        let mut d = Osc9Detector::new();
        let input = b"\x1b]9;Hello ST\x1b\\";
        let msgs = d.feed(input);
        assert_eq!(msgs, vec!["Hello ST"]);
    }

    #[test]
    fn test_osc9_chunked() {
        let mut d = Osc9Detector::new();
        // チャンク分割: ESC ] 9 ; Hel | lo\x07
        let msgs1 = d.feed(b"\x1b]9;Hel");
        assert!(msgs1.is_empty());
        let msgs2 = d.feed(b"lo\x07");
        assert_eq!(msgs2, vec!["Hello"]);
    }

    #[test]
    fn test_osc9_multiple_in_one_chunk() {
        let mut d = Osc9Detector::new();
        let input = b"\x1b]9;first\x07some text\x1b]9;second\x07";
        let msgs = d.feed(input);
        assert_eq!(msgs, vec!["first", "second"]);
    }

    #[test]
    fn test_osc9_ignores_other_osc() {
        let mut d = Osc9Detector::new();
        // OSC 0 (title set) should not be detected
        let input = b"\x1b]0;window title\x07";
        let msgs = d.feed(input);
        assert!(msgs.is_empty());
    }

    #[test]
    fn test_osc9_empty_message() {
        let mut d = Osc9Detector::new();
        let input = b"\x1b]9;\x07";
        let msgs = d.feed(input);
        assert_eq!(msgs, vec![""]);
    }

    #[test]
    fn test_osc9_max_length() {
        let mut d = Osc9Detector::new();
        let mut input = Vec::new();
        input.extend_from_slice(b"\x1b]9;");
        input.extend(vec![b'x'; OSC9_MAX_LEN + 100]);
        input.push(0x07);
        let msgs = d.feed(&input);
        // 上限超過でリセットされるため空
        assert!(msgs.is_empty());
    }

    // --- DisplayTitleCache tests ---

    #[test]
    fn display_title_cache_set_and_get() {
        let cache = DisplayTitleCache::new();
        cache.set("pty-0", "Terminal 1");
        assert_eq!(cache.get("pty-0").as_deref(), Some("Terminal 1"));
    }

    #[test]
    fn display_title_cache_overwrite() {
        let cache = DisplayTitleCache::new();
        cache.set("pty-0", "Terminal 1");
        cache.set("pty-0", "renamed");
        assert_eq!(cache.get("pty-0").as_deref(), Some("renamed"));
    }

    #[test]
    fn display_title_cache_remove() {
        let cache = DisplayTitleCache::new();
        cache.set("pty-0", "Terminal 1");
        cache.remove("pty-0");
        assert_eq!(cache.get("pty-0"), None);
    }

    #[test]
    fn display_title_cache_unknown_key_returns_none() {
        let cache = DisplayTitleCache::new();
        assert_eq!(cache.get("missing"), None);
    }

    #[test]
    fn display_title_cache_multiple_keys_independent() {
        let cache = DisplayTitleCache::new();
        cache.set("pty-0", "A");
        cache.set("pty-1", "B");
        cache.remove("pty-0");
        assert_eq!(cache.get("pty-0"), None);
        assert_eq!(cache.get("pty-1").as_deref(), Some("B"));
    }

    // --- PendingNotificationTarget tests ---

    #[test]
    fn pending_target_set_and_take() {
        let pending = PendingNotificationTarget::default();
        pending.set(ClickTarget {
            window_label: "main".into(),
            pty_id: Some("pty-7".into()),
        });
        let taken = pending.take().expect("target should be set");
        assert_eq!(taken.window_label, "main");
        assert_eq!(taken.pty_id.as_deref(), Some("pty-7"));
        // take は消費するので 2 回目は None
        assert!(pending.take().is_none());
    }

    #[test]
    fn pending_target_overwrites_previous() {
        let pending = PendingNotificationTarget::default();
        pending.set(ClickTarget {
            window_label: "main".into(),
            pty_id: Some("pty-1".into()),
        });
        pending.set(ClickTarget {
            window_label: "window-99".into(),
            pty_id: Some("pty-9".into()),
        });
        let taken = pending.take().unwrap();
        // 後勝ち（短時間に複数発火された場合は最新の通知に倒す）
        assert_eq!(taken.window_label, "window-99");
        assert_eq!(taken.pty_id.as_deref(), Some("pty-9"));
    }

    #[test]
    fn pending_target_take_when_unset_returns_none() {
        let pending = PendingNotificationTarget::default();
        assert!(pending.take().is_none());
    }

    #[test]
    fn test_osc9_japanese_message() {
        let mut d = Osc9Detector::new();
        let msg = "通知テスト";
        let mut input = Vec::new();
        input.extend_from_slice(b"\x1b]9;");
        input.extend_from_slice(msg.as_bytes());
        input.push(0x07);
        let msgs = d.feed(&input);
        assert_eq!(msgs, vec!["通知テスト"]);
    }
}
