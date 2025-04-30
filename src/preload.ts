import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  saveFile: (content: string) => ipcRenderer.invoke('save-file', content),
  sendQuitResponse: (response: { isDirty: boolean }) => ipcRenderer.send('quit-response', response),
  sendSaveComplete: () => ipcRenderer.send('save-file-complete'),
  onFileLoading: (callback: (isLoading: boolean) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, isLoading: boolean) => callback(isLoading);
    ipcRenderer.on('file-loading', handler);
    return () => ipcRenderer.removeListener('file-loading', handler);
  },
  onFileData: (callback: (data: { filePath: string; data: any; warnings?: string[] }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { filePath: string; data: any; warnings?: string[] }) => {
        console.log('[preload.ts] Received file-data:', data);
        callback(data);
    };
    ipcRenderer.on('file-data', handler);
    return () => ipcRenderer.removeListener('file-data', handler);
  },
  onFileError: (callback: (error: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, error: string) => callback(error);
    ipcRenderer.on('file-error', handler);
    return () => ipcRenderer.removeListener('file-error', handler);
  },
  onBeforeQuitRequest: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('before-quit-request', handler);
    return () => ipcRenderer.removeListener('before-quit-request', handler);
  },
  onRequestSave: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('request-save', handler);
    return () => ipcRenderer.removeListener('request-save', handler);
  },
});

declare global {
    interface Window {
        electronAPI: {
            saveFile: (content: string) => Promise<{ canceled: boolean, filePath?: string, error?: string }>;
            onFileLoading: (callback: (isLoading: boolean) => void) => () => void;
            onFileData: (callback: (data: { filePath: string; data: any; warnings?: string[] }) => void) => () => void;
            onFileError: (callback: (error: string) => void) => () => void;
            sendQuitResponse: (response: { isDirty: boolean }) => void;
            onBeforeQuitRequest: (callback: () => void) => () => void;
            onRequestSave: (callback: () => void) => () => void;
            sendSaveComplete: () => void;
        }
    }
}