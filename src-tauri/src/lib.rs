mod commands;

use commands::filesystem::{
    create_dir, create_file, delete_path, open_in_editor, read_dir, read_file, rename_path,
};
use commands::pty::{close_pty, resize_pty, spawn_pty, write_pty, PtyManager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(PtyManager::new())
        .invoke_handler(tauri::generate_handler![
            spawn_pty,
            write_pty,
            resize_pty,
            close_pty,
            read_dir,
            read_file,
            create_file,
            create_dir,
            rename_path,
            delete_path,
            open_in_editor,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
