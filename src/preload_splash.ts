import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('splash', {
  openApp: () => ipcRenderer.send('splash-open-app'),
  openExternal: (url: string) => ipcRenderer.send('open-external', url),
});
