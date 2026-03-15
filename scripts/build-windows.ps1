# build-windows.ps1 — Build Censor Bars for Windows
# Run from the project root: .\scripts\build-windows.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== Censor Bars — Windows Build ===" -ForegroundColor Cyan

# Verify prerequisites
Write-Host "Checking prerequisites..." -ForegroundColor Yellow
$rustc = rustc --version 2>$null
if (-not $rustc) { Write-Error "Rust not found. Install via: winget install Rustlang.Rustup"; exit 1 }
Write-Host "  Rust: $rustc" -ForegroundColor Green

$node = node --version 2>$null
if (-not $node) { Write-Error "Node.js not found. Install via: winget install OpenJS.NodeJS.LTS"; exit 1 }
Write-Host "  Node: $node" -ForegroundColor Green

$tauriVersion = cargo tauri --version 2>$null
if (-not $tauriVersion) {
    Write-Host "  Installing cargo-tauri..." -ForegroundColor Yellow
    cargo install tauri-cli
}
Write-Host "  Tauri CLI: $(cargo tauri --version)" -ForegroundColor Green

# Install frontend dependencies
Write-Host "`nInstalling frontend dependencies..." -ForegroundColor Yellow
npm install

# Build
Write-Host "`nBuilding Censor Bars..." -ForegroundColor Yellow
cargo tauri build

Write-Host "`n=== Build Complete ===" -ForegroundColor Green
Write-Host "Installers at: src-tauri\target\release\bundle\" -ForegroundColor Cyan
