use alacritty_terminal::event::{Event, EventListener};

/// Tauri IPC への橋渡しは terminal/mod.rs で行うため、
/// ここでは alacritty-terminal の内部イベントを捨てるだけの実装にする
pub struct TermEventHandler;

impl EventListener for TermEventHandler {
    fn send_event(&self, _event: Event) {}
}
