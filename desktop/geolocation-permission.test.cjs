const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('geolocation is allowed only to the main Adventura frame', () => {
  const contents = { getURL: () => 'https://adventu.ru/clubs' };
  const main = { isDestroyed: () => false, webContents: contents };
  const app = { whenReady: () => new Promise(() => {}), on() {} };
  const context = {
    require: (id) => id === 'electron' ? { app } : id === 'electron-updater' ? { autoUpdater: {} } : require(id),
    process: { platform: 'win32', env: {} }, __dirname, console, URL, setTimeout, clearTimeout, setInterval,
    testMain: main, testContents: contents,
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8') + 'mainWindow = testMain;', context);
  assert.equal(vm.runInNewContext(`isTrustedLocationRequest(testContents, 'https://adventu.ru/clubs', { isMainFrame: true })`, context), true);
  assert.equal(vm.runInNewContext(`isTrustedLocationRequest(testContents, 'https://other.example', { isMainFrame: true })`, context), false);
  assert.equal(vm.runInNewContext(`isTrustedLocationRequest(testContents, 'https://adventu.ru/clubs', { isMainFrame: false })`, context), false);
  assert.equal(vm.runInNewContext(`isTrustedLocationRequest({}, 'https://adventu.ru/clubs', { isMainFrame: true })`, context), false);
});
