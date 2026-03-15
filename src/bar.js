/**
 * Bar overlay — runs in each censor bar window.
 * Handles rendering, right-click context menu, animations, and style updates.
 */

const { invoke } = window.__TAURI__.core;

// --- Parse bar ID from URL ---
const params = new URLSearchParams(window.location.search);
const barId = params.get("id");

// --- DOM ---
const surface = document.getElementById("censor-surface");
const contextMenu = document.getElementById("context-menu");
const colorGrid = document.getElementById("color-grid");
const gradientGrid = document.getElementById("gradient-grid");
const animationList = document.getElementById("animation-list");
const opacitySlider = document.getElementById("opacity-slider");
const btnCloseBar = document.getElementById("btn-close-bar");

// --- Color Palette ---
const COLORS = [
  { name: "Midnight", value: "#1a1a2e" },
  { name: "Deep Navy", value: "#16213e" },
  { name: "Charcoal", value: "#2d2d2d" },
  { name: "Slate", value: "#4a5568" },
  { name: "Storm", value: "#718096" },
  { name: "Pure Black", value: "#000000" },
  { name: "Crimson", value: "#dc2626" },
  { name: "Emerald", value: "#059669" },
  { name: "Royal Blue", value: "#2563eb" },
  { name: "Amber", value: "#d97706" },
  { name: "Violet", value: "#7c3aed" },
  { name: "Rose", value: "#e11d48" },
  { name: "Teal", value: "#0d9488" },
  { name: "Indigo", value: "#4f46e5" },
  { name: "Fuchsia", value: "#c026d3" },
  { name: "Pure White", value: "#ffffff" },
];

// --- Gradient Presets ---
const GRADIENTS = [
  { name: "Ocean", css: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" },
  { name: "Sunset", css: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" },
  { name: "Forest", css: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)" },
  { name: "Midnight", css: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)" },
  { name: "Lava", css: "linear-gradient(135deg, #f12711 0%, #f5af19 100%)" },
  { name: "Arctic", css: "linear-gradient(135deg, #e0eafc 0%, #cfdef3 100%)" },
  { name: "Cosmos", css: "radial-gradient(ellipse at center, #1a002e 0%, #0d001a 50%, #000000 100%)" },
  { name: "Neon", css: "linear-gradient(135deg, #00f260 0%, #0575e6 100%)" },
];

// --- Animation Presets ---
const ANIMATIONS = [
  { name: "Ocean Wave", preset: "oceanWave", mood: "relaxing" },
  { name: "Breathing", preset: "breathing", mood: "relaxing" },
  { name: "Sunset Drift", preset: "sunsetDrift", mood: "relaxing" },
  { name: "Aurora", preset: "aurora", mood: "relaxing" },
  { name: "Neon Pulse", preset: "neonPulse", mood: "energetic" },
  { name: "Rainbow Sweep", preset: "rainbowSweep", mood: "energetic" },
  { name: "Digital Rain", preset: "digitalRain", mood: "energetic" },
  { name: "Lava Flow", preset: "lavaFlow", mood: "relaxing" },
];

// --- Current animation frame ---
let currentAnimationFrame = null;

// --- Build context menu ---
function buildColorGrid() {
  colorGrid.innerHTML = COLORS.map(
    (c) =>
      `<button class="color-swatch" data-color="${c.value}" title="${c.name}" style="background:${c.value}"></button>`
  ).join("");

  colorGrid.querySelectorAll(".color-swatch").forEach((btn) => {
    btn.addEventListener("click", () => {
      applyStyle({ kind: "solid", color: btn.dataset.color });
      hideContextMenu();
    });
  });
}

function buildGradientGrid() {
  gradientGrid.innerHTML = GRADIENTS.map(
    (g) =>
      `<button class="gradient-swatch" data-css="${g.css}" title="${g.name}" style="background:${g.css}"></button>`
  ).join("");

  gradientGrid.querySelectorAll(".gradient-swatch").forEach((btn) => {
    btn.addEventListener("click", () => {
      applyStyle({ kind: "gradient", css: btn.dataset.css });
      hideContextMenu();
    });
  });
}

function buildAnimationList() {
  animationList.innerHTML = ANIMATIONS.map(
    (a) =>
      `<button class="animation-option" data-preset="${a.preset}">
        <span class="animation-name">${a.name}</span>
        <span class="animation-mood ${a.mood}">${a.mood}</span>
      </button>`
  ).join("");

  animationList.querySelectorAll(".animation-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      applyStyle({ kind: "animation", preset: btn.dataset.preset });
      hideContextMenu();
    });
  });
}

// --- Style Application ---
function applyStyle(style) {
  stopAnimation();

  switch (style.kind) {
    case "solid":
      surface.style.background = style.color;
      break;
    case "gradient":
      surface.style.background = style.css;
      break;
    case "animation":
      startAnimation(style.preset);
      break;
    case "image":
      surface.style.background = `url(${style.path}) center/${style.fit || "cover"} no-repeat`;
      break;
  }

  // Sync to backend
  invoke("update_bar_style", {
    payload: { barId, style },
  }).catch(console.error);
}

// Exposed globally for backend-driven style updates
window.__applyStyle = function (style) {
  applyStyle(style);
};

window.__setOpacity = function (opacity) {
  surface.style.opacity = opacity;
  opacitySlider.value = Math.round(opacity * 100);
};

// --- Animation Engine ---
function stopAnimation() {
  if (currentAnimationFrame) {
    cancelAnimationFrame(currentAnimationFrame);
    currentAnimationFrame = null;
  }
  surface.classList.remove(
    "anim-ocean-wave",
    "anim-breathing",
    "anim-sunset-drift",
    "anim-aurora",
    "anim-neon-pulse",
    "anim-rainbow-sweep",
    "anim-digital-rain",
    "anim-lava-flow"
  );
}

function startAnimation(preset) {
  // CSS class-based animations
  const classMap = {
    oceanWave: "anim-ocean-wave",
    breathing: "anim-breathing",
    sunsetDrift: "anim-sunset-drift",
    aurora: "anim-aurora",
    neonPulse: "anim-neon-pulse",
    rainbowSweep: "anim-rainbow-sweep",
    digitalRain: "anim-digital-rain",
    lavaFlow: "anim-lava-flow",
  };

  const cls = classMap[preset];
  if (cls) {
    surface.classList.add(cls);
  }
}

// --- Context Menu ---
function showContextMenu(x, y) {
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;
  contextMenu.classList.remove("hidden");
}

function hideContextMenu() {
  contextMenu.classList.add("hidden");
}

surface.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  showContextMenu(e.clientX, e.clientY);
});

document.addEventListener("click", (e) => {
  if (!contextMenu.contains(e.target)) {
    hideContextMenu();
  }
});

// --- Opacity Slider ---
opacitySlider.addEventListener("input", (e) => {
  const opacity = parseInt(e.target.value) / 100;
  surface.style.opacity = opacity;
  invoke("set_bar_opacity", { barId, opacity }).catch(console.error);
});

// --- Close Button ---
btnCloseBar.addEventListener("click", () => {
  invoke("close_bar", { barId }).catch(console.error);
});

// --- Init ---
buildColorGrid();
buildGradientGrid();
buildAnimationList();

// Default style
surface.style.background = "#1a1a2e";
