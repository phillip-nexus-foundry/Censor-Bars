# Architecture

## Overview

Censor Bars is a Tauri 2 desktop application with a Rust backend and vanilla JS frontend.

## Window Model

- **Control Panel** (`control-panel`): Single main window for managing all bars.
- **Bar Windows** (`bar-{uuid}`): One frameless, transparent, always-on-top overlay window per censor bar.

## State Management

- Backend: `AppState` holds a `HashMap<BarId, BarState>` behind a `RwLock`.
- Frontend: Each bar window is self-contained. The control panel queries backend for bar list.
- Communication: Tauri IPC `invoke` commands for all state mutations.

## Data Flow

```
User action → Frontend JS → invoke("command") → Rust handler → AppState mutation
                                                            ↓
                                              Window eval() for live style updates
```

## Style System

Styles are tagged enums (`BarStyle`):
- `Solid { color }` — CSS color string
- `Gradient { css }` — Full CSS gradient expression
- `Animation { preset }` — CSS class-based animations
- `Image { path, fit }` — Background image with fit mode

## Security

- CSP restricts scripts to self + inline (needed for dynamic eval)
- No network access required — fully offline
- No file system access beyond optional image imports
