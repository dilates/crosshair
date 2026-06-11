import { app, BrowserWindow, ipcMain, screen, globalShortcut, dialog, shell, Display } from 'electron';
import { execFile } from 'child_process';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';

const ASSETS = path.join(app.getAppPath(), 'public');
const CROSSHAIRS_DIR = path.join(ASSETS, 'crosshairs');
const CONFIG_FILE = path.join(app.getPath('userData'), 'config.json');
const OVERLAY_TITLE = 'dilates-crosshair-overlay';

// Needed for transparent windows on some X11 setups (e.g. GNOME on Xorg)
app.commandLine.appendSwitch('enable-transparent-visuals');

type PositionMode = 'center' | 'pixel' | 'follow';
interface Config {
  size: number;
  hue: number;
  rotation: number;
  opacity: number;
  crosshair: string;
  positionMode: PositionMode;
  x: number;
  y: number;
  displayId: number | null;
  customDir: string | null;
  customFile: string | null;
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

const DEFAULT_CONFIG: Config = {
  size: 48,
  hue: 0,
  rotation: 0,
  opacity: 1,
  crosshair: 'cross-dot.svg',
  positionMode: 'center',
  x: 0,
  y: 0,
  displayId: null,
  customDir: null,
  customFile: null,
};

let splashWindow: BrowserWindow | null = null;
let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let followInterval: ReturnType<typeof setInterval> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let config: Config = { ...DEFAULT_CONFIG };

function loadConfig(): void {
  try {
    const raw = fsSync.readFileSync(CONFIG_FILE, 'utf8');
    config = { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
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

function broadcastDisplays(): void {
  mainWindow?.webContents.send('displays', getDisplays());
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
    height: 660,
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

function sendOverlayState(): void {
  overlayWindow?.webContents.send('overlay-init', {
    imageUrl: getCrosshairFileUrl(),
    size: config.size,
    hue: config.hue,
    rotation: config.rotation,
    opacity: config.opacity,
  });
}

function createOverlay(): void {
  if (overlayWindow) return;
  const size = Math.max(16, Math.min(256, config.size));
  overlayWindow = new BrowserWindow({
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
  overlayWindow.setIgnoreMouseEvents(true);
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.loadFile(path.join(ASSETS, 'overlay.html'));
  overlayWindow.on('closed', () => {
    overlayWindow = null;
    stopFollowCursor();
  });
  overlayWindow.webContents.on('did-finish-load', () => {
    sendOverlayState();
    updateOverlayBounds();
    overlayWindow?.showInactive();
    if (config.positionMode === 'follow') startFollowCursor();
  });
}

function updateOverlayBounds(): void {
  if (!overlayWindow) return;
  const size = Math.max(16, Math.min(256, config.size));
  const display = getTargetDisplay();
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
  overlayWindow.setBounds({ x, y, width: size, height: size });
}

function startFollowCursor(): void {
  if (followInterval) return;
  followInterval = setInterval(() => {
    if (!overlayWindow || config.positionMode !== 'follow') {
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

ipcMain.on('splash-open-app', () => {
  if (splashWindow) splashWindow.close();
  createMain();
});

ipcMain.on('open-external', (_, url: string) => {
  shell.openExternal(url);
});

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

ipcMain.handle('get-displays', () => getDisplays());

ipcMain.handle('get-crosshair-url', () => getCrosshairFileUrl());

ipcMain.on('config-update', (_, next: Partial<Config>) => {
  config = { ...config, ...next };
  saveConfig();
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    sendOverlayState();
    if (config.positionMode === 'follow') {
      startFollowCursor();
    } else {
      stopFollowCursor();
      updateOverlayBounds();
    }
  }
});

ipcMain.on('overlay-show', () => {
  createOverlay();
});

ipcMain.on('overlay-hide', () => {
  stopFollowCursor();
  if (overlayWindow) {
    overlayWindow.close();
    overlayWindow = null;
  }
});

ipcMain.on('set-position-from-cursor', () => {
  const point = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(point);
  config.displayId = display.id;
  config.x = point.x - display.bounds.x;
  config.y = point.y - display.bounds.y;
  config.positionMode = 'pixel';
  saveConfig();
  mainWindow?.webContents.send('config', config);
  updateOverlayBounds();
});

ipcMain.handle('get-config', () => config);

app.whenReady().then(() => {
  loadConfig();
  applyHyprlandRules();
  globalShortcut.register('CommandOrControl+Shift+P', () => {
    mainWindow?.webContents.send('set-position-from-cursor');
  });
  screen.on('display-added', () => { broadcastDisplays(); updateOverlayBounds(); });
  screen.on('display-removed', () => { broadcastDisplays(); updateOverlayBounds(); });
  screen.on('display-metrics-changed', () => { broadcastDisplays(); updateOverlayBounds(); });
  createSplash();
});

app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  stopFollowCursor();
  if (saveTimer) {
    clearTimeout(saveTimer);
    try { fsSync.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2)); } catch {}
  }
});
