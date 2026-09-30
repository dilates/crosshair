import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('dilates', {
  getBuiltinCrosshairs: () => ipcRenderer.invoke('get-builtin-crosshairs'),
  openFolderDialog: () => ipcRenderer.invoke('open-folder-dialog'),
  getCustomCrosshairs: (dir: string) => ipcRenderer.invoke('get-custom-crosshairs', dir),
  getDisplays: () => ipcRenderer.invoke('get-displays'),
  getCrosshairUrl: () => ipcRenderer.invoke('get-crosshair-url'),
  configUpdate: (config: Record<string, unknown>) => ipcRenderer.send('config-update', config),
  overlayShow: () => ipcRenderer.send('overlay-show'),
  overlayHide: () => ipcRenderer.send('overlay-hide'),
  toggleOverlay: () => ipcRenderer.send('overlay-toggle-request'),
  setPositionFromCursor: () => ipcRenderer.send('set-position-from-cursor'),
  getConfig: () => ipcRenderer.invoke('get-config'),
  openExternal: (url: string) => ipcRenderer.send('open-external', url),
  resetConfig: () => ipcRenderer.invoke('reset-config'),
  setToggleHotkey: (acc: string) => ipcRenderer.invoke('set-toggle-hotkey', acc),
  saveProfile: (name: string) => ipcRenderer.invoke('save-profile', name),
  deleteProfile: (name: string) => ipcRenderer.invoke('delete-profile', name),
  applyProfile: (name: string) => ipcRenderer.invoke('apply-profile', name),
  onConfig: (cb: (config: Record<string, unknown>) => void) => {
    ipcRenderer.on('config', (_, c) => cb(c));
  },
  onDisplays: (cb: (displays: unknown[]) => void) => {
    ipcRenderer.on('displays', (_, d) => cb(d));
  },
  onSetPositionFromCursor: (cb: () => void) => {
    ipcRenderer.on('set-position-from-cursor', () => cb());
  },
});
