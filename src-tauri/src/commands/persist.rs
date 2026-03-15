use crate::commands::bar::spawn_bar_window;
use crate::models::PersistedState;
use crate::state::AppState;
use crate::utils::persistence;
use tauri::{AppHandle, Manager, State};

/// Load persisted state and restore all bars/groups.
#[tauri::command]
pub async fn restore_state(app: AppHandle, state: State<'_, AppState>) -> Result<usize, String> {
    let persisted = match persistence::load_state(&app)? {
        Some(p) => p,
        None => return Ok(0),
    };

    // Restore groups first
    for group in &persisted.groups {
        state.set_group(group.clone());
    }

    // Restore bars
    let count = persisted.bars.len();
    for bar in &persisted.bars {
        state.insert_bar(bar.clone());
        spawn_bar_window(&app, bar)?;

        // Apply saved style and opacity after window creation
        if let Some(window) = app.get_webview_window(&bar.label) {
            let style_json = serde_json::to_string(&bar.style).unwrap_or_default();
            // Small delay to let webview initialize
            let _ = window.eval(&format!(
                "setTimeout(() => {{ if(window.__applyStyle) window.__applyStyle({}); if(window.__setOpacity) window.__setOpacity({}); }}, 200)",
                style_json, bar.opacity
            ));
        }
    }

    log::info!(
        "Restored {} bars and {} groups",
        count,
        persisted.groups.len()
    );
    Ok(count)
}

/// Manually trigger a save (for debounced saves from the frontend).
#[tauri::command]
pub async fn save_state(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let persisted = PersistedState {
        bars: state.list_bars(),
        groups: state.list_groups(),
    };
    persistence::save_state(&app, &persisted)
}
