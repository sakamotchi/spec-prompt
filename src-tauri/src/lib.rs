mod commands;
mod terminal;

use commands::config::{add_recent_project, get_appearance, get_recent_projects, save_appearance};
use commands::fonts::load_font_bytes;
use commands::git::git_status;
use commands::filesystem::{
    create_dir, create_file, delete_path, open_in_editor, read_dir, read_file, rename_path,
    write_file,
};
use commands::notification::{
    send_notification, set_pty_display_title, start_hook_server, DisplayTitleCache,
};
use commands::pty::{close_pty, resize_pty, resize_terminal, scroll_terminal, spawn_pty, write_pty, PtyManager};
use terminal::TerminalManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .manage(PtyManager::new())
        .manage(TerminalManager::new())
        .manage(DisplayTitleCache::new())
        .setup(|app| {
            start_hook_server(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            spawn_pty,
            write_pty,
            resize_pty,
            resize_terminal,
            scroll_terminal,
            close_pty,
            read_dir,
            read_file,
            create_file,
            create_dir,
            rename_path,
            delete_path,
            open_in_editor,
            write_file,
            get_recent_projects,
            add_recent_project,
            get_appearance,
            save_appearance,
            load_font_bytes,
            git_status,
            send_notification,
            set_pty_display_title,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
