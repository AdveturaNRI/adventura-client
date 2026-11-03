// Run with Electron: verifies fixed call overlays stay below the title bar.
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1000, height: 700 });
  try {
    await win.loadURL('data:text/html,' + encodeURIComponent('<!doctype html><html><head></head><body><div role="dialog" aria-modal="true" style="position:fixed;top:0;bottom:0;left:0;right:0"><div id="call" style="position:fixed;top:0;bottom:0;width:100%;height:100%"></div></div></body></html>'));
    const script = fs.readFileSync(path.join(__dirname, 'titlebar-inject.js'), 'utf8');
    await win.webContents.executeJavaScript(script);
    const rect = await win.webContents.executeJavaScript(`(() => { const r = document.getElementById('call').getBoundingClientRect(); return { top: r.top, bottom: r.bottom, height: innerHeight }; })()`);
    assert.equal(rect.top, 40);
    assert.equal(rect.bottom, rect.height);
    console.log('Call modal stays below the title bar: OK');
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    win.destroy();
    app.exit(process.exitCode || 0);
  }
});
