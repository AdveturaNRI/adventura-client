const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { backgroundThrottling: false } });
  try {
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent('<title>Adventura</title><body></body>'));
    await win.webContents.executeJavaScript(`window.testNotifications = []; window.adventuraDesktop = { notify: x => window.testNotifications.push(x) }; void 0;`);
    await win.webContents.executeJavaScript(fs.readFileSync(path.join(__dirname, 'notification-inject.js'), 'utf8'));
    await win.webContents.executeJavaScript(`document.title = 'Новое сообщение'; window.blink = setInterval(() => { document.title = document.title === 'Новое сообщение' ? 'Adventura' : 'Новое сообщение'; }, 900);`);
    await new Promise((resolve) => setTimeout(resolve, 4500));
    const items = await win.webContents.executeJavaScript('clearInterval(window.blink); window.testNotifications');
    assert.equal(items.length, 1);
    assert.equal(items[0].title, 'Новое сообщение');
    console.log('Legacy blinking title produces one notification: OK');
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    win.destroy();
    app.exit(process.exitCode || 0);
  }
});
