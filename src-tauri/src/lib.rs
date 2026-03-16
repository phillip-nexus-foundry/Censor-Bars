pub mod commands;
pub mod models;
pub mod state;
pub mod utils;

use state::AppState;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState::new())
        .setup(|app| {
            log::info!("Censor Bars starting");

            // Create tray menu with Exit option (only shows on right-click)
            let quit_item = MenuItem::with_id(app, "quit", "Exit Censor Bars", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&quit_item])?;

            // Set up tray icon — left click restores panel, right click shows menu
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Censor Bars")
                .menu(&menu)
                .show_menu_on_left_click(false) // Don't show menu on left click
                .on_menu_event(|app, event| {
                    if event.id() == "quit" {
                        log::info!("Exit requested from tray menu");
                        app.exit(0);
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click { button, .. } = event {
                        if button == tauri::tray::MouseButton::Left {
                            // Left click: show/restore the control panel window
                            if let Some(window) = tray.app_handle().get_webview_window("control-panel") {
                                let _ = window.unminimize();
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        // Right click shows the menu automatically
                    }
                })
                .build(app)?;

            log::info!("Tray icon set up successfully");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Bar commands
            commands::bar::create_bar,
            commands::bar::close_bar,
            commands::bar::delete_bars,
            commands::bar::close_all_bars,
            commands::bar::list_bars,
            commands::bar::update_bar_style,
            commands::bar::toggle_click_through,
            commands::bar::set_all_click_through,
            commands::bar::set_bar_opacity,
            commands::bar::update_bar_position,
            commands::bar::record_move,
            commands::bar::record_resize,
            // Group commands
            commands::group::group_bars,
            commands::group::ungroup_bars,
            commands::group::rename_group,
            commands::group::list_groups,
            commands::group::get_group_bars,
            // History commands
            commands::history::undo,
            commands::history::redo,
            commands::history::history_status,
            // Persistence commands
            commands::persist::restore_state,
            commands::persist::save_state,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Censor Bars");
}
