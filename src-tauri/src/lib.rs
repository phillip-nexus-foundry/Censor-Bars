pub mod commands;
pub mod models;
pub mod state;
pub mod utils;

use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState::new())
        .setup(|app| {
            // Initialize system tray behavior
            let _tray = app.tray_by_id("default");
            log::info!("Censor Bars started");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::bar::create_bar,
            commands::bar::close_bar,
            commands::bar::close_all_bars,
            commands::bar::list_bars,
            commands::bar::update_bar_style,
            commands::bar::toggle_click_through,
            commands::bar::set_bar_opacity,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Censor Bars");
}
