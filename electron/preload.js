const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('smartPlanCoachDesktop', {
  isElectron: true,
  getUserDataPath: () => ipcRenderer.sendSync('get-user-data-path-sync')
});
