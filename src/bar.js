/**
 * Bar overlay — runs in each censor bar window.
 * Handles rendering, selection, group movement, right-click context menu,
 * animations, drag undo batching, gradient orientation, and keyboard shortcuts.
 *
 * Click-through passthrough mode: when enabled globally from the panel,
 * all bar windows have cursor events disabled. ALT+click temporarily
 * re-enables interaction for that bar.
 */

const { invoke } = window.__TAURI__.core;
const { getCurrentWindow } = window.__TAURI__.window;

// --- Block ALL default browser context menus globally ---
document.addEventListener("contextmenu", (e) => {
  e.preventDefault();
});

// --- Block double-click maximize ---
document.addEventListener("dblclick", (e) => {
  e.preventDefault();
});

// --- Parse bar ID from URL ---
const params = new URLSearchParams(window.location.search);
const barId = params.get("id");
const thisWindow = getCurrentWindow();

// --- DOM ---
const surface = document.getElementById("censor-surface");
const contextMenu = document.getElementById("context-menu");
const colorGrid = document.getElementById("color-grid");
const gradientGrid = document.getElementById("gradient-grid");
const gradientAngle = document.getElementById("gradient-angle");
const gradientAngleValue = document.getElementById("gradient-angle-value");
const animationList = document.getElementById("animation-list");
const opacitySlider = document.getElementById("opacity-slider");
const btnCloseBar = document.getElementById("btn-close-bar");

// --- State ---
let isSelected = false;
let currentGroupId = null;
let groupBadgeEl = null;
let currentGradientAngle = 135; // degrees — default diagonal

// --- Drag state (for undo batching) ---
let isDragging = false;
let dragStartPositions = []; // [{barId, x, y}] — positions at mousedown

// --- Resize state (for undo batching) ---
let initialWidth = 0;
let initialHeight = 0;

// --- Color Palette ---
const COLORS = [
  { name: "Pure Black", value: "#000000" },
  { name: "Midnight", value: "#1a1a2e" },
  { name: "Deep Navy", value: "#16213e" },
  { name: "Charcoal", value: "#2d2d2d" },
  { name: "Slate", value: "#4a5568" },
  { name: "Storm", value: "#718096" },
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

// --- Gradient Presets (stored as color stops, angle applied dynamically) ---
const GRADIENTS = [
  { name: "Ocean", stops: "#667eea 0%, #764ba2 100%" },
  { name: "Sunset", stops: "#f093fb 0%, #f5576c 100%" },
  { name: "Forest", stops: "#11998e 0%, #38ef7d 100%" },
  { name: "Midnight", stops: "#0f0c29 0%, #302b63 50%, #24243e 100%" },
  { name: "Lava", stops: "#f12711 0%, #f5af19 100%" },
  { name: "Arctic", stops: "#e0eafc 0%, #cfdef3 100%" },
  { name: "Cosmos", stops: "#1a002e 0%, #0d001a 50%, #000000 100%", radial: true },
  { name: "Neon", stops: "#00f260 0%, #0575e6 100%" },
];

// Current gradient state (for re-applying when angle changes)
let currentGradientStops = null;
let currentGradientIsRadial = false;

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

// --- Build Gradient CSS from stops + angle ---
function buildGradientCss(stops, angle, isRadial) {
  if (isRadial) {
    return `radial-gradient(ellipse at center, ${stops})`;
  }
  return `linear-gradient(${angle}deg, ${stops})`;
}

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
    (g, i) => {
      const css = buildGradientCss(g.stops, currentGradientAngle, g.radial);
      return `<button class="gradient-swatch" data-gradient-idx="${i}" title="${g.name}" style="background:${css}"></button>`;
    }
  ).join("");

  gradientGrid.querySelectorAll(".gradient-swatch").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.gradientIdx);
      const g = GRADIENTS[idx];
      currentGradientStops = g.stops;
      currentGradientIsRadial = !!g.radial;
      const css = buildGradientCss(g.stops, currentGradientAngle, g.radial);
      applyStyle({ kind: "gradient", css });
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
      currentGradientStops = null; // Clear gradient state
      hideContextMenu();
    });
  });
}

// --- Gradient Angle Knob ---
if (gradientAngle) {
  gradientAngle.addEventListener("input", (e) => {
    currentGradientAngle = parseInt(e.target.value);
    if (gradientAngleValue) {
      gradientAngleValue.textContent = `${currentGradientAngle}°`;
    }
    // Update gradient swatches preview
    gradientGrid.querySelectorAll(".gradient-swatch").forEach((btn) => {
      const idx = parseInt(btn.dataset.gradientIdx);
      const g = GRADIENTS[idx];
      btn.style.background = buildGradientCss(g.stops, currentGradientAngle, g.radial);
    });
    // If current bar has a gradient, update it live
    if (currentGradientStops) {
      const css = buildGradientCss(currentGradientStops, currentGradientAngle, currentGradientIsRadial);
      surface.style.background = css;
    }
  });

  gradientAngle.addEventListener("change", (e) => {
    // On release, persist the gradient with new angle
    if (currentGradientStops) {
      const css = buildGradientCss(currentGradientStops, currentGradientAngle, currentGradientIsRadial);
      invoke("update_bar_style", { payload: { barId, style: { kind: "gradient", css } } }).catch(console.error);
    }
  });
}

// --- Style Application ---
function applyStyleVisual(style) {
  stopAnimation();
  switch (style.kind) {
    case "solid":
      surface.style.background = style.color;
      currentGradientStops = null;
      break;
    case "gradient":
      surface.style.background = style.css;
      // Try to parse the gradient stops for angle control
      parseGradientForAngle(style.css);
      break;
    case "animation":
      startAnimation(style.preset);
      currentGradientStops = null;
      break;
    case "image":
      surface.style.background = `url(${style.path}) center/${style.fit || "cover"} no-repeat`;
      currentGradientStops = null;
      break;
  }
}

// Extract stops from a CSS gradient string for angle re-application
function parseGradientForAngle(css) {
  const linearMatch = css.match(/linear-gradient\((\d+)deg,\s*(.+)\)/);
  if (linearMatch) {
    currentGradientAngle = parseInt(linearMatch[1]);
    currentGradientStops = linearMatch[2];
    currentGradientIsRadial = false;
    if (gradientAngle) gradientAngle.value = currentGradientAngle;
    if (gradientAngleValue) gradientAngleValue.textContent = `${currentGradientAngle}°`;
  } else if (css.includes("radial-gradient")) {
    currentGradientIsRadial = true;
    const radialMatch = css.match(/radial-gradient\([^,]+,\s*(.+)\)/);
    if (radialMatch) currentGradientStops = radialMatch[1];
  } else {
    currentGradientStops = null;
  }
}

function applyStyle(style) {
  applyStyleVisual(style);
  invoke("update_bar_style", { payload: { barId, style } }).catch(console.error);
}

// Exposed globally for backend-driven style updates
window.__applyStyle = function (style) {
  applyStyleVisual(style);
};

window.__setOpacity = function (opacity) {
  surface.style.opacity = opacity;
  opacitySlider.value = Math.round(opacity * 100);
};

// --- Selection ---
window.__setSelected = function (selected) {
  isSelected = selected;
  surface.classList.toggle("selected", selected);
};

window.__setGroupId = function (gid) {
  currentGroupId = gid;
  updateGroupBadge();
};

function updateGroupBadge() {
  if (!groupBadgeEl) {
    groupBadgeEl = document.createElement("div");
    groupBadgeEl.className = "group-badge-overlay";
    surface.appendChild(groupBadgeEl);
  }
  if (currentGroupId !== null && currentGroupId !== undefined) {
    const displayNum = currentGroupId === 0 ? 10 : currentGroupId;
    groupBadgeEl.textContent = `G${displayNum}`;
    groupBadgeEl.style.display = "block";
  } else {
    groupBadgeEl.style.display = "none";
  }
}

// --- Click handling: selection + drag ---
surface.addEventListener("mousedown", async (e) => {
  if (e.button !== 0) return; // Only left click

  if (e.ctrlKey) {
    // Toggle selection
    isSelected = !isSelected;
    surface.classList.toggle("selected", isSelected);
    e.preventDefault();
    return;
  }

  // Normal click: select only this bar
  isSelected = true;
  surface.classList.add("selected");

  // Capture drag start positions for undo batching
  isDragging = true;
  try {
    const pos = await thisWindow.outerPosition();
    dragStartPositions = [{ barId, x: pos.x, y: pos.y }];

    // If we're in a group, get positions of all group bars
    if (currentGroupId !== null) {
      const groupBars = await invoke("get_group_bars", { groupId: currentGroupId });
      dragStartPositions = [];
      for (const bar of groupBars) {
        dragStartPositions.push({ barId: bar.id, x: bar.x, y: bar.y });
      }
    }
  } catch (err) {
    console.error("Failed to capture drag start:", err);
  }

  // Initiate Tauri window drag
  try {
    await thisWindow.startDragging();
  } catch (err) {
    // startDragging can throw if released immediately — that's fine
  }

  // After drag completes (startDragging resolves when mouse is released),
  // record the move for undo
  if (isDragging && dragStartPositions.length > 0) {
    isDragging = false;
    try {
      const pos = await thisWindow.outerPosition();
      const startPos = dragStartPositions.find((p) => p.barId === barId);
      if (startPos) {
        const dx = pos.x - startPos.x;
        const dy = pos.y - startPos.y;

        // Only record if actually moved
        if (Math.abs(dx) >= 2 || Math.abs(dy) >= 2) {
          const moves = dragStartPositions.map((sp) => ({
            barId: sp.barId,
            oldX: sp.x,
            oldY: sp.y,
            newX: sp.x + dx,
            newY: sp.y + dy,
          }));
          await invoke("record_move", { moves });
        }
      }
    } catch (err) {
      console.error("Failed to record move:", err);
    }
  }
});

// --- Track resize for undo ---
async function captureSize() {
  try {
    const size = await thisWindow.innerSize();
    initialWidth = size.width;
    initialHeight = size.height;
  } catch (err) {
    // Ignore
  }
}

// Check for resize on focus loss (resize end)
thisWindow.onResized(async (size) => {
  if (initialWidth > 0 && initialHeight > 0) {
    const newW = size.payload.width;
    const newH = size.payload.height;
    if (Math.abs(newW - initialWidth) > 2 || Math.abs(newH - initialHeight) > 2) {
      try {
        await invoke("record_resize", {
          barId,
          oldWidth: initialWidth,
          oldHeight: initialHeight,
          newWidth: newW,
          newHeight: newH,
        });
      } catch (err) {
        console.error("Failed to record resize:", err);
      }
    }
  }
  initialWidth = size.payload.width;
  initialHeight = size.payload.height;
});

// Capture initial size
captureSize();

// --- Animation Engine ---
function stopAnimation() {
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
  if (cls) surface.classList.add(cls);
}

// --- Context Menu ---
function showContextMenu(x, y) {
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;
  contextMenu.classList.remove("hidden");

  // Keep menu in viewport
  requestAnimationFrame(() => {
    const rect = contextMenu.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (rect.right > vw) contextMenu.style.left = `${vw - rect.width - 4}px`;
    if (rect.bottom > vh) contextMenu.style.top = `${vh - rect.height - 4}px`;
  });
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
});

opacitySlider.addEventListener("change", (e) => {
  const opacity = parseInt(e.target.value) / 100;
  invoke("set_bar_opacity", { barId, opacity }).catch(console.error);
});

// --- Close Button ---
btnCloseBar.addEventListener("click", () => {
  invoke("close_bar", { barId }).catch(console.error);
});

// --- Keyboard Shortcuts (bar-level) ---
document.addEventListener("keydown", async (e) => {
  // Del: Delete this bar (or group)
  if (e.key === "Delete" && isSelected) {
    e.preventDefault();
    try {
      await invoke("delete_bars", { barIds: [barId] });
    } catch (err) {
      console.error("Delete failed:", err);
    }
    return;
  }

  // Ctrl+N: New bar
  if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === "n") {
    e.preventDefault();
    invoke("create_bar").catch(console.error);
    return;
  }

  // Ctrl+Alt+Z: Undo
  if (e.ctrlKey && e.altKey && (e.key === "z" || e.key === "Z")) {
    e.preventDefault();
    invoke("undo").catch(console.error);
    return;
  }

  // Ctrl+Alt+Y: Redo
  if (e.ctrlKey && e.altKey && (e.key === "y" || e.key === "Y")) {
    e.preventDefault();
    invoke("redo").catch(console.error);
    return;
  }

  // Ctrl+1-0: Group selected bar(s)
  if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key >= "0" && e.key <= "9") {
    if (!isSelected) return;
    e.preventDefault();
    const groupId = parseInt(e.key);
    try {
      await invoke("group_bars", { barIds: [barId], groupId });
      currentGroupId = groupId;
      updateGroupBadge();
    } catch (err) {
      console.error("Group failed:", err);
    }
    return;
  }

  // Ctrl+Shift+1-0: Ungroup
  if (e.ctrlKey && e.shiftKey && !e.altKey && e.key >= "0" && e.key <= "9") {
    e.preventDefault();
    const groupId = parseInt(e.key);
    try {
      await invoke("ungroup_bars", { groupId });
      if (currentGroupId === groupId) {
        currentGroupId = null;
        updateGroupBadge();
      }
    } catch (err) {
      console.error("Ungroup failed:", err);
    }
    return;
  }
});

// --- Load bar state from backend ---
async function loadBarState() {
  try {
    const bars = await invoke("list_bars");
    const bar = bars.find((b) => b.id === barId);
    if (bar) {
      applyStyleVisual(bar.style);
      surface.style.opacity = bar.opacity;
      opacitySlider.value = Math.round(bar.opacity * 100);
      currentGroupId = bar.groupId ?? null;
      updateGroupBadge();
    }
  } catch (err) {
    console.error("Failed to load bar state:", err);
  }
}

// --- Init ---
buildColorGrid();
buildGradientGrid();
buildAnimationList();
loadBarState();
