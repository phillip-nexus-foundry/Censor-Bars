use crate::models::{BarId, BarState, BarStyle, UpdateStylePayload};
use crate::state::AppState;
use tauri::{AppHandle, Manager, State, WebviewUrl, WebviewWindowBuilder};
use uuid::Uuid;

/// Create a new censor bar overlay window.
#[tauri::command]
pub async fn create_bar(app: AppHandle, state: State<'_, AppState>) -> Result<BarState, String> {
    let id = Uuid::new_v4().to_string();
    let bar = BarState::new(id.clone());
    let label = bar.label.clone();

    // Create a frameless, transparent, always-on-top overlay window
    let url = WebviewUrl::App(format!("bar.html?id={}", id).into());

    WebviewWindowBuilder::new(&app, &label, url)
        .title("Censor Bar")
        .inner_size(bar.width, bar.height)
        .position(bar.x, bar.y)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .resizable(true)
        .skip_taskbar(true)
        .build()
        .map_err(|e| format!("Failed to create bar window: {}", e))?;

    state.insert_bar(bar.clone());
    log::info!("Created bar: {}", id);
    Ok(bar)
}

/// Close and remove a specific censor bar.
#[tauri::command]
pub async fn close_bar(
    app: AppHandle,
    state: State<'_, AppState>,
    bar_id: BarId,
) -> Result<(), String> {
    if let Some(bar) = state.remove_bar(&bar_id) {
        if let Some(window) = app.get_webview_window(&bar.label) {
            window.close().map_err(|e| e.to_string())?;
        }
        log::info!("Closed bar: {}", bar_id);
        Ok(())
    } else {
        Err(format!("Bar not found: {}", bar_id))
    }
}

/// Close all active censor bars.
#[tauri::command]
pub async fn close_all_bars(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let bars = state.list_bars();
    for bar in &bars {
        if let Some(window) = app.get_webview_window(&bar.label) {
            let _ = window.close();
        }
    }
    state.clear();
    log::info!("Closed all {} bars", bars.len());
    Ok(())
}

/// List all active bars and their current state.
#[tauri::command]
pub async fn list_bars(state: State<'_, AppState>) -> Result<Vec<BarState>, String> {
    Ok(state.list_bars())
}

/// Update the visual style of a censor bar.
#[tauri::command]
pub async fn update_bar_style(
    app: AppHandle,
    state: State<'_, AppState>,
    payload: UpdateStylePayload,
) -> Result<(), String> {
    let bar_label = state
        .get_bar(&payload.bar_id)
        .map(|b| b.label.clone())
        .ok_or_else(|| format!("Bar not found: {}", payload.bar_id))?;

    let style_json =
        serde_json::to_string(&payload.style).map_err(|e| format!("Serialize error: {}", e))?;

    state.update_bar(&payload.bar_id, |bar| {
        bar.style = payload.style;
    });

    // Notify the bar's webview to apply the new style
    if let Some(window) = app.get_webview_window(&bar_label) {
        window
            .eval(&format!("window.__applyStyle({})", style_json))
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// Toggle click-through mode on a bar.
#[tauri::command]
pub async fn toggle_click_through(
    app: AppHandle,
    state: State<'_, AppState>,
    bar_id: BarId,
) -> Result<bool, String> {
    let bar = state
        .get_bar(&bar_id)
        .ok_or_else(|| format!("Bar not found: {}", bar_id))?;

    let new_value = !bar.click_through;

    state.update_bar(&bar_id, |b| {
        b.click_through = new_value;
    });

    if let Some(window) = app.get_webview_window(&bar.label) {
        window
            .set_ignore_cursor_events(new_value)
            .map_err(|e| e.to_string())?;
    }

    Ok(new_value)
}

/// Set the opacity of a censor bar (0.0 to 1.0).
#[tauri::command]
pub async fn set_bar_opacity(
    app: AppHandle,
    state: State<'_, AppState>,
    bar_id: BarId,
    opacity: f64,
) -> Result<(), String> {
    let opacity = opacity.clamp(0.0, 1.0);

    let bar_label = state
        .get_bar(&bar_id)
        .map(|b| b.label.clone())
        .ok_or_else(|| format!("Bar not found: {}", bar_id))?;

    state.update_bar(&bar_id, |b| {
        b.opacity = opacity;
    });

    if let Some(window) = app.get_webview_window(&bar_label) {
        window
            .eval(&format!("window.__setOpacity({})", opacity))
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}
