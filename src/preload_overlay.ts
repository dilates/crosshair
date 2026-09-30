import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('overlay', {
  onInit: (cb: (data: Record<string, unknown>) => void) => {
    ipcRenderer.on('overlay-init', (_, data) => cb(data));
  },
});
