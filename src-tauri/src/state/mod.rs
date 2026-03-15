use crate::models::{BarId, BarState};
use parking_lot::RwLock;
use std::collections::HashMap;

/// Global application state managed by Tauri.
pub struct AppState {
    /// All active censor bars, keyed by their unique ID.
    pub bars: RwLock<HashMap<BarId, BarState>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            bars: RwLock::new(HashMap::new()),
        }
    }

    pub fn insert_bar(&self, bar: BarState) {
        self.bars.write().insert(bar.id.clone(), bar);
    }

    pub fn remove_bar(&self, id: &str) -> Option<BarState> {
        self.bars.write().remove(id)
    }

    pub fn get_bar(&self, id: &str) -> Option<BarState> {
        self.bars.read().get(id).cloned()
    }

    pub fn list_bars(&self) -> Vec<BarState> {
        self.bars.read().values().cloned().collect()
    }

    pub fn update_bar<F>(&self, id: &str, updater: F) -> bool
    where
        F: FnOnce(&mut BarState),
    {
        if let Some(bar) = self.bars.write().get_mut(id) {
            updater(bar);
            true
        } else {
            false
        }
    }

    pub fn clear(&self) {
        self.bars.write().clear();
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
