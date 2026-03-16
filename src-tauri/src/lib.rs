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

            // Create tray menu with Exit option
            let quit_item = MenuItem::with_id(app, "quit", "Exit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&quit_item])?;

            // Set up tray icon with click handlers
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Censor Bars")
                .menu(&menu)
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
                                if let Err(e) = window.show() {
                                    log::error!("Failed to show window: {}", e);
                                }
                                if let Err(e) = window.set_focus() {
                                    log::error!("Failed to focus window: {}", e);
                                }
                            }
                        }
                        // Right click is handled automatically by the menu
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
