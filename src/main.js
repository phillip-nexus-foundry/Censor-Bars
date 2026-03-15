/**
 * Control Panel — main entry point.
 * Manages the list of active censor bars and global actions.
 */

const { invoke } = window.__TAURI__.core;

// --- DOM Elements ---
const btnNewBar = document.getElementById("btn-new-bar");
const btnHideAll = document.getElementById("btn-hide-all");
const btnShowAll = document.getElementById("btn-show-all");
const btnCloseAll = document.getElementById("btn-close-all");
const barListEl = document.getElementById("bar-list");

// --- State ---
let bars = [];

// --- Actions ---
async function createBar() {
  try {
    const bar = await invoke("create_bar");
    bars.push(bar);
    renderBarList();
  } catch (err) {
    console.error("Failed to create bar:", err);
  }
}

async function closeBar(barId) {
  try {
    await invoke("close_bar", { barId });
    bars = bars.filter((b) => b.id !== barId);
    renderBarList();
  } catch (err) {
    console.error("Failed to close bar:", err);
  }
}

async function closeAllBars() {
  try {
    await invoke("close_all_bars");
    bars = [];
    renderBarList();
  } catch (err) {
    console.error("Failed to close all bars:", err);
  }
}

async function refreshBarList() {
  try {
    bars = await invoke("list_bars");
    renderBarList();
  } catch (err) {
    console.error("Failed to list bars:", err);
  }
}

// --- Rendering ---
function renderBarList() {
  if (bars.length === 0) {
    barListEl.innerHTML =
      '<p class="bar-list-empty">No active bars. Click "New Bar" to start.</p>';
    return;
  }

  barListEl.innerHTML = bars
    .map(
      (bar) => `
    <div class="bar-item" data-id="${bar.id}">
      <div class="bar-item-preview" style="${getPreviewStyle(bar.style)}"></div>
      <div class="bar-item-info">
        <span class="bar-item-label">${bar.label}</span>
        <span class="bar-item-meta">${describeStyle(bar.style)}</span>
      </div>
      <button class="bar-item-close" data-close-id="${bar.id}" title="Close bar">&times;</button>
    </div>
  `
    )
    .join("");

  // Attach close listeners
  barListEl.querySelectorAll("[data-close-id]").forEach((btn) => {
    btn.addEventListener("click", () => closeBar(btn.dataset.closeId));
  });
}

function getPreviewStyle(style) {
  switch (style.kind) {
    case "solid":
      return `background: ${style.color}`;
    case "gradient":
      return `background: ${style.css}`;
    case "animation":
      return `background: #667eea`;
    case "image":
      return `background: url(${style.path}) center/cover`;
    default:
      return `background: #1a1a2e`;
  }
}

function describeStyle(style) {
  switch (style.kind) {
    case "solid":
      return `Solid ${style.color}`;
    case "gradient":
      return "Gradient";
    case "animation":
      return `Animation: ${style.preset}`;
    case "image":
      return "Image";
    default:
      return "Default";
  }
}

// --- Keyboard Shortcuts ---
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "n") {
    e.preventDefault();
    createBar();
  }
  if (e.ctrlKey && e.shiftKey && e.key === "H") {
    e.preventDefault();
    // Show all — future implementation
  }
  if (e.ctrlKey && !e.shiftKey && e.key === "h") {
    e.preventDefault();
    // Hide all — future implementation
  }
});

// --- Init ---
btnNewBar.addEventListener("click", createBar);
btnCloseAll.addEventListener("click", closeAllBars);
btnHideAll.addEventListener("click", () => {
  /* TODO: hide all bar windows */
});
btnShowAll.addEventListener("click", () => {
  /* TODO: show all bar windows */
});

refreshBarList();
