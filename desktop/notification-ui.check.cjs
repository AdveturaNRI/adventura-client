// Run with Electron: closing a notification must not trigger navigation.
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const path = require('node:path');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: {
    preload: path.join(__dirname, 'notification-preload.js'), contextIsolation: true,
    nodeIntegration: false, sandbox: true,
  } });
  try {
    const channels = [];
    win.webContents.on('ipc-message', (_event, channel) => channels.push(channel));
    await win.loadFile(path.join(__dirname, 'notification.html'));
    await win.webContents.executeJavaScript(`document.getElementById('dismiss').click()`);
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.deepEqual(channels, ['notification:dismiss']);
    console.log('Notification close does not navigate: OK');
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    win.destroy();
    app.exit(process.exitCode || 0);
  }
});
