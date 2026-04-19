mod commands;
mod terminal;

use commands::config::{add_recent_project, get_appearance, get_recent_projects, save_appearance};
use commands::fonts::load_font_bytes;
use commands::git::{git_branch, git_status};
use commands::filesystem::{
    copy_path, create_dir, create_file, delete_path, open_in_editor, read_dir, read_file,
    rename_path, write_file,
};
use commands::notification::{
    send_notification, set_pty_display_title, start_hook_server, DisplayTitleCache,
};
use commands::pty::{close_pty, resize_pty, resize_terminal, scroll_terminal, spawn_pty, write_pty, PtyManager};
use commands::skills::list_claude_skills;
use tauri::menu::{MenuBuilder, MenuItem, SubmenuBuilder, WINDOW_SUBMENU_ID};
use tauri::Emitter;
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

            let new_window_item = MenuItem::with_id(
                app,
                "new-window",
                "New Window",
                true,
                Some("CmdOrCtrl+N"),
            )?;

            let file_submenu = SubmenuBuilder::new(app, "File")
                .item(&new_window_item)
                .separator()
                .close_window()
                .build()?;

            let edit_submenu = SubmenuBuilder::new(app, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;

            // macOS に「Window メニュー」と認識させるために WINDOW_SUBMENU_ID を付与する。
            // これにより macOS (AppKit) が自動で Show Tab Bar / Merge All Windows /
            // Move Tab to New Window 等のタブ関連項目を追加する。
            let window_submenu = SubmenuBuilder::with_id(app, WINDOW_SUBMENU_ID, "Window")
                .minimize()
                .maximize()
                .separator()
                .close_window()
                .build()?;

            let mut menu_builder = MenuBuilder::new(app);

            #[cfg(target_os = "macos")]
            {
                let app_submenu = SubmenuBuilder::new(app, "SpecPrompt")
                    .about(None)
                    .separator()
                    .services()
                    .separator()
                    .hide()
                    .hide_others()
                    .show_all()
                    .separator()
                    .quit()
                    .build()?;
                menu_builder = menu_builder.item(&app_submenu);
            }

            menu_builder = menu_builder.item(&file_submenu).item(&edit_submenu);

            #[cfg(target_os = "macos")]
            {
                let view_submenu = SubmenuBuilder::new(app, "View").fullscreen().build()?;
                menu_builder = menu_builder.item(&view_submenu);
            }

            let menu = menu_builder.item(&window_submenu).build()?;

            app.set_menu(menu)?;
            app.on_menu_event(|app_handle, event| {
                if event.id() == "new-window" {
                    let _ = app_handle.emit("menu-new-window", ());
                }
            });

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
            copy_path,
            delete_path,
            open_in_editor,
            write_file,
            get_recent_projects,
            add_recent_project,
            get_appearance,
            save_appearance,
            load_font_bytes,
            git_status,
            git_branch,
            send_notification,
            set_pty_display_title,
            list_claude_skills,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
