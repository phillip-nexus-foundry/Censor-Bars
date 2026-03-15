use crate::models::PersistedState;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const STATE_FILE: &str = "censor-bars-state.json";

/// Get the path to the persistence file.
fn state_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    fs::create_dir_all(&data_dir)
        .map_err(|e| format!("Failed to create app data dir: {}", e))?;
    Ok(data_dir.join(STATE_FILE))
}

/// Save the current state to disk.
pub fn save_state(app: &AppHandle, state: &PersistedState) -> Result<(), String> {
    let path = state_file_path(app)?;
    let json = serde_json::to_string_pretty(state)
        .map_err(|e| format!("Failed to serialize state: {}", e))?;
    fs::write(&path, json).map_err(|e| format!("Failed to write state file: {}", e))?;
    log::debug!("State saved to {:?}", path);
    Ok(())
}

/// Load persisted state from disk. Returns None if no state file exists.
pub fn load_state(app: &AppHandle) -> Result<Option<PersistedState>, String> {
    let path = state_file_path(app)?;
    if !path.exists() {
        return Ok(None);
    }
    let json =
        fs::read_to_string(&path).map_err(|e| format!("Failed to read state file: {}", e))?;
    let state: PersistedState =
        serde_json::from_str(&json).map_err(|e| format!("Failed to parse state file: {}", e))?;
    log::info!("Loaded {} bars from persisted state", state.bars.len());
    Ok(Some(state))
}
