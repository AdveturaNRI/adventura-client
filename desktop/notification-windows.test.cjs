const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('separate messages from one sender both produce visible notification windows', () => {
  const windows = [];
  class Window extends EventEmitter {
    constructor() {
      super();
      this.webContents = new EventEmitter();
      windows.push(this);
    }
    isDestroyed() { return false; }
    setPosition(x, y) { this.position = [x, y]; }
    loadFile() { return Promise.resolve(); }
    close() { this.closed = true; this.emit('closed'); }
  }
  const electron = {
    app: { whenReady: () => new Promise(() => {}), on() {} },
    BrowserWindow: Window,
    screen: { getPrimaryDisplay: () => ({ workArea: { x: 0, y: 0, width: 1200, height: 800 } }) },
    Notification: {},
  };
  const context = {
    require: (id) => id === 'electron' ? electron : id === 'electron-updater' ? { autoUpdater: {} } : require(id),
    process: { platform: 'win32', env: {} }, __dirname, console,
    setTimeout() {}, setInterval() {},
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8') + `
    showOsNotification({ title: 'Мария', body: 'Первое' });
    showOsNotification({ title: 'Мария', body: 'Второе' });
  `, context);
  assert.equal(windows.length, 2);
  assert.notDeepEqual(windows[0].position, windows[1].position);
  windows[1].webContents.emit('ipc-message', {}, 'notification:dismiss');
  assert.equal(windows[1].closed, true);
});
