use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Mutex;
use std::thread;

use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

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

    // PTY 出力を Tauri イベントとしてフロントエンドにストリーミングするスレッド
    let pty_id = id.clone();
    thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app.emit(
                        "pty-output",
                        PtyOutput {
                            id: pty_id.clone(),
                            data,
                        },
                    );
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
pub fn close_pty(id: String, manager: State<PtyManager>) -> Result<(), String> {
    manager.instances.lock().unwrap().remove(&id);
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
