use crate::models::{BarGroup, BarId, GroupId, UndoAction};
use crate::state::AppState;
use tauri::{AppHandle, State};

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

/// Assign selected bars to a group (Ctrl+1-0).
#[tauri::command]
pub async fn group_bars(
    app: AppHandle,
    state: State<'_, AppState>,
    bar_ids: Vec<BarId>,
    group_id: GroupId,
) -> Result<(), String> {
    if bar_ids.is_empty() {
        return Ok(());
    }

    // Record previous group assignments for undo
    let mut previous_groups: Vec<(BarId, Option<GroupId>)> = Vec::new();
    for bar_id in &bar_ids {
        if let Some(bar) = state.get_bar(bar_id) {
            previous_groups.push((bar_id.clone(), bar.group_id));
        }
    }

    // Ensure group exists
    if state.get_group(group_id).is_none() {
        state.set_group(BarGroup::new(group_id));
    }

    // Assign bars to group
    for bar_id in &bar_ids {
        state.update_bar(bar_id, |b| {
            b.group_id = Some(group_id);
        });
    }

    state.push_undo(UndoAction::GroupBars {
        bar_ids: bar_ids.clone(),
        group_id,
        previous_groups,
    });

    trigger_save(&app, &state);
    log::info!("Grouped {} bars into group {}", bar_ids.len(), group_id);
    Ok(())
}

/// Ungroup all bars from a specific group (Ctrl+Shift+1-0).
#[tauri::command]
pub async fn ungroup_bars(
    app: AppHandle,
    state: State<'_, AppState>,
    group_id: GroupId,
) -> Result<Vec<BarId>, String> {
    let bars_in_group = state.bars_in_group(group_id);
    if bars_in_group.is_empty() {
        return Ok(vec![]);
    }

    let bar_ids: Vec<BarId> = bars_in_group.iter().map(|b| b.id.clone()).collect();
    let group_name = state
        .get_group(group_id)
        .map(|g| g.name.clone())
        .unwrap_or_else(|| format!("Group {}", group_id));

    // Remove group assignment from bars
    for bar_id in &bar_ids {
        state.update_bar(bar_id, |b| {
            b.group_id = None;
        });
    }

    // Remove the group
    state.remove_group(group_id);

    state.push_undo(UndoAction::UngroupBars {
        group_id,
        group_name,
        bar_ids: bar_ids.clone(),
    });

    trigger_save(&app, &state);
    log::info!("Ungrouped group {}", group_id);
    Ok(bar_ids)
}

/// Rename a group.
#[tauri::command]
pub async fn rename_group(
    app: AppHandle,
    state: State<'_, AppState>,
    group_id: GroupId,
    new_name: String,
) -> Result<(), String> {
    let group = state
        .get_group(group_id)
        .ok_or_else(|| format!("Group not found: {}", group_id))?;

    let old_name = group.name.clone();

    state.set_group(BarGroup {
        id: group_id,
        name: new_name.clone(),
    });

    state.push_undo(UndoAction::RenameGroup {
        group_id,
        old_name,
        new_name,
    });

    trigger_save(&app, &state);
    Ok(())
}

/// List all groups.
#[tauri::command]
pub async fn list_groups(state: State<'_, AppState>) -> Result<Vec<BarGroup>, String> {
    Ok(state.list_groups())
}

/// Get all bars in a specific group.
#[tauri::command]
pub async fn get_group_bars(
    state: State<'_, AppState>,
    group_id: GroupId,
) -> Result<Vec<crate::models::BarState>, String> {
    Ok(state.bars_in_group(group_id))
}
