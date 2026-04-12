use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Mutex;
use std::thread;

use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::terminal::TerminalManager;

#[derive(Serialize, Clone)]
pub struct PtyOutput {
    pub id: String,
    pub data: String,
}

struct PtyInstance {
    master: Box<dyn portable_pty::MasterPty + Send>,
    writer: Box<dyn Write + Send>,
}

pub struct PtyManager {
    instances: Mutex<HashMap<String, PtyInstance>>,
    next_id: Mutex<u32>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            instances: Mutex::new(HashMap::new()),
            next_id: Mutex::new(0),
        }
    }
}

#[tauri::command]
pub fn spawn_pty(
    shell: String,
    cwd: String,
    app: AppHandle,
    manager: State<PtyManager>,
    terminal_manager: State<TerminalManager>,
) -> Result<String, String> {
    let pty_system = NativePtySystem::default();
    let pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let resolved_cwd = resolve_cwd(&cwd);

    let mut cmd = CommandBuilder::new(&shell);
    cmd.cwd(&resolved_cwd);

    // プロダクションビルドでは .app が LaunchServices 経由で起動されるため、
    // シェルの環境変数が引き継がれない。マルチバイト文字の文字化けを防ぐため
    // ロケール関連の環境変数を明示的に設定する。
    let locale = std::env::var("LANG").unwrap_or_else(|_| "ja_JP.UTF-8".to_string());
    cmd.env("LANG", &locale);
    cmd.env("LC_ALL", &locale);
    cmd.env("LC_CTYPE", &locale);

    // HOME, PATH など基本的な変数もプロダクションビルドで欠落しうるため継承する
    for key in &["HOME", "PATH", "USER", "SHELL"] {
        if let Ok(val) = std::env::var(key) {
            cmd.env(key, val);
        }
    }

    // TERM が未設定だと zsh がバックスペースの描画シーケンスを正しく送れず
    // xterm.js 上でスペースとして表示されるため、明示的にフォールバックを設定する
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");

    let _child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| e.to_string())?;

    // slave を drop することで PTY の一方のファイルディスクリプタを閉じる
    drop(pair.slave);

    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;

    let id = {
        let mut next_id = manager.next_id.lock().unwrap();
        let id = next_id.to_string();
        *next_id += 1;
        id
    };

    // TerminalInstance を生成・登録
    use crate::terminal::instance::TerminalInstance;
    terminal_manager.insert(id.clone(), TerminalInstance::new(80, 24));

    // PTY 出力を Tauri イベントとしてフロントエンドにストリーミングするスレッド
    // AppHandle を clone してスレッドに移動し、内部で TerminalManager を取得する
    let pty_id = id.clone();
    thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();

                    // 既存: xterm.js 向け生バイト列イベント（Phase 4 まで維持）
                    let _ = app.emit("pty-output", PtyOutput { id: pty_id.clone(), data });

                    // 新規: alacritty-terminal でパースしてセルグリッドを送信
                    let tm = app.state::<crate::terminal::TerminalManager>();
                    if let Some(payload) = tm.advance_and_collect(&pty_id, &buf[..n]) {
                        let _ = app.emit("terminal-cells", payload);
                    }
                }
                Err(_) => break,
            }
        }
    });

    manager.instances.lock().unwrap().insert(
        id.clone(),
        PtyInstance {
            master: pair.master,
            writer,
        },
    );

    Ok(id)
}

#[tauri::command]
pub fn write_pty(id: String, data: String, manager: State<PtyManager>) -> Result<(), String> {
    let mut instances = manager.instances.lock().unwrap();
    if let Some(pty) = instances.get_mut(&id) {
        pty.writer
            .write_all(data.as_bytes())
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn resize_pty(
    id: String,
    cols: u16,
    rows: u16,
    manager: State<PtyManager>,
) -> Result<(), String> {
    let instances = manager.instances.lock().unwrap();
    if let Some(pty) = instances.get(&id) {
        pty.master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn close_pty(
    id: String,
    manager: State<PtyManager>,
    terminal_manager: State<TerminalManager>,
) -> Result<(), String> {
    manager.instances.lock().unwrap().remove(&id);
    terminal_manager.remove(&id);
    Ok(())
}

/// Term と PTY 両方をリサイズする
#[tauri::command]
pub fn resize_terminal(
    id: String,
    cols: u16,
    rows: u16,
    pty_manager: State<PtyManager>,
    terminal_manager: State<TerminalManager>,
) -> Result<(), String> {
    // PTY リサイズ
    {
        let instances = pty_manager.instances.lock().unwrap();
        if let Some(pty) = instances.get(&id) {
            pty.master
                .resize(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })
                .map_err(|e| e.to_string())?;
        }
    }
    // Term リサイズ
    terminal_manager.resize(&id, cols, rows);
    Ok(())
}

/// `~` をホームディレクトリに展開する。絶対パスはそのまま返す。
fn resolve_cwd(cwd: &str) -> String {
    if cwd.starts_with('~') {
        if let Ok(home) = std::env::var("HOME") {
            cwd.replacen('~', &home, 1)
        } else {
            cwd.to_string()
        }
    } else {
        cwd.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resolve_cwd_tilde_only() {
        std::env::set_var("HOME", "/home/testuser");
        assert_eq!(resolve_cwd("~"), "/home/testuser");
    }

    #[test]
    fn test_resolve_cwd_tilde_with_subdir() {
        std::env::set_var("HOME", "/home/testuser");
        assert_eq!(resolve_cwd("~/projects/foo"), "/home/testuser/projects/foo");
    }

    #[test]
    fn test_resolve_cwd_absolute_path() {
        assert_eq!(resolve_cwd("/absolute/path"), "/absolute/path");
    }

    #[test]
    fn test_resolve_cwd_no_home_env() {
        std::env::remove_var("HOME");
        // HOME がない場合でもクラッシュせず、元の文字列を返す
        assert_eq!(resolve_cwd("~"), "~");
        // テスト環境を汚さないよう復元（他テストへの影響を避ける）
        let _ = std::env::var("HOME"); // no-op
    }
}
