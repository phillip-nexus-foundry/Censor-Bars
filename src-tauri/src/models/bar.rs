use serde::{Deserialize, Serialize};

/// Unique identifier for a censor bar instance.
pub type BarId = String;

/// Unique identifier for a group.
pub type GroupId = u8;

/// Represents the visual style of a censor bar.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum BarStyle {
    /// Solid color fill.
    Solid { color: String },
    /// CSS gradient (linear, radial, or conic).
    Gradient { css: String },
    /// Animated color effect.
    Animation { preset: AnimationPreset },
    /// Custom image overlay.
    Image { path: String, fit: ImageFit },
}

impl Default for BarStyle {
    fn default() -> Self {
        BarStyle::Solid {
            color: "#000000".to_string(),
        }
    }
}

/// Built-in animation presets.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum AnimationPreset {
    OceanWave,
    Breathing,
    SunsetDrift,
    Aurora,
    NeonPulse,
    RainbowSweep,
    DigitalRain,
    LavaFlow,
}

/// How an image fills the bar area.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum ImageFit {
    Cover,
    Contain,
    Stretch,
    Tile,
}

/// Complete state of a single censor bar.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BarState {
    pub id: BarId,
    pub label: String,
    pub style: BarStyle,
    pub opacity: f64,
    pub click_through: bool,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    /// Group number (1-10, where 10 is stored as 0). None if ungrouped.
    #[serde(default)]
    pub group_id: Option<GroupId>,
}

impl BarState {
    pub fn new(id: BarId) -> Self {
        Self {
            label: format!("bar-{}", &id[..8]),
            id,
            style: BarStyle::default(),
            opacity: 1.0,
            click_through: false,
            x: 200.0,
            y: 200.0,
            width: 400.0,
            height: 60.0,
            group_id: None,
        }
    }
}

/// Named group of censor bars.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BarGroup {
    pub id: GroupId,
    pub name: String,
}

impl BarGroup {
    pub fn new(id: GroupId) -> Self {
        let display_num = if id == 0 { 10 } else { id as u16 };
        Self {
            id,
            name: format!("Group {}", display_num),
        }
    }
}

/// Payload sent from frontend to update a bar's visual style.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateStylePayload {
    pub bar_id: BarId,
    pub style: BarStyle,
}

/// Every undoable action in the system.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "action", rename_all = "camelCase")]
pub enum UndoAction {
    /// Bar was created. Undo = delete it.
    CreateBar {
        bar_id: BarId,
    },
    /// Bar(s) were deleted. Undo = restore them.
    DeleteBars {
        bars: Vec<BarState>,
    },
    /// Bar(s) were moved. Undo = restore old positions.
    MoveBars {
        moves: Vec<BarMove>,
    },
    /// Bar was resized.
    ResizeBar {
        bar_id: BarId,
        old_width: f64,
        old_height: f64,
        new_width: f64,
        new_height: f64,
    },
    /// Bar style was changed.
    ChangeStyle {
        bar_id: BarId,
        old_style: BarStyle,
        new_style: BarStyle,
    },
    /// Bar opacity was changed.
    ChangeOpacity {
        bar_id: BarId,
        old_opacity: f64,
        new_opacity: f64,
    },
    /// Bars were assigned to a group.
    GroupBars {
        bar_ids: Vec<BarId>,
        group_id: GroupId,
        /// Previous group assignments (bar_id, old_group_id)
        previous_groups: Vec<(BarId, Option<GroupId>)>,
    },
    /// A group was dissolved.
    UngroupBars {
        group_id: GroupId,
        group_name: String,
        bar_ids: Vec<BarId>,
    },
    /// A group was renamed.
    RenameGroup {
        group_id: GroupId,
        old_name: String,
        new_name: String,
    },
}

/// Position delta for a single bar move.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BarMove {
    pub bar_id: BarId,
    pub old_x: f64,
    pub old_y: f64,
    pub new_x: f64,
    pub new_y: f64,
}

/// Serializable app state for persistence.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PersistedState {
    pub bars: Vec<BarState>,
    pub groups: Vec<BarGroup>,
}
