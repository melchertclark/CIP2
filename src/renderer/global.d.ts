export interface IElectronAPI {
  openFile: () => Promise<{ canceled: boolean; content?: string; filePath?: string; error?: string }>;
  saveFile: (content: string) => Promise<{ canceled: boolean; filePath?: string; error?: string }>;
}
declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
export {};