use crate::models::{BarId, BarMove, BarState, UndoAction, UpdateStylePayload};
use crate::state::AppState;
use tauri::{AppHandle, Manager, State, WebviewUrl, WebviewWindowBuilder};
use uuid::Uuid;

/// Helper: build and persist state after mutation.
fn trigger_save(app: &AppHandle, state: &AppState) {
    if *state.suppress_save.read() {
        return;
    }
    let persisted = crate::models::PersistedState {
        bars: state.list_bars(),
        groups: state.list_groups(),
    };
    if let Err(e) = crate::utils::persistence::save_state(app, &persisted) {
        log::error!("Auto-save failed: {}", e);
    }
}

/// Spawn a bar overlay window from a BarState.
pub fn spawn_bar_window(app: &AppHandle, bar: &BarState) -> Result<(), String> {
    let url = WebviewUrl::App(format!("bar.html?id={}", bar.id).into());

    WebviewWindowBuilder::new(app, &bar.label, url)
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

    Ok(())
}

/// Create a new censor bar overlay window.
#[tauri::command]
pub async fn create_bar(app: AppHandle, state: State<'_, AppState>) -> Result<BarState, String> {
    let id = Uuid::new_v4().to_string();
    let bar = BarState::new(id.clone());

    spawn_bar_window(&app, &bar)?;
    state.insert_bar(bar.clone());

    // Record undo action
    state.push_undo(UndoAction::CreateBar {
        bar_id: id.clone(),
    });

    trigger_save(&app, &state);
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
            let _ = window.close();
        }
        // Record undo action
        state.push_undo(UndoAction::DeleteBars {
            bars: vec![bar.clone()],
        });
        trigger_save(&app, &state);
        log::info!("Closed bar: {}", bar_id);
        Ok(())
    } else {
        Err(format!("Bar not found: {}", bar_id))
    }
}

/// Delete bars by IDs. If a bar is in a group, delete the entire group.
#[tauri::command]
pub async fn delete_bars(
    app: AppHandle,
    state: State<'_, AppState>,
    bar_ids: Vec<BarId>,
) -> Result<Vec<BarId>, String> {
    let mut all_bars_to_delete: Vec<BarState> = Vec::new();
    let mut ids_to_delete: Vec<BarId> = Vec::new();
    let mut groups_to_check: Vec<u8> = Vec::new();

    // Collect bars and their groups
    for bar_id in &bar_ids {
        if let Some(bar) = state.get_bar(bar_id) {
            if let Some(gid) = bar.group_id {
                if !groups_to_check.contains(&gid) {
                    groups_to_check.push(gid);
                }
            } else if !ids_to_delete.contains(bar_id) {
                ids_to_delete.push(bar_id.clone());
            }
        }
    }

    // Add all bars from affected groups
    for gid in &groups_to_check {
        for bar in state.bars_in_group(*gid) {
            if !ids_to_delete.contains(&bar.id) {
                ids_to_delete.push(bar.id.clone());
            }
        }
    }

    // Remove bars and close windows
    for bar_id in &ids_to_delete {
        if let Some(bar) = state.remove_bar(bar_id) {
            if let Some(window) = app.get_webview_window(&bar.label) {
                let _ = window.close();
            }
            all_bars_to_delete.push(bar);
        }
    }

    // Remove emptied groups
    for gid in &groups_to_check {
        if state.bars_in_group(*gid).is_empty() {
            state.remove_group(*gid);
        }
    }

    if !all_bars_to_delete.is_empty() {
        state.push_undo(UndoAction::DeleteBars {
            bars: all_bars_to_delete,
        });
        trigger_save(&app, &state);
    }

    Ok(ids_to_delete)
}

/// Close all active censor bars.
#[tauri::command]
pub async fn close_all_bars(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let bars = state.list_bars();
    if !bars.is_empty() {
        state.push_undo(UndoAction::DeleteBars {
            bars: bars.clone(),
        });
    }
    for bar in &bars {
        if let Some(window) = app.get_webview_window(&bar.label) {
            let _ = window.close();
        }
    }
    state.clear_bars();
    trigger_save(&app, &state);
    log::info!("Closed all bars");
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
    let bar = state
        .get_bar(&payload.bar_id)
        .ok_or_else(|| format!("Bar not found: {}", payload.bar_id))?;

    let old_style = bar.style.clone();
    let new_style = payload.style.clone();
    let bar_label = bar.label.clone();

    let style_json =
        serde_json::to_string(&payload.style).map_err(|e| format!("Serialize error: {}", e))?;

    state.update_bar(&payload.bar_id, |b| {
        b.style = payload.style;
    });

    // Record undo
    state.push_undo(UndoAction::ChangeStyle {
        bar_id: payload.bar_id.clone(),
        old_style,
        new_style,
    });

    // Notify the bar's webview
    if let Some(window) = app.get_webview_window(&bar_label) {
        let _ = window.eval(&format!("window.__applyStyle({})", style_json));
    }

    trigger_save(&app, &state);
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

    trigger_save(&app, &state);
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

    let bar = state
        .get_bar(&bar_id)
        .ok_or_else(|| format!("Bar not found: {}", bar_id))?;

    let old_opacity = bar.opacity;

    state.update_bar(&bar_id, |b| {
        b.opacity = opacity;
    });

    state.push_undo(UndoAction::ChangeOpacity {
        bar_id: bar_id.clone(),
        old_opacity,
        new_opacity: opacity,
    });

    if let Some(window) = app.get_webview_window(&bar.label) {
        let _ = window.eval(&format!("window.__setOpacity({})", opacity));
    }

    trigger_save(&app, &state);
    Ok(())
}

/// Update bar position (called after drag ends to record for undo).
#[tauri::command]
pub async fn update_bar_position(
    app: AppHandle,
    state: State<'_, AppState>,
    bar_id: BarId,
    x: f64,
    y: f64,
    _old_x: f64,
    _old_y: f64,
) -> Result<(), String> {
    state.update_bar(&bar_id, |b| {
        b.x = x;
        b.y = y;
    });

    trigger_save(&app, &state);
    Ok(())
}

/// Record a completed move of one or more bars (for undo).
#[tauri::command]
pub async fn record_move(
    app: AppHandle,
    state: State<'_, AppState>,
    moves: Vec<BarMove>,
) -> Result<(), String> {
    // Update positions in state
    for m in &moves {
        state.update_bar(&m.bar_id, |b| {
            b.x = m.new_x;
            b.y = m.new_y;
        });
    }

    if !moves.is_empty() {
        state.push_undo(UndoAction::MoveBars {
            moves: moves.clone(),
        });
    }

    trigger_save(&app, &state);
    Ok(())
}

/// Record a completed resize (for undo).
#[tauri::command]
pub async fn record_resize(
    app: AppHandle,
    state: State<'_, AppState>,
    bar_id: BarId,
    old_width: f64,
    old_height: f64,
    new_width: f64,
    new_height: f64,
) -> Result<(), String> {
    state.update_bar(&bar_id, |b| {
        b.width = new_width;
        b.height = new_height;
    });

    state.push_undo(UndoAction::ResizeBar {
        bar_id,
        old_width,
        old_height,
        new_width,
        new_height,
    });

    trigger_save(&app, &state);
    Ok(())
}
