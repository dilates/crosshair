import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('overlay', {
  onInit: (cb: (data: { imageUrl: string; size: number; hue: number; rotation: number; opacity: number }) => void) => {
    ipcRenderer.on('overlay-init', (_, data) => cb(data));
  },
});
