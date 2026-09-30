import { app, BrowserWindow, ipcMain, screen, globalShortcut, dialog, shell, Tray, Menu, nativeImage, Display } from 'electron';
import { execFile } from 'child_process';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';

const ASSETS = path.join(app.getAppPath(), 'public');
const CROSSHAIRS_DIR = path.join(ASSETS, 'crosshairs');
const TRAY_ICON = path.join(app.getAppPath(), 'assets', 'icon.png');
const CONFIG_FILE = path.join(app.getPath('userData'), 'config.json');
const OVERLAY_TITLE = 'dilates-crosshair-overlay';

// Needed for transparent windows on some X11 setups (e.g. GNOME on Xorg)
app.commandLine.appendSwitch('enable-transparent-visuals');

type PositionMode = 'center' | 'pixel' | 'follow';

interface Profile {
  size: number;
  hue: number;
  rotation: number;
  opacity: number;
  crosshair: string;
  customDir: string | null;
  customFile: string | null;
  fillColor: string | null;
  outline: boolean;
  outlineWidth: number;
  outlineColor: string;
  glow: boolean;
  glowColor: string;
}

interface Config extends Profile {
  positionMode: PositionMode;
  x: number;
  y: number;
  displayId: number | null;
  overlayOn: boolean;
  showOnAllDisplays: boolean;
  tray: boolean;
  toggleHotkey: string;
  profiles: Record<string, Profile>;
  activeProfile: string | null;
}

interface DisplayInfo {
  id: number;
  label: string;
  width: number;
  height: number;
  x: number;
  y: number;
  isPrimary: boolean;
}

const DEFAULT_TOGGLE_HOTKEY = 'CommandOrControl+Shift+X';

const DEFAULT_CONFIG: Config = {
  size: 48,
  hue: 0,
  rotation: 0,
  opacity: 1,
  crosshair: 'cross-dot.svg',
  customDir: null,
  customFile: null,
  fillColor: null,
  outline: false,
  outlineWidth: 2,
  outlineColor: '#000000',
  glow: false,
  glowColor: '#6c8cff',
  positionMode: 'center',
  x: 0,
  y: 0,
  displayId: null,
  overlayOn: false,
  showOnAllDisplays: false,
  tray: true,
  toggleHotkey: DEFAULT_TOGGLE_HOTKEY,
  profiles: {},
  activeProfile: null,
};

// Fields captured by a profile snapshot (style + crosshair, not position/app prefs)
const PROFILE_FIELDS: (keyof Profile)[] = [
  'size', 'hue', 'rotation', 'opacity', 'crosshair', 'customDir', 'customFile',
  'fillColor', 'outline', 'outlineWidth', 'outlineColor', 'glow', 'glowColor',
];

let splashWindow: BrowserWindow | null = null;
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let followInterval: ReturnType<typeof setInterval> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let registeredToggleHotkey: string | null = null;
let config: Config = { ...DEFAULT_CONFIG };

// One overlay window per entry; displayId null => the single window that follows
// the target display (or cursor in follow mode)
interface OverlayEntry {
  win: BrowserWindow;
  displayId: number | null;
}
let overlays: OverlayEntry[] = [];

function clampSize(): number {
  return Math.max(16, Math.min(256, config.size));
}

function loadConfig(): void {
  try {
    const raw = fsSync.readFileSync(CONFIG_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    config = { ...DEFAULT_CONFIG, ...parsed };
    if (!config.profiles || typeof config.profiles !== 'object') config.profiles = {};
  } catch {
    config = { ...DEFAULT_CONFIG };
  }
}

function saveConfig(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2)).catch(() => {});
  }, 300);
}

function getCrosshairPath(): string {
  if (config.customDir && config.customFile) {
    const full = path.join(config.customDir, config.customFile);
    if (fsSync.existsSync(full)) return full;
  }
  return path.join(CROSSHAIRS_DIR, config.crosshair);
}

function getCrosshairFileUrl(): string {
  return pathToFileURL(getCrosshairPath()).href;
}

function getDisplays(): DisplayInfo[] {
  const primaryId = screen.getPrimaryDisplay().id;
  return screen.getAllDisplays().map((d: Display, i: number) => ({
    id: d.id,
    label: d.label || `Display ${i + 1}`,
    width: d.bounds.width,
    height: d.bounds.height,
    x: d.bounds.x,
    y: d.bounds.y,
    isPrimary: d.id === primaryId,
  }));
}

function getTargetDisplay(): Display {
  const displays = screen.getAllDisplays();
  return displays.find((d) => d.id === config.displayId) ?? screen.getPrimaryDisplay();
}

function broadcastConfig(): void {
  mainWindow?.webContents.send('config', config);
}

function broadcastDisplays(): void {
  mainWindow?.webContents.send('displays', getDisplays());
}

function snapshotProfile(): Profile {
  const p = {} as Profile;
  for (const key of PROFILE_FIELDS) {
    (p as unknown as Record<string, unknown>)[key] = config[key];
  }
  return p;
}

// Hyprland decorates floating windows (blur, shadow, rounding, borders), which
// draws a dark box around the overlay. Register a window rule for the overlay
// at runtime so it renders bare. No-op on other compositors.
function applyHyprlandRules(): void {
  if (!process.env.HYPRLAND_INSTANCE_SIGNATURE) return;
  const luaRule =
    `hl.window_rule({ name = "${OVERLAY_TITLE}", match = { title = "${OVERLAY_TITLE}" }, ` +
    'float = true, pin = true, no_blur = true, no_shadow = true, no_dim = true, ' +
    'no_anim = true, no_focus = true, rounding = 0, border_size = 0, decorate = false })';
  // Hyprland >= 0.55 (Lua config)
  execFile('hyprctl', ['eval', luaRule], (err, stdout) => {
    if (!err && /\bok\b/.test(String(stdout))) return;
    // Older conf-based Hyprland
    const sel = `title:^(${OVERLAY_TITLE})$`;
    for (const rule of ['float', 'pin', 'noblur', 'noshadow', 'nodim', 'noanim', 'nofocus', 'noborder', 'rounding 0']) {
      execFile('hyprctl', ['keyword', 'windowrulev2', `${rule}, ${sel}`], () => {});
    }
  });
}

// Same idea for sway/wlroots: float, undecorate and pin the overlay.
function applySwayRules(): void {
  if (!process.env.SWAYSOCK) return;
  const sel = `[title="^${OVERLAY_TITLE}$"]`;
  execFile('swaymsg', [`for_window ${sel} floating enable, border none, sticky enable`], () => {});
}

function createSplash(): void {
  splashWindow = new BrowserWindow({
    width: 480,
    height: 360,
    frame: true,
    resizable: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload_splash.js'),
    },
  });
  splashWindow.setMenu(null);
  splashWindow.loadFile(path.join(ASSETS, 'splash.html'));
  splashWindow.on('closed', () => { splashWindow = null; });
}

function createMain(): void {
  mainWindow = new BrowserWindow({
    width: 880,
    height: 700,
    minWidth: 720,
    minHeight: 560,
    autoHideMenuBar: true,
    show: false,
    backgroundColor: '#0b0b10',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload_main.js'),
    },
  });
  mainWindow.setMenu(null);
  mainWindow.loadFile(path.join(ASSETS, 'index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.webContents.send('config', config);
    broadcastDisplays();
  });
}

function showMainWindow(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
  } else {
    createMain();
  }
}

function sendOverlayState(): void {
  const state = {
    imageUrl: getCrosshairFileUrl(),
    size: clampSize(),
    hue: config.hue,
    rotation: config.rotation,
    opacity: config.opacity,
    fillColor: config.fillColor,
    outline: config.outline,
    outlineWidth: config.outlineWidth,
    outlineColor: config.outlineColor,
    glow: config.glow,
    glowColor: config.glowColor,
  };
  for (const entry of overlays) {
    if (!entry.win.isDestroyed()) entry.win.webContents.send('overlay-init', state);
  }
}

function addOverlay(displayId: number | null): void {
  const size = clampSize();
  const win = new BrowserWindow({
    width: size,
    height: size,
    title: OVERLAY_TITLE,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    focusable: false,
    skipTaskbar: true,
    hasShadow: false,
    fullscreenable: false,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload_overlay.js'),
    },
  });
  win.setIgnoreMouseEvents(true);
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile(path.join(ASSETS, 'overlay.html'));
  win.on('closed', () => {
    overlays = overlays.filter((o) => o.win !== win);
    if (overlays.length === 0) stopFollowCursor();
  });
  win.webContents.on('did-finish-load', () => {
    if (win.isDestroyed()) return;
    const state = {
      imageUrl: getCrosshairFileUrl(),
      size: clampSize(),
      hue: config.hue,
      rotation: config.rotation,
      opacity: config.opacity,
      fillColor: config.fillColor,
      outline: config.outline,
      outlineWidth: config.outlineWidth,
      outlineColor: config.outlineColor,
      glow: config.glow,
      glowColor: config.glowColor,
    };
    win.webContents.send('overlay-init', state);
    updateOverlayBounds();
    win.showInactive();
    if (config.positionMode === 'follow') startFollowCursor();
  });
  overlays.push({ win, displayId });
}

function destroyOverlays(): void {
  for (const entry of overlays) {
    if (!entry.win.isDestroyed()) entry.win.destroy();
  }
  overlays = [];
  stopFollowCursor();
}

// Make the set of open overlay windows match the current settings:
// - one window pinned to each display when "show on all displays" is on
// - otherwise a single window that is moved to the target display
function syncOverlays(): void {
  if (!config.overlayOn) {
    destroyOverlays();
    return;
  }
  const wantAll = config.showOnAllDisplays && config.positionMode !== 'follow';
  if (!wantAll) {
    if (overlays.length !== 1) {
      destroyOverlays();
      addOverlay(null);
      return;
    }
  } else {
    const ids = screen.getAllDisplays().map((d) => d.id);
    const stale = overlays.filter((o) => o.displayId === null || !ids.includes(o.displayId));
    for (const entry of stale) {
      if (!entry.win.isDestroyed()) entry.win.destroy();
      overlays = overlays.filter((o) => o !== entry);
    }
    for (const id of ids) {
      if (!overlays.some((o) => o.displayId === id)) addOverlay(id);
    }
  }
  updateOverlayBounds();
}

function updateOverlayBounds(): void {
  if (overlays.length === 0) return;
  const size = clampSize();
  const allDisplays = screen.getAllDisplays();
  for (const entry of overlays) {
    if (entry.win.isDestroyed()) continue;
    const display = allDisplays.find((d) => d.id === entry.displayId) ?? getTargetDisplay();
    let x: number, y: number;
    if (config.positionMode === 'center') {
      x = Math.round(display.bounds.x + display.bounds.width / 2 - size / 2);
      y = Math.round(display.bounds.y + display.bounds.height / 2 - size / 2);
    } else if (config.positionMode === 'pixel') {
      // x/y are offsets within the selected display
      x = Math.round(display.bounds.x + config.x - size / 2);
      y = Math.round(display.bounds.y + config.y - size / 2);
    } else {
      const { x: cx, y: cy } = screen.getCursorScreenPoint();
      x = Math.round(cx - size / 2);
      y = Math.round(cy - size / 2);
    }
    entry.win.setBounds({ x, y, width: size, height: size });
  }
}

function startFollowCursor(): void {
  if (followInterval) return;
  followInterval = setInterval(() => {
    if (overlays.length === 0 || config.positionMode !== 'follow') {
      stopFollowCursor();
      return;
    }
    updateOverlayBounds();
  }, 16);
}

function stopFollowCursor(): void {
  if (followInterval) {
    clearInterval(followInterval);
    followInterval = null;
  }
}

function overlayStateRequested(): boolean {
  return config.overlayOn;
}

function showOverlays(): void {
  config.overlayOn = true;
  saveConfig();
  syncOverlays();
  updateTray();
}

function hideOverlays(): void {
  config.overlayOn = false;
  saveConfig();
  destroyOverlays();
  updateTray();
}

function toggleOverlay(): void {
  if (overlayStateRequested()) hideOverlays();
  else showOverlays();
  broadcastConfig();
}

function snapToCursor(): void {
  const point = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(point);
  config.displayId = display.id;
  config.x = point.x - display.bounds.x;
  config.y = point.y - display.bounds.y;
  config.positionMode = 'pixel';
  saveConfig();
  broadcastConfig();
  updateOverlayBounds();
}

function nudge(dx: number, dy: number): void {
  const display = getTargetDisplay();
  if (config.positionMode !== 'pixel') {
    // Start nudging from the display center
    config.x = Math.round(display.bounds.width / 2);
    config.y = Math.round(display.bounds.height / 2);
  }
  config.positionMode = 'pixel';
  config.x = Math.max(0, Math.min(display.bounds.width, config.x + dx));
  config.y = Math.max(0, Math.min(display.bounds.height, config.y + dy));
  saveConfig();
  broadcastConfig();
  updateOverlayBounds();
}

// ---------- Tray ----------
function updateTray(): void {
  if (!config.tray) {
    if (tray) {
      tray.destroy();
      tray = null;
    }
    return;
  }
  try {
    if (!tray) {
      let icon = nativeImage.createFromPath(TRAY_ICON);
      if (!icon.isEmpty()) icon = icon.resize({ width: 22, height: 22 });
      tray = new Tray(icon);
      tray.setToolTip('Dilates Crosshair');
      tray.on('click', () => showMainWindow());
    }
    const menu = Menu.buildFromTemplate([
      {
        label: config.overlayOn ? 'Hide overlay' : 'Show overlay',
        click: () => toggleOverlay(),
      },
      { label: 'Settings', click: () => showMainWindow() },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ]);
    tray.setContextMenu(menu);
  } catch {
    tray = null; // Tray unsupported on this desktop environment
  }
}

// ---------- Hotkeys ----------
// globalShortcut.register throws on malformed accelerators instead of
// returning false, so wrap it.
function safeRegister(acc: string, cb: () => void): boolean {
  try {
    return globalShortcut.register(acc, cb);
  } catch {
    return false;
  }
}

function registerToggleHotkey(): void {
  if (registeredToggleHotkey) {
    globalShortcut.unregister(registeredToggleHotkey);
    registeredToggleHotkey = null;
  }
  const acc = (config.toggleHotkey || DEFAULT_TOGGLE_HOTKEY).trim();
  if (acc && safeRegister(acc, toggleOverlay)) {
    registeredToggleHotkey = acc;
    return;
  }
  // Requested accelerator unavailable (invalid or taken) — fall back to default
  if (acc !== DEFAULT_TOGGLE_HOTKEY && safeRegister(DEFAULT_TOGGLE_HOTKEY, toggleOverlay)) {
    registeredToggleHotkey = DEFAULT_TOGGLE_HOTKEY;
    config.toggleHotkey = DEFAULT_TOGGLE_HOTKEY;
    saveConfig();
  }
}

function registerHotkeys(): void {
  safeRegister('CommandOrControl+Shift+P', snapToCursor);
  const nudges: Record<string, [number, number]> = {
    Left: [-5, 0],
    Right: [5, 0],
    Up: [0, -5],
    Down: [0, 5],
  };
  for (const [key, [dx, dy]] of Object.entries(nudges)) {
    safeRegister(`CommandOrControl+Shift+${key}`, () => nudge(dx, dy));
  }
  registerToggleHotkey();
}

// ---------- IPC: splash & shell ----------
ipcMain.on('splash-open-app', () => {
  if (splashWindow) splashWindow.close();
  createMain();
});

ipcMain.on('open-external', (_, url: string) => {
  if (typeof url === 'string' && /^https?:\/\//.test(url)) shell.openExternal(url);
});

// ---------- IPC: crosshairs ----------
ipcMain.handle('get-builtin-crosshairs', async (): Promise<string[]> => {
  try {
    const names = await fs.readdir(CROSSHAIRS_DIR);
    return names.filter((n) => /\.(png|svg)$/i.test(n)).sort();
  } catch {
    return [];
  }
});

ipcMain.handle('open-folder-dialog', async (): Promise<string | null> => {
  const r = await dialog.showOpenDialog({
    title: 'Select folder with crosshair images',
    properties: ['openDirectory'],
  });
  return r.canceled ? null : r.filePaths[0] || null;
});

ipcMain.handle('get-custom-crosshairs', async (_, dir: string): Promise<string[]> => {
  if (!dir) return [];
  try {
    const names = await fs.readdir(dir);
    return names.filter((n) => /\.(png|svg)$/i.test(n)).sort();
  } catch {
    return [];
  }
});

// ---------- IPC: displays / config ----------
ipcMain.handle('get-displays', () => getDisplays());
ipcMain.handle('get-crosshair-url', () => getCrosshairFileUrl());
ipcMain.handle('get-config', () => config);

ipcMain.on('config-update', (_, next: Partial<Config>) => {
  config = { ...config, ...next };
  saveConfig();
  if (overlays.length > 0) {
    sendOverlayState();
    if (config.positionMode === 'follow') {
      startFollowCursor();
    } else {
      stopFollowCursor();
    }
    syncOverlays();
    updateOverlayBounds();
  }
});

ipcMain.on('overlay-show', () => {
  showOverlays();
  broadcastConfig();
});

ipcMain.on('overlay-hide', () => {
  hideOverlays();
  broadcastConfig();
});

ipcMain.on('overlay-toggle-request', () => toggleOverlay());

ipcMain.on('set-position-from-cursor', () => snapToCursor());

// ---------- IPC: profiles ----------
ipcMain.handle('save-profile', (_, name: string) => {
  const trimmed = String(name || '').trim();
  if (!trimmed) return { ok: false, error: 'Profile name is required.' };
  config.profiles = { ...config.profiles, [trimmed]: snapshotProfile() };
  config.activeProfile = trimmed;
  saveConfig();
  broadcastConfig();
  return { ok: true };
});

ipcMain.handle('delete-profile', (_, name: string) => {
  const trimmed = String(name || '').trim();
  if (trimmed && config.profiles[trimmed]) {
    const profiles = { ...config.profiles };
    delete profiles[trimmed];
    config.profiles = profiles;
    if (config.activeProfile === trimmed) config.activeProfile = null;
    saveConfig();
    broadcastConfig();
  }
  return { ok: true };
});

ipcMain.handle('apply-profile', (_, name: string) => {
  const trimmed = String(name || '').trim();
  const profile = trimmed ? config.profiles[trimmed] : null;
  if (!profile) return { ok: false, error: 'Profile not found.' };
  for (const key of PROFILE_FIELDS) {
    (config as unknown as Record<string, unknown>)[key] = (profile as unknown as Record<string, unknown>)[key];
  }
  config.activeProfile = trimmed;
  saveConfig();
  broadcastConfig();
  if (overlays.length > 0) {
    sendOverlayState();
    syncOverlays();
    updateOverlayBounds();
  }
  return { ok: true };
});

// ---------- IPC: general ----------
ipcMain.handle('reset-config', () => {
  // Reset style, crosshair and position; keep app preferences and profiles
  config = {
    ...config,
    size: DEFAULT_CONFIG.size,
    hue: DEFAULT_CONFIG.hue,
    rotation: DEFAULT_CONFIG.rotation,
    opacity: DEFAULT_CONFIG.opacity,
    crosshair: DEFAULT_CONFIG.crosshair,
    customDir: DEFAULT_CONFIG.customDir,
    customFile: DEFAULT_CONFIG.customFile,
    fillColor: DEFAULT_CONFIG.fillColor,
    outline: DEFAULT_CONFIG.outline,
    outlineWidth: DEFAULT_CONFIG.outlineWidth,
    outlineColor: DEFAULT_CONFIG.outlineColor,
    glow: DEFAULT_CONFIG.glow,
    glowColor: DEFAULT_CONFIG.glowColor,
    positionMode: DEFAULT_CONFIG.positionMode,
    x: DEFAULT_CONFIG.x,
    y: DEFAULT_CONFIG.y,
    displayId: null,
    activeProfile: null,
  };
  saveConfig();
  broadcastConfig();
  if (overlays.length > 0) {
    sendOverlayState();
    syncOverlays();
    updateOverlayBounds();
  }
  return config;
});

ipcMain.handle('set-toggle-hotkey', (_, acc: string) => {
  const requested = String(acc || '').trim();
  if (!requested) return { ok: false, accelerator: registeredToggleHotkey, error: 'Empty accelerator.' };
  if (requested === registeredToggleHotkey) return { ok: true, accelerator: requested };
  globalShortcut.unregister(registeredToggleHotkey ?? '');
  registeredToggleHotkey = null;
  if (safeRegister(requested, toggleOverlay)) {
    registeredToggleHotkey = requested;
    config.toggleHotkey = requested;
    saveConfig();
    return { ok: true, accelerator: requested };
  }
  // Failed — restore previous binding
  let fallback = config.toggleHotkey;
  if (fallback === requested || !safeRegister(fallback, toggleOverlay)) {
    fallback = DEFAULT_TOGGLE_HOTKEY;
    safeRegister(fallback, toggleOverlay);
  }
  registeredToggleHotkey = fallback;
  config.toggleHotkey = fallback;
  saveConfig();
  return { ok: false, accelerator: registeredToggleHotkey, error: `Could not register "${requested}".` };
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => showMainWindow());

  app.whenReady().then(() => {
    loadConfig();
    applyHyprlandRules();
    applySwayRules();
    registerHotkeys();
    screen.on('display-added', () => { broadcastDisplays(); syncOverlays(); });
    screen.on('display-removed', () => { broadcastDisplays(); syncOverlays(); });
    screen.on('display-metrics-changed', () => { broadcastDisplays(); syncOverlays(); });
    createSplash();
    updateTray();
    // Restore the overlay if it was on when the app was last closed
    if (config.overlayOn) syncOverlays();
  });
}

app.on('window-all-closed', () => {
  // Stay alive in the tray when the settings window is closed
  if (!config.tray) app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  stopFollowCursor();
  if (saveTimer) {
    clearTimeout(saveTimer);
    try { fsSync.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2)); } catch {}
  }
});
