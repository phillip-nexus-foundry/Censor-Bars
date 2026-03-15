/**
 * Bar overlay — runs in each censor bar window.
 * Handles rendering, selection, group movement, right-click context menu,
 * animations, drag undo batching, and keyboard shortcuts.
 */

const { invoke } = window.__TAURI__.core;
const { getCurrentWindow } = window.__TAURI__.window;

// --- Parse bar ID from URL ---
const params = new URLSearchParams(window.location.search);
const barId = params.get("id");
const thisWindow = getCurrentWindow();

// --- DOM ---
const surface = document.getElementById("censor-surface");
const contextMenu = document.getElementById("context-menu");
const colorGrid = document.getElementById("color-grid");
const gradientGrid = document.getElementById("gradient-grid");
const animationList = document.getElementById("animation-list");
const opacitySlider = document.getElementById("opacity-slider");
const btnCloseBar = document.getElementById("btn-close-bar");

// --- State ---
let isSelected = false;
let currentGroupId = null;
let groupBadgeEl = null;

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
function applyStyleVisual(style) {
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

// --- Click handling: selection ---
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

  // Track drag start for undo batching
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
});

// --- Record drag end for undo ---
surface.addEventListener("mouseup", async () => {
  if (!isDragging || dragStartPositions.length === 0) {
    isDragging = false;
    return;
  }
  isDragging = false;

  try {
    const pos = await thisWindow.outerPosition();
    const startPos = dragStartPositions.find((p) => p.barId === barId);
    if (!startPos) return;

    const dx = pos.x - startPos.x;
    const dy = pos.y - startPos.y;

    // Only record if actually moved
    if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;

    const moves = dragStartPositions.map((sp) => ({
      barId: sp.barId,
      oldX: sp.x,
      oldY: sp.y,
      newX: sp.x + dx,
      newY: sp.y + dy,
    }));

    await invoke("record_move", { moves });
  } catch (err) {
    console.error("Failed to record move:", err);
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
    const groupId = parseInt(e.key); // 0-9, where 0 = group 10
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
