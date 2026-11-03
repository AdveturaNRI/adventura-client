const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const path = require('node:path');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: {
    preload: path.join(__dirname, 'call-pip-preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true,
  } });
  try {
    await win.loadFile(path.join(__dirname, 'call-pip.html'));
    win.webContents.send('call-pip:state', { visible: true, mode: 'incoming', peerName: 'Мария' });
    await new Promise((resolve) => setTimeout(resolve, 100));
    const incoming = await win.webContents.executeJavaScript(`document.getElementById('badgeText').textContent`);
    assert.equal(incoming, 'Входящий');
    win.webContents.send('call-pip:state', { visible: true, mode: 'active', peerName: 'Мария' });
    await new Promise((resolve) => setTimeout(resolve, 100));
    const result = await win.webContents.executeJavaScript(`({ badge: document.getElementById('badgeText').textContent, actions: document.getElementById('actions').innerText })`);
    assert.equal(result.badge, 'В эфире');
    assert.ok(result.actions.includes('Сброс'));
    assert.ok(!result.actions.includes('Принять'));
    console.log('Incoming call transitions to active controls: OK');
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    win.destroy();
    app.exit(process.exitCode || 0);
  }
});
