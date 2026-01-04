import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),
  writeFile: (filePath: string, data: string) => ipcRenderer.invoke('fs:writeFile', filePath, data),
  readDir: (dirPath: string) => ipcRenderer.invoke('fs:readDir', dirPath),
  mkdir: (dirPath: string) => ipcRenderer.invoke('fs:mkdir', dirPath),
  exists: (filePath: string) => ipcRenderer.invoke('fs:exists', filePath),
  joinPath: (...paths: string[]) => paths.join('/'),
  getUserDataPath: () => ipcRenderer.invoke('app:getUserDataPath'),
  showSaveDialog: (options: any) => ipcRenderer.invoke('dialog:showSaveDialog', options),
  showOpenDialog: (options: any) => ipcRenderer.invoke('dialog:showOpenDialog', options),
})

