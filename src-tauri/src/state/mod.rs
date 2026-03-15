use crate::models::{BarGroup, BarId, BarState, GroupId, UndoAction};
use parking_lot::RwLock;
use std::collections::HashMap;

const MAX_UNDO_HISTORY: usize = 200;

/// Global application state managed by Tauri.
pub struct AppState {
    /// All active censor bars, keyed by their unique ID.
    pub bars: RwLock<HashMap<BarId, BarState>>,
    /// Named groups (keyed by group number 0-9).
    pub groups: RwLock<HashMap<GroupId, BarGroup>>,
    /// Undo stack (most recent action at the end).
    pub undo_stack: RwLock<Vec<UndoAction>>,
    /// Redo stack (most recent undone action at the end).
    pub redo_stack: RwLock<Vec<UndoAction>>,
    /// Flag to suppress persistence saves during undo/redo batch operations.
    pub suppress_save: RwLock<bool>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            bars: RwLock::new(HashMap::new()),
            groups: RwLock::new(HashMap::new()),
            undo_stack: RwLock::new(Vec::new()),
            redo_stack: RwLock::new(Vec::new()),
            suppress_save: RwLock::new(false),
        }
    }

    // --- Bar operations ---

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

    pub fn clear_bars(&self) {
        self.bars.write().clear();
    }

    /// Get all bars belonging to a group.
    pub fn bars_in_group(&self, group_id: GroupId) -> Vec<BarState> {
        self.bars
            .read()
            .values()
            .filter(|b| b.group_id == Some(group_id))
            .cloned()
            .collect()
    }

    // --- Group operations ---

    pub fn get_group(&self, id: GroupId) -> Option<BarGroup> {
        self.groups.read().get(&id).cloned()
    }

    pub fn set_group(&self, group: BarGroup) {
        self.groups.write().insert(group.id, group);
    }

    pub fn remove_group(&self, id: GroupId) -> Option<BarGroup> {
        self.groups.write().remove(&id)
    }

    pub fn list_groups(&self) -> Vec<BarGroup> {
        let mut groups: Vec<_> = self.groups.read().values().cloned().collect();
        groups.sort_by_key(|g| g.id);
        groups
    }

    // --- Undo/Redo ---

    /// Push an action onto the undo stack and clear the redo stack.
    pub fn push_undo(&self, action: UndoAction) {
        let mut stack = self.undo_stack.write();
        stack.push(action);
        if stack.len() > MAX_UNDO_HISTORY {
            stack.remove(0);
        }
        // New action invalidates redo history
        self.redo_stack.write().clear();
    }

    /// Push an action during undo/redo without clearing redo.
    pub fn push_undo_no_clear(&self, action: UndoAction) {
        let mut stack = self.undo_stack.write();
        stack.push(action);
        if stack.len() > MAX_UNDO_HISTORY {
            stack.remove(0);
        }
    }

    pub fn pop_undo(&self) -> Option<UndoAction> {
        self.undo_stack.write().pop()
    }

    pub fn push_redo(&self, action: UndoAction) {
        self.redo_stack.write().push(action);
    }

    pub fn pop_redo(&self) -> Option<UndoAction> {
        self.redo_stack.write().pop()
    }

    pub fn undo_count(&self) -> usize {
        self.undo_stack.read().len()
    }

    pub fn redo_count(&self) -> usize {
        self.redo_stack.read().len()
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
