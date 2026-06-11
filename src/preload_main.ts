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
  setPositionFromCursor: () => ipcRenderer.send('set-position-from-cursor'),
  getConfig: () => ipcRenderer.invoke('get-config'),
  openExternal: (url: string) => ipcRenderer.send('open-external', url),
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
