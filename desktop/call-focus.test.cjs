const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('call window is hidden while the main window has focus and reappears on blur', () => {
  let focused = true;
  let visible = true;
  const main = { isDestroyed: () => false, isVisible: () => true, isFocused: () => focused };
  const pip = {
    isDestroyed: () => false, isVisible: () => visible,
    hide: () => { visible = false; }, showInactive: () => { visible = true; },
    setAlwaysOnTop() {}, setVisibleOnAllWorkspaces() {}, moveTop() {},
  };
  const app = { whenReady: () => new Promise(() => {}), on() {} };
  const context = {
    require: (id) => id === 'electron' ? { app } : id === 'electron-updater' ? { autoUpdater: {} } : require(id),
    process: { platform: 'win32', env: {} }, __dirname, console, setTimeout, setInterval, testMain: main, testPip: pip,
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8') + `
    mainWindow = testMain; callPipWindow = testPip; latestCallPipState = { visible: true };
    syncCallPipVisibility();
  `, context);
  assert.equal(visible, false);
  focused = false;
  vm.runInNewContext('syncCallPipVisibility()', context);
  assert.equal(visible, true);
  focused = true;
  vm.runInNewContext('syncCallPipVisibility()', context);
  assert.equal(visible, false);
});

test('focus event hides PiP even before Windows reports focus; blur restores it', () => {
  let visible = true;
  let runDelayed;
  const main = { isDestroyed: () => false, isVisible: () => true, isFocused: () => false, isMinimized: () => false };
  const pip = {
    isDestroyed: () => false, isVisible: () => visible,
    hide: () => { visible = false; }, showInactive: () => { visible = true; },
    setAlwaysOnTop() {}, setVisibleOnAllWorkspaces() {}, moveTop() {},
  };
  const app = { whenReady: () => new Promise(() => {}), on() {} };
  const context = {
    require: (id) => id === 'electron' ? { app, BrowserWindow: { getFocusedWindow: () => null } } : id === 'electron-updater' ? { autoUpdater: {} } : require(id),
    process: { platform: 'win32', env: {} }, __dirname, console,
    setTimeout: (fn) => { runDelayed = fn; return 1; }, clearTimeout() {}, setInterval,
    testMain: main, testPip: pip,
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8') + `
    mainWindow = testMain; callPipWindow = testPip; latestCallPipState = { visible: true };
    handleMainWindowFocus();
  `, context);
  assert.equal(visible, false);
  vm.runInNewContext('handleMainWindowBlur()', context);
  assert.equal(visible, false);
  runDelayed();
  assert.equal(visible, true);
});

test('periodic reconciliation corrects a missed focus event', () => {
  let focused = false;
  let visible = true;
  const main = { isDestroyed: () => false, isVisible: () => true, isFocused: () => focused };
  const pip = { isDestroyed: () => false, isVisible: () => visible, hide: () => { visible = false; },
    showInactive: () => { visible = true; }, setAlwaysOnTop() {}, setVisibleOnAllWorkspaces() {}, moveTop() {} };
  const app = { whenReady: () => new Promise(() => {}), on() {} };
  const context = { require: (id) => id === 'electron' ? { app } : id === 'electron-updater' ? { autoUpdater: {} } : require(id),
    process: { platform: 'win32', env: {} }, __dirname, console, setTimeout, clearTimeout, setInterval, testMain: main, testPip: pip };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8') + `mainWindow = testMain; callPipWindow = testPip; latestCallPipState = { visible: true };`, context);
  focused = true;
  vm.runInNewContext('reconcileCallPipFocus()', context);
  assert.equal(visible, false);
  focused = false;
  for (let i = 0; i < 3; i++) vm.runInNewContext('reconcileCallPipFocus()', context);
  assert.equal(visible, true);
});

test('a second application process exits instead of creating another call window', () => {
  let quit = false;
  let initialized = false;
  const app = { requestSingleInstanceLock: () => false, quit: () => { quit = true; },
    whenReady: () => { initialized = true; return new Promise(() => {}); }, on() {} };
  const context = { require: (id) => id === 'electron' ? { app } : id === 'electron-updater' ? { autoUpdater: {} } : require(id),
    process: { platform: 'win32', env: {} }, __dirname, console, setTimeout, clearTimeout, setInterval };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8'), context);
  assert.equal(quit, true);
  assert.equal(initialized, false);
});
