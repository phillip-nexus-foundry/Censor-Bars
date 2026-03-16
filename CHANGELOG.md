# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial project scaffolding with Tauri 2 + Rust backend
- Censor bar creation, deletion, and management (18 IPC commands)
- Right-click context menu with 16 solid colors, 8 gradient presets, 8 animation presets
- Always-on-top transparent overlay windows (each bar is its own frameless window)
- System tray integration — left click restores panel, right click shows Exit menu
- Full undo/redo system (command pattern, 200-op max, 9 action variants)
- Multi-select support (Ctrl+Click)
- Grouping system (Ctrl+1-0 assign, Ctrl+Shift+1-0 ungroup, named groups)
- Handy-style floating control panel with backdrop blur
- Persistence — auto-save/restore all bar and group state to JSON
- Linux builds (binary, .deb, .rpm, AppImage)
- Windows builds (NSIS installer, MSI installer, portable exe)
- CI/CD pipeline, documentation, issue templates

### Improved (v0.1.2 — 2026-03-15)
- **Context menu redesigned** — wider (380px), dark themed, larger color/gradient swatches for easier browsing and selection
- **Context menu smart positioning** — menu appears offset below or above the click point (not over the bar), centered horizontally, with full viewport-aware repositioning
- **Context menu dismissal** — click anywhere outside the menu or press Escape to close without selecting; no longer requires clicking a color to dismiss
- **Bar minimum size reduced** — minimum inner size set to 1×1px, allowing bars to cover small elements like profile pictures or icons

### Added (v0.1.1 — 2026-03-15)
- **Dark theme (default)** — panel now ships with a dark theme; light theme available via sun/moon toggle in bottom-right corner
- **Click-through passthrough mode** — toggle button in panel + Alt+P hotkey; when active, all clicks pass through bars to the content below; bars become purely visual overlays
- **Gradient orientation control** — angle slider (0–360°) in the right-click context menu lets you rotate gradient direction on the fly; previews update live as you scroll
- **Global click-through IPC command** (`set_all_click_through`) — sets all bar windows to ignore or accept cursor events simultaneously

### Fixed (v0.1.1 — 2026-03-15)
- **Double tray icon** — removed duplicate tray icon created by both `tauri.conf.json` config and programmatic `TrayIconBuilder`; now only programmatic tray exists
- **Left click on tray = right click** — added `menu_on_left_click(false)` so left click restores the panel window and right click shows the exit menu
- **Bar positions not persisting** — drag end now properly records new positions via `record_move` IPC, which updates state and triggers auto-save
- **Bars not draggable** — replaced `data-tauri-drag-region` attribute with programmatic `startDragging()` API (JS mousedown handlers were consuming events)
- **Double-click maximizes bars** — disabled maximizable on bar windows and added `dblclick` event prevention
- **WebView default context menu showing** — blocked browser/WebView context menu globally; only custom color/gradient/animation menu appears on right-click
- **Bars can't be resized smaller** — set minimum inner size to 20×10px, allowing bars to be shrunk very small in both directions

### Changed (v0.1.1 — 2026-03-15)
- Panel close/minimize buttons now hide to tray instead of minimizing; tray left-click restores
- Gradient presets stored as color stops with dynamic angle application instead of hardcoded CSS strings
- Default accent color remains `#667eea` across both themes

## [0.1.0] — 2026-03-15

### Added
- Initial release
- Tauri 2 + Rust backend with vanilla JS frontend
- 18 IPC commands across bar, group, history, and persistence modules
- Right-click context menu with colors, gradients, animations, opacity
- Undo/redo with command pattern (200-op max)
- Multi-select and grouping
- Persistence to JSON
- System tray
- Linux and Windows builds
