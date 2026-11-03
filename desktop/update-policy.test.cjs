const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('policy permits rollback and blocks a client below the minimum', () => {
  let version = '2.0.0';
  let hidden = false;
  const updater = {};
  const app = { isPackaged: true, getVersion: () => version, whenReady: () => new Promise(() => {}), on() {} };
  const context = {
    require: (id) => id === 'electron' ? { app } : id === 'electron-updater' ? { autoUpdater: updater } : require(id),
    process: { platform: 'win32', env: {} }, __dirname, console, setTimeout, setInterval,
    testWindow: { hide: () => { hidden = true; } },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8') + `
    mainWindow = testWindow;
    applyUpdatePolicy({ current: '1.0.0', minimum: '1.0.0' });
  `, context);
  assert.equal(updater.allowDowngrade, true);
  assert.equal(hidden, false);
  version = '0.9.0';
  vm.runInNewContext(`applyUpdatePolicy({ current: '1.0.0', minimum: '1.0.0' });`, context);
  assert.equal(updater.allowDowngrade, false);
  assert.equal(hidden, true);
  assert.equal(vm.runInNewContext('requiredUpdate', context), true);
});
