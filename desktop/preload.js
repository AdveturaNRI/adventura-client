const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('adventuraDesktop', {
  isDesktop: true,
  platform: process.platform,
  notify: (payload) => ipcRenderer.invoke('desktop:notify', payload),
  setAutostart: (enabled) => ipcRenderer.invoke('desktop:set-autostart', Boolean(enabled)),
  getAutostart: () => ipcRenderer.invoke('desktop:get-autostart'),
  showWindow: () => ipcRenderer.invoke('desktop:show-window'),
  updateCallPip: (state) => ipcRenderer.invoke('desktop:call-pip-update', state),
  onNavigate: (callback) => {
    const listener = (_event, url) => {
      if (typeof callback === 'function' && typeof url === 'string') {
        callback(url);
      }
    };
    ipcRenderer.on('desktop:navigate', listener);
    return () => ipcRenderer.removeListener('desktop:navigate', listener);
  },
  onCallPipAction: (callback) => {
    const listener = (_event, action) => {
      if (typeof callback === 'function' && typeof action === 'string') {
        callback(action);
      }
    };
    ipcRenderer.on('desktop:call-pip-action', listener);
    return () => ipcRenderer.removeListener('desktop:call-pip-action', listener);
  },
});
