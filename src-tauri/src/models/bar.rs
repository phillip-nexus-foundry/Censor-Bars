use serde::{Deserialize, Serialize};

/// Unique identifier for a censor bar instance.
pub type BarId = String;

/// Represents the visual style of a censor bar.
#[derive(Debug, Clone, Serialize, Deserialize)]
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
            color: "#1a1a2e".to_string(),
        }
    }
}

/// Built-in animation presets.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AnimationPreset {
    /// Slow, calming ocean-wave gradient shift
    OceanWave,
    /// Gentle breathing pulse (opacity modulation)
    Breathing,
    /// Slow sunset gradient rotation
    SunsetDrift,
    /// Aurora borealis shimmer
    Aurora,
    /// Fast neon color cycling
    NeonPulse,
    /// Energetic rainbow sweep
    RainbowSweep,
    /// Matrix-style digital rain overlay
    DigitalRain,
    /// Lava lamp fluid motion
    LavaFlow,
}

/// How an image fills the bar area.
#[derive(Debug, Clone, Serialize, Deserialize)]
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
}

impl BarState {
    pub fn new(id: BarId) -> Self {
        Self {
            label: format!("bar-{}", &id[..8]),
            id,
            style: BarStyle::default(),
            opacity: 1.0,
            click_through: false,
            x: 100.0,
            y: 100.0,
            width: 400.0,
            height: 60.0,
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
