/**
 * Control Panel — Handy-style floating panel.
 * Manages bar list, groups, undo/redo, theme toggle,
 * click-through passthrough mode, and tray behavior.
 */

const { invoke } = window.__TAURI__.core;
const { getCurrentWindow } = window.__TAURI__.window;

// --- DOM ---
const btnNewBar = document.getElementById("btn-new-bar");
const btnMinimize = document.getElementById("btn-minimize");
const btnClose = document.getElementById("btn-close");
const btnUndo = document.getElementById("btn-undo");
const btnRedo = document.getElementById("btn-redo");
const btnPassthrough = document.getElementById("btn-passthrough");
const btnThemeToggle = document.getElementById("btn-theme-toggle");
const iconSun = document.getElementById("icon-sun");
const iconMoon = document.getElementById("icon-moon");
const historyStatus = document.getElementById("history-status");
const barListEl = document.getElementById("bar-list");

// --- State ---
let bars = [];
let groups = [];
let passthroughActive = false;
let currentTheme = localStorage.getItem("censor-bars-theme") || "dark";

// --- Window behavior: close to tray ---
const appWindow = getCurrentWindow();

btnClose.addEventListener("click", () => {
  appWindow.hide();
});

btnMinimize.addEventListener("click", () => {
  appWindow.hide();
});

// --- Theme Toggle ---
function applyTheme(theme) {
  currentTheme = theme;
  if (theme === "light") {
    document.documentElement.setAttribute("data-theme", "light");
    iconSun.style.display = "none";
    iconMoon.style.display = "block";
  } else {
    document.documentElement.removeAttribute("data-theme");
    iconSun.style.display = "block";
    iconMoon.style.display = "none";
  }
  localStorage.setItem("censor-bars-theme", theme);
}

btnThemeToggle.addEventListener("click", () => {
  applyTheme(currentTheme === "dark" ? "light" : "dark");
});

// Apply saved theme on load
applyTheme(currentTheme);

// --- Click-Through Passthrough Mode ---
async function togglePassthrough() {
  passthroughActive = !passthroughActive;
  btnPassthrough.classList.toggle("active", passthroughActive);

  try {
    await invoke("set_all_click_through", { enabled: passthroughActive });
  } catch (err) {
    console.error("Failed to toggle passthrough:", err);
    // Revert UI on failure
    passthroughActive = !passthroughActive;
    btnPassthrough.classList.toggle("active", passthroughActive);
  }
}

btnPassthrough.addEventListener("click", togglePassthrough);

// --- Create bar ---
async function createBar() {
  try {
    const bar = await invoke("create_bar");
    await refreshAll();
  } catch (err) {
    console.error("Failed to create bar:", err);
  }
}

// --- Delete bar(s) ---
async function deleteBarById(barId) {
  try {
    await invoke("delete_bars", { barIds: [barId] });
    await refreshAll();
  } catch (err) {
    console.error("Failed to delete bar:", err);
  }
}

// --- Undo / Redo ---
async function undo() {
  try {
    await invoke("undo");
    await refreshAll();
  } catch (err) {
    console.error("Undo failed:", err);
  }
}

async function redo() {
  try {
    await invoke("redo");
    await refreshAll();
  } catch (err) {
    console.error("Redo failed:", err);
  }
}

async function updateHistoryButtons() {
  try {
    const [undoCount, redoCount] = await invoke("history_status");
    btnUndo.disabled = undoCount === 0;
    btnRedo.disabled = redoCount === 0;
    if (undoCount > 0 || redoCount > 0) {
      historyStatus.textContent = `${undoCount} undo · ${redoCount} redo`;
    } else {
      historyStatus.textContent = "";
    }
  } catch (err) {
    console.error("Failed to get history status:", err);
  }
}

// --- Rename group ---
async function renameGroup(groupId, newName) {
  try {
    await invoke("rename_group", { groupId, newName });
  } catch (err) {
    console.error("Failed to rename group:", err);
  }
}

// --- Refresh everything ---
async function refreshAll() {
  try {
    [bars, groups] = await Promise.all([
      invoke("list_bars"),
      invoke("list_groups"),
    ]);
    renderBarList();
    updateHistoryButtons();
  } catch (err) {
    console.error("Refresh failed:", err);
  }
}

// --- Rendering ---
function getSwatchStyle(style) {
  if (!style) return "background: #000";
  switch (style.kind) {
    case "solid":
      return `background: ${style.color}`;
    case "gradient":
      return `background: ${style.css}`;
    case "animation":
      return "background: linear-gradient(135deg, #667eea, #764ba2)";
    case "image":
      return "background: #555";
    default:
      return "background: #000";
  }
}

function renderBarList() {
  if (bars.length === 0) {
    barListEl.innerHTML =
      '<p class="bar-list-empty">No active bars.<br>Click <strong>New Bar</strong> or press <kbd>Ctrl+N</kbd></p>';
    return;
  }

  let html = "";

  // Build grouped and ungrouped
  const groupedBarIds = new Set();

  // Render groups
  for (const group of groups) {
    const groupBars = bars.filter((b) => b.groupId === group.id);
    if (groupBars.length === 0) continue;

    groupBars.forEach((b) => groupedBarIds.add(b.id));

    const displayNum = group.id === 0 ? 10 : group.id;

    html += `
      <div class="group-section" data-group-id="${group.id}">
        <div class="group-header" data-group-toggle="${group.id}">
          <span class="group-chevron" data-chevron="${group.id}">▼</span>
          <input class="group-name-input" type="text" value="${escHtml(group.name)}"
                 data-rename-group="${group.id}"
                 onclick="event.stopPropagation()" />
          <span class="group-badge">Ctrl+${displayNum === 10 ? "0" : displayNum}</span>
          <button class="group-delete" data-delete-group="${group.id}" title="Delete group">&times;</button>
        </div>
        <div class="group-bars" data-group-bars="${group.id}">
          ${groupBars.map((b) => renderBarItem(b)).join("")}
        </div>
      </div>
    `;
  }

  // Render ungrouped bars
  const ungrouped = bars.filter((b) => !groupedBarIds.has(b.id));
  for (const bar of ungrouped) {
    html += renderBarItem(bar);
  }

  barListEl.innerHTML = html;

  // Attach event listeners
  attachListeners();
}

function renderBarItem(bar) {
  const shortId = bar.id.substring(0, 8);
  return `
    <div class="bar-item" data-bar-id="${bar.id}">
      <div class="bar-item-swatch" style="${getSwatchStyle(bar.style)}"></div>
      <span class="bar-item-label" title="${bar.label}">${shortId}</span>
      <button class="bar-item-delete" data-delete-bar="${bar.id}">&times;</button>
    </div>
  `;
}

function escHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function attachListeners() {
  // Bar delete buttons
  barListEl.querySelectorAll("[data-delete-bar]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteBarById(btn.dataset.deleteBar);
    });
  });

  // Group toggles (collapse/expand)
  barListEl.querySelectorAll("[data-group-toggle]").forEach((header) => {
    header.addEventListener("click", () => {
      const gid = header.dataset.groupToggle;
      const barsEl = barListEl.querySelector(`[data-group-bars="${gid}"]`);
      const chevron = barListEl.querySelector(`[data-chevron="${gid}"]`);
      if (barsEl && chevron) {
        barsEl.classList.toggle("collapsed");
        chevron.classList.toggle("collapsed");
      }
    });
  });

  // Group rename inputs
  barListEl.querySelectorAll("[data-rename-group]").forEach((input) => {
    input.addEventListener("change", () => {
      const gid = parseInt(input.dataset.renameGroup);
      renameGroup(gid, input.value.trim() || `Group ${gid}`);
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.target.blur();
      }
    });
  });

  // Group delete buttons
  barListEl.querySelectorAll("[data-delete-group]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const gid = parseInt(btn.dataset.deleteGroup);
      const groupBars = bars.filter((b) => b.groupId === gid);
      if (groupBars.length > 0) {
        try {
          await invoke("delete_bars", {
            barIds: groupBars.map((b) => b.id),
          });
          await refreshAll();
        } catch (err) {
          console.error("Failed to delete group:", err);
        }
      }
    });
  });
}

// --- Keyboard Shortcuts (panel-level) ---
document.addEventListener("keydown", (e) => {
  // Ctrl+N: New bar
  if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === "n") {
    e.preventDefault();
    createBar();
    return;
  }

  // Alt+P: Toggle passthrough mode
  if (e.altKey && !e.ctrlKey && !e.shiftKey && (e.key === "p" || e.key === "P")) {
    e.preventDefault();
    togglePassthrough();
    return;
  }

  // Ctrl+Alt+Z: Undo
  if (e.ctrlKey && e.altKey && (e.key === "z" || e.key === "Z")) {
    e.preventDefault();
    undo();
    return;
  }

  // Ctrl+Alt+Y: Redo
  if (e.ctrlKey && e.altKey && (e.key === "y" || e.key === "Y")) {
    e.preventDefault();
    redo();
    return;
  }
});

// --- Button listeners ---
btnNewBar.addEventListener("click", createBar);
btnUndo.addEventListener("click", undo);
btnRedo.addEventListener("click", redo);

// --- Init: restore persisted state ---
async function init() {
  try {
    const count = await invoke("restore_state");
    if (count > 0) {
      console.log(`Restored ${count} bars from previous session`);
    }
  } catch (err) {
    console.error("Failed to restore state:", err);
  }
  await refreshAll();
}

init();

// --- Periodic refresh (catch external bar changes) ---
setInterval(refreshAll, 2000);
