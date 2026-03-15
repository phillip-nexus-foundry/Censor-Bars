pub mod commands;
pub mod models;
pub mod state;
pub mod utils;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState::new())
        .setup(|_app| {
            log::info!("Censor Bars starting");
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
