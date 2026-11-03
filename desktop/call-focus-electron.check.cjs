// Runs the actual focus logic against Electron windows positioned off-screen.
const electron = require('electron');
const { app, BrowserWindow } = electron;
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'adventura-focus-check-')));

app.whenReady().then(async () => {
  const options = { show: false, x: -20000, y: -20000, width: 300, height: 200, opacity: 0.01, skipTaskbar: true };
  const main = new BrowserWindow(options);
  const pip = new BrowserWindow({ ...options, frame: false });
  const other = new BrowserWindow(options);
  try {
    const focus = async (win) => {
      win.show();
      for (let attempt = 0; attempt < 6 && !win.isFocused(); attempt++) {
        win.focus();
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    };
    await Promise.all([main.loadURL('about:blank'), pip.loadURL('about:blank'), other.loadURL('about:blank')]);
    const fakeApp = { whenReady: () => new Promise(() => {}), on() {} };
    const context = {
      require: (id) => id === 'electron' ? { ...electron, app: fakeApp } : id === 'electron-updater' ? { autoUpdater: {} } : require(id),
      process: { platform: 'win32', env: {} }, __dirname, console, setTimeout, clearTimeout, setInterval,
      testMain: main, testPip: pip,
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8') + `
      mainWindow = testMain; callPipWindow = testPip; latestCallPipState = { visible: true };
      mainWindow.on('focus', handleMainWindowFocus); mainWindow.on('blur', handleMainWindowBlur);
      mainWindow.on('hide', handleMainWindowBlur); mainWindow.on('minimize', handleMainWindowBlur);
    `, context);
    await focus(main);
    await new Promise((resolve) => setTimeout(resolve, 400));
    assert.equal(main.isFocused(), true, 'test main window did not receive focus');
    vm.runInNewContext('syncCallPipVisibility()', context);
    assert.equal(pip.isVisible(), false);
    await focus(other);
    await new Promise((resolve) => setTimeout(resolve, 500));
    assert.equal(other.isFocused(), true, 'test external window did not receive focus');
    vm.runInNewContext('reconcileCallPipFocus()', context);
    assert.equal(pip.isVisible(), true);
    pip.focus();
    await new Promise((resolve) => setTimeout(resolve, 200));
    vm.runInNewContext('reconcileCallPipFocus()', context);
    assert.equal(pip.isVisible(), true, 'PiP must remain usable when clicked');
    await focus(main);
    await new Promise((resolve) => setTimeout(resolve, 500));
    assert.equal(main.isFocused(), true);
    assert.equal(pip.isVisible(), false);
    main.minimize();
    await new Promise((resolve) => setTimeout(resolve, 500));
    vm.runInNewContext('reconcileCallPipFocus()', context);
    assert.equal(pip.isVisible(), true, 'PiP should appear when the app is minimized');
    console.log('Windows focus switches hide and restore PiP: OK');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    for (const win of [main, pip, other]) if (!win.isDestroyed()) win.destroy();
    app.exit(process.exitCode || 0);
  }
});
