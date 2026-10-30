const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('adventuraCallPip', {
  onState: (callback) => {
    const listener = (_event, state) => {
      if (typeof callback === 'function') {
        callback(state);
      }
    };
    ipcRenderer.on('call-pip:state', listener);
    return () => ipcRenderer.removeListener('call-pip:state', listener);
  },
  sendAction: (action) => {
    ipcRenderer.send('call-pip:action', String(action || ''));
  },
  setCollapsed: (collapsed) =>
    ipcRenderer.invoke('call-pip:set-collapsed', Boolean(collapsed)),
});
