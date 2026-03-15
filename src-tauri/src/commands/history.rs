use crate::commands::bar::spawn_bar_window;
use crate::models::{BarGroup, UndoAction};
use crate::state::AppState;
use tauri::{AppHandle, Manager, State};

fn trigger_save(app: &AppHandle, state: &AppState) {
    let persisted = crate::models::PersistedState {
        bars: state.list_bars(),
        groups: state.list_groups(),
    };
    if let Err(e) = crate::utils::persistence::save_state(app, &persisted) {
        log::error!("Auto-save failed: {}", e);
    }
}

/// Apply the reverse of an action (for undo) and return the forward action (for redo).
fn reverse_action(app: &AppHandle, state: &AppState, action: &UndoAction) -> Result<(), String> {
    match action {
        UndoAction::CreateBar { bar_id } => {
            // Undo creation = delete the bar
            if let Some(bar) = state.remove_bar(bar_id) {
                if let Some(window) = app.get_webview_window(&bar.label) {
                    let _ = window.close();
                }
            }
        }

        UndoAction::DeleteBars { bars } => {
            // Undo deletion = restore the bars
            for bar in bars {
                state.insert_bar(bar.clone());
                // Ensure group exists if bar was in a group
                if let Some(gid) = bar.group_id {
                    if state.get_group(gid).is_none() {
                        state.set_group(BarGroup::new(gid));
                    }
                }
                spawn_bar_window(app, bar)?;
                // Apply style to restored bar
                if let Some(window) = app.get_webview_window(&bar.label) {
                    let style_json = serde_json::to_string(&bar.style).unwrap_or_default();
                    let _ = window.eval(&format!("window.__applyStyle({})", style_json));
                    let _ = window.eval(&format!("window.__setOpacity({})", bar.opacity));
                }
            }
        }

        UndoAction::MoveBars { moves } => {
            // Undo move = restore old positions
            for m in moves {
                state.update_bar(&m.bar_id, |b| {
                    b.x = m.old_x;
                    b.y = m.old_y;
                });
                if let Some(bar) = state.get_bar(&m.bar_id) {
                    if let Some(window) = app.get_webview_window(&bar.label) {
                        let _ = window.set_position(tauri::Position::Physical(
                            tauri::PhysicalPosition::new(m.old_x as i32, m.old_y as i32),
                        ));
                    }
                }
            }
        }

        UndoAction::ResizeBar {
            bar_id,
            old_width,
            old_height,
            ..
        } => {
            state.update_bar(bar_id, |b| {
                b.width = *old_width;
                b.height = *old_height;
            });
            if let Some(bar) = state.get_bar(bar_id) {
                if let Some(window) = app.get_webview_window(&bar.label) {
                    let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize::new(
                        *old_width as u32,
                        *old_height as u32,
                    )));
                }
            }
        }

        UndoAction::ChangeStyle {
            bar_id, old_style, ..
        } => {
            state.update_bar(bar_id, |b| {
                b.style = old_style.clone();
            });
            if let Some(bar) = state.get_bar(bar_id) {
                if let Some(window) = app.get_webview_window(&bar.label) {
                    let style_json = serde_json::to_string(old_style).unwrap_or_default();
                    let _ = window.eval(&format!("window.__applyStyle({})", style_json));
                }
            }
        }

        UndoAction::ChangeOpacity {
            bar_id,
            old_opacity,
            ..
        } => {
            state.update_bar(bar_id, |b| {
                b.opacity = *old_opacity;
            });
            if let Some(bar) = state.get_bar(bar_id) {
                if let Some(window) = app.get_webview_window(&bar.label) {
                    let _ = window.eval(&format!("window.__setOpacity({})", old_opacity));
                }
            }
        }

        UndoAction::GroupBars {
            previous_groups, ..
        } => {
            // Undo grouping = restore previous group assignments
            for (bar_id, old_group) in previous_groups {
                state.update_bar(bar_id, |b| {
                    b.group_id = *old_group;
                });
            }
        }

        UndoAction::UngroupBars {
            group_id,
            group_name,
            bar_ids,
        } => {
            // Undo ungrouping = restore the group
            state.set_group(BarGroup {
                id: *group_id,
                name: group_name.clone(),
            });
            for bar_id in bar_ids {
                state.update_bar(bar_id, |b| {
                    b.group_id = Some(*group_id);
                });
            }
        }

        UndoAction::RenameGroup {
            group_id, old_name, ..
        } => {
            if let Some(mut group) = state.get_group(*group_id) {
                group.name = old_name.clone();
                state.set_group(group);
            }
        }
    }

    Ok(())
}

/// Create the inverse action for redo purposes.
fn invert_action(action: &UndoAction) -> UndoAction {
    match action {
        UndoAction::CreateBar { bar_id } => UndoAction::CreateBar {
            bar_id: bar_id.clone(),
        },

        UndoAction::DeleteBars { bars } => UndoAction::DeleteBars {
            bars: bars.clone(),
        },

        UndoAction::MoveBars { moves } => UndoAction::MoveBars {
            moves: moves
                .iter()
                .map(|m| crate::models::BarMove {
                    bar_id: m.bar_id.clone(),
                    old_x: m.new_x,
                    old_y: m.new_y,
                    new_x: m.old_x,
                    new_y: m.old_y,
                })
                .collect(),
        },

        UndoAction::ResizeBar {
            bar_id,
            old_width,
            old_height,
            new_width,
            new_height,
        } => UndoAction::ResizeBar {
            bar_id: bar_id.clone(),
            old_width: *new_width,
            old_height: *new_height,
            new_width: *old_width,
            new_height: *old_height,
        },

        UndoAction::ChangeStyle {
            bar_id,
            old_style,
            new_style,
        } => UndoAction::ChangeStyle {
            bar_id: bar_id.clone(),
            old_style: new_style.clone(),
            new_style: old_style.clone(),
        },

        UndoAction::ChangeOpacity {
            bar_id,
            old_opacity,
            new_opacity,
        } => UndoAction::ChangeOpacity {
            bar_id: bar_id.clone(),
            old_opacity: *new_opacity,
            new_opacity: *old_opacity,
        },

        UndoAction::GroupBars {
            bar_ids,
            group_id,
            previous_groups,
        } => UndoAction::GroupBars {
            bar_ids: bar_ids.clone(),
            group_id: *group_id,
            previous_groups: previous_groups.clone(),
        },

        UndoAction::UngroupBars {
            group_id,
            group_name,
            bar_ids,
        } => UndoAction::UngroupBars {
            group_id: *group_id,
            group_name: group_name.clone(),
            bar_ids: bar_ids.clone(),
        },

        UndoAction::RenameGroup {
            group_id,
            old_name,
            new_name,
        } => UndoAction::RenameGroup {
            group_id: *group_id,
            old_name: new_name.clone(),
            new_name: old_name.clone(),
        },
    }
}

/// Undo the last action.
#[tauri::command]
pub async fn undo(app: AppHandle, state: State<'_, AppState>) -> Result<bool, String> {
    let action = match state.pop_undo() {
        Some(a) => a,
        None => return Ok(false),
    };

    // Create the inverse for redo before reversing
    let redo_action = invert_action(&action);

    reverse_action(&app, &state, &action)?;
    state.push_redo(redo_action);

    trigger_save(&app, &state);
    Ok(true)
}

/// Redo the last undone action.
#[tauri::command]
pub async fn redo(app: AppHandle, state: State<'_, AppState>) -> Result<bool, String> {
    let action = match state.pop_redo() {
        Some(a) => a,
        None => return Ok(false),
    };

    let undo_action = invert_action(&action);

    reverse_action(&app, &state, &action)?;
    state.push_undo_no_clear(undo_action);

    trigger_save(&app, &state);
    Ok(true)
}

/// Get undo/redo stack sizes (for UI indicators).
#[tauri::command]
pub async fn history_status(state: State<'_, AppState>) -> Result<(usize, usize), String> {
    Ok((state.undo_count(), state.redo_count()))
}
