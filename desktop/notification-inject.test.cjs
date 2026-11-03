const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('forwards browser notification details', () => {
  const calls = [];
  class NativeNotification {}
  const window = { Notification: NativeNotification, adventuraDesktop: { notify: (payload) => calls.push(payload) } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'notification-inject.js'), 'utf8'), { window, EventTarget, Proxy, Reflect, Promise });
  new window.Notification('Мария', { body: 'Привет!' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].title, 'Мария');
  assert.equal(calls[0].body, 'Привет!');
});

test('old web builds produce one fallback per blinking episode', () => {
  const calls = [];
  const timers = new Map();
  let id = 0, onMutation;
  const document = { title: 'Adventura', head: {} };
  const window = {
    adventuraDesktop: { notify: (payload) => calls.push(payload) },
    setTimeout: (fn, delay) => { const key = ++id; timers.set(key, { fn, delay }); return key; },
    clearTimeout: (key) => timers.delete(key),
  };
  class MutationObserver { constructor(fn) { onMutation = fn; } observe() {} }
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'notification-inject.js'), 'utf8'), { window, document, MutationObserver, EventTarget, Proxy, Reflect, Promise });
  const fireTimers = (delay) => {
    for (const [key, timer] of [...timers]) if (timer.delay === delay) { timers.delete(key); timer.fn(); }
  };
  document.title = 'Новое сообщение'; onMutation(); fireTimers(750);
  for (let i = 0; i < 4; i++) { document.title = i % 2 ? 'Новое сообщение' : 'Adventura'; onMutation(); fireTimers(750); }
  assert.equal(calls.length, 1);
  document.title = 'Adventura'; onMutation();
  fireTimers(2500);
  document.title = 'Новое сообщение'; onMutation(); fireTimers(750);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].titleFallback, true);
});
