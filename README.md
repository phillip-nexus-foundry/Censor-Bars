# Censor Bars

**Privacy screen overlay for desktop** — create resizable, draggable censor bars to cover sensitive content during screen sharing or when someone is looking over your shoulder.

Built with **Rust + Tauri 2** and a lightweight web frontend.

![License](https://img.shields.io/github/license/phillip-Nexus-Foundry/Censor-Bars)
![Build](https://img.shields.io/github/actions/workflow/status/phillip-Nexus-Foundry/Censor-Bars/ci.yml?branch=main)

---

## Features

- **Unlimited censor bars** — spawn as many as you need, each independently resizable and draggable
- **Always-on-top** — bars float above all other windows
- **Right-click context menu** — change color, gradient, image, or animation per bar
- **Rich color options** — solid colors, gradients (linear, radial, conic), custom hex/RGB
- **Animated effects** — smooth color transitions, pulsing, gradient rotation, wave effects
- **Mood presets** — relaxing (slow ocean waves, gentle breathing), energetic (fast cycling, neon pulse)
- **Image overlays** — use custom images as bar surfaces
- **Opacity control** — fully opaque by default, adjustable per bar
- **Click-through toggle** — optionally make bars pass mouse events to windows beneath
- **Keyboard shortcuts** — quick-create, hide all, show all, delete focused bar
- **System tray** — minimize to tray, quick access to common actions
- **Lightweight** — minimal CPU and memory footprint

## Quick Start

### Prerequisites

- [Rust](https://rustup.rs/) (1.70+)
- [Node.js](https://nodejs.org/) (18+)
- Platform dependencies for Tauri: see [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/)

### Development

```bash
# Install frontend dependencies
npm install

# Run in development mode (hot reload)
npm run tauri dev
```

### Build

```bash
# Build optimized release
npm run tauri build
```

Installers are output to `src-tauri/target/release/bundle/`.

## Usage

1. Launch Censor Bars
2. Click **"New Bar"** or press `Ctrl+N` to create a censor bar
3. **Drag** to reposition, **resize** from edges/corners
4. **Right-click** any bar for options: color, gradient, animation, image, opacity, delete
5. Use the **system tray** to hide/show all bars or quit

## Architecture

```
src-tauri/         Rust backend (Tauri commands, window management, state)
src/               Frontend (vanilla HTML/CSS/JS — lightweight, no framework)
tests/             Unit, integration, and E2E tests
docs/              Design docs, API reference, user guide
scripts/           Build and dev utility scripts
.github/           CI/CD workflows and issue templates
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT — see [LICENSE](LICENSE) for details.
