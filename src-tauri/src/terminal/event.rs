use alacritty_terminal::event::{Event, EventListener};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

/// `terminal-title-changed` イベントでフロントエンドに配信するペイロード。
/// `title` が None のときは OSC 2 空文字 または ResetTitle を意味し、フロント側ではフォールバック名に戻す。
#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
pub struct TitleChangedPayload {
    pub pty_id: String,
    pub title: Option<String>,
}

/// OSC 0/1/2 で届くウィンドウタイトルを alacritty_terminal の `Event` から取り出し、
/// Tauri イベントとしてフロントに中継する。
/// `app` が None のときは emit をスキップする（ユニットテスト用）。
pub struct TermEventHandler {
    app: Option<AppHandle>,
    pty_id: String,
}

impl TermEventHandler {
    pub fn new(app: AppHandle, pty_id: String) -> Self {
        Self {
            app: Some(app),
            pty_id,
        }
    }

    /// `AppHandle` を必要としないテスト用コンストラクタ。
    #[cfg(test)]
    pub fn noop() -> Self {
        Self {
            app: None,
            pty_id: "test".to_string(),
        }
    }
}

impl EventListener for TermEventHandler {
    fn send_event(&self, event: Event) {
        let Some(app) = self.app.as_ref() else { return };
        if let Some(payload) = build_payload(&self.pty_id, &event) {
            let _ = app.emit("terminal-title-changed", payload);
        }
    }
}

/// `Event::Title(s)` / `Event::ResetTitle` を `TitleChangedPayload` に変換する。
/// 他バリアントでは `None` を返す（= emit しない）。
/// テスト容易性のため `send_event` から分離した純粋関数。
pub fn build_payload(pty_id: &str, event: &Event) -> Option<TitleChangedPayload> {
    match event {
        Event::Title(s) => {
            let trimmed = s.trim();
            Some(TitleChangedPayload {
                pty_id: pty_id.to_string(),
                title: if trimmed.is_empty() {
                    None
                } else {
                    Some(trimmed.to_string())
                },
            })
        }
        Event::ResetTitle => Some(TitleChangedPayload {
            pty_id: pty_id.to_string(),
            title: None,
        }),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn title_event_produces_payload() {
        let p = build_payload("pty-0", &Event::Title("hello".into())).unwrap();
        assert_eq!(p.pty_id, "pty-0");
        assert_eq!(p.title.as_deref(), Some("hello"));
    }

    #[test]
    fn title_event_trims_whitespace() {
        let p = build_payload("pty-0", &Event::Title("  hi  ".into())).unwrap();
        assert_eq!(p.title.as_deref(), Some("hi"));
    }

    #[test]
    fn title_event_empty_becomes_none() {
        let p = build_payload("pty-0", &Event::Title("   ".into())).unwrap();
        assert!(p.title.is_none());
    }

    #[test]
    fn reset_title_produces_none_title() {
        let p = build_payload("pty-0", &Event::ResetTitle).unwrap();
        assert_eq!(p.pty_id, "pty-0");
        assert!(p.title.is_none());
    }

    #[test]
    fn other_events_are_ignored() {
        assert!(build_payload("pty-0", &Event::Bell).is_none());
        assert!(build_payload("pty-0", &Event::Wakeup).is_none());
        assert!(build_payload("pty-0", &Event::MouseCursorDirty).is_none());
    }
}
