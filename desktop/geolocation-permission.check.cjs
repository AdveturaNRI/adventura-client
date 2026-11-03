// Verify Electron's real geolocation permission metadata without accessing location.
const electron = require('electron');
const { app, BrowserWindow, session } = electron;
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const vm = require('node:vm');

app.whenReady().then(async () => {
  const server = http.createServer((_req, res) => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<title>location test</title>'); });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const win = new BrowserWindow({ show: false });
  try {
    const fakeApp = { whenReady: () => new Promise(() => {}), on() {} };
    const context = {
      require: (id) => id === 'electron' ? { ...electron, app: fakeApp } : id === 'electron-updater' ? { autoUpdater: {} } : require(id),
      process: { platform: 'win32', env: { ADVENTURA_URL: origin } }, __dirname, console, URL, setTimeout, clearTimeout, setInterval, testWindow: win,
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8') + 'mainWindow = testWindow;', context);
    const results = [];
    session.defaultSession.setPermissionCheckHandler((wc, permission, requestOrigin, details) => {
      if (permission === 'geolocation') {
        Object.assign(context, { testContents: wc, testOrigin: requestOrigin, testDetails: details });
        results.push({ type: 'check', trusted: vm.runInNewContext('isTrustedLocationRequest(testContents, testOrigin, testDetails)', context), origin: requestOrigin, current: wc?.getURL(), main: details.isMainFrame, requestingUrl: details.requestingUrl, securityOrigin: details.securityOrigin, webContents: wc === win.webContents });
      }
      return false;
    });
    session.defaultSession.setPermissionRequestHandler((wc, permission, callback, details) => {
      if (permission === 'geolocation') {
        Object.assign(context, { testContents: wc, testOrigin: details.requestingUrl, testDetails: details });
        results.push({ type: 'request', trusted: vm.runInNewContext('isTrustedLocationRequest(testContents, testOrigin, testDetails)', context) });
      }
      callback(false); // Never query the actual device location in this test.
    });
    await win.loadURL(origin);
    results.length = 0; // Ignore Chromium's initial check before navigation commits.
    await win.webContents.executeJavaScript(`navigator.permissions.query({name:'geolocation'}).then(p => p.state)`);
    await win.webContents.executeJavaScript(`new Promise(resolve => navigator.geolocation.getCurrentPosition(() => resolve('unexpected'), () => resolve('denied')))`);
    assert.ok(results.length > 0, 'Electron did not call the permission handlers');
    assert.ok(results.every((result) => result.trusted), JSON.stringify(results));
    console.log('Electron identifies the trusted main-frame location request: OK');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    win.destroy(); server.close(); app.exit(process.exitCode || 0);
  }
});
