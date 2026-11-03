const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('adventuraNotification', {
  onContent: (callback) => ipcRenderer.on('notification:content', (_event, content) => callback(content)),
  click: () => ipcRenderer.send('notification:click'),
  dismiss: () => ipcRenderer.send('notification:dismiss'),
});
