const { contextBridge, ipcRenderer } = require('electron')

// 暴露給前端（contextIsolation 下安全橋接）：讀取/寫入連線設定
contextBridge.exposeInMainWorld('appConfig', {
  get: () => ipcRenderer.invoke('app-config:get'),
  set: (patch) => ipcRenderer.invoke('app-config:set', patch)
})
