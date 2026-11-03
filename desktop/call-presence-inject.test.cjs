const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('incoming card uses caller details and disappears when its controls are hidden', () => {
  const states = [];
  let tick;
  const timers = new Map();
  let timerId = 0;
  const element = (parent = null) => ({
    nodeType: 1, parentElement: parent, isConnected: true, hidden: false,
    contains: () => false,
    getAttribute: () => null, getClientRects() { return this.hidden ? [] : [{}]; },
    getBoundingClientRect: () => ({ width: 88, height: 88 }),
  });
  const body = element();
  body.innerText = 'Входящий звонок\nМ\nМария\nГолосовой чат\nОтклонить\nПринять';
  const card = element(body);
  card.innerText = body.innerText;
  const accept = element(card);
  const decline = element(card);
  const avatar = Object.assign(element(card), { src: 'https://example.test/avatar.png' });
  card.contains = (item) => item === decline;
  card.querySelectorAll = (selector) => selector === 'img' ? [avatar] : [];
  const document = {
    body,
    querySelectorAll(selector) {
      if (selector === '[aria-label="Принять"]') return [accept];
      if (selector === '[aria-label="Отклонить"]') return [decline];
      return [];
    },
    querySelector: () => null,
  };
  const window = {
    adventuraDesktop: { updateCallPip: (state) => states.push(state) },
    getComputedStyle: (el) => ({ display: el.hidden ? 'none' : 'block', visibility: 'visible', opacity: '1', backgroundImage: 'none' }),
    setInterval: (fn) => { tick = fn; },
    setTimeout: (fn) => { const id = ++timerId; timers.set(id, fn); return id; },
    clearTimeout: (id) => timers.delete(id),
  };
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname, 'call-presence-inject.js'), 'utf8'), { window, document });
  tick();
  assert.equal(states[0].mode, 'incoming');
  assert.equal(states[0].peerName, 'Мария');
  assert.equal(states[0].avatarUrl, avatar.src);
  card.hidden = true;
  tick();
  // Ignore the initial startup tick and execute the debounce callback.
  const latest = Math.max(...timers.keys());
  timers.get(latest)();
  assert.equal(states.at(-1).visible, false);
});

test('active call forwards a remote video frame', () => {
  const states = [];
  let tick;
  const element = (parent = null) => ({
    nodeType: 1, parentElement: parent, isConnected: true, hidden: false,
    getAttribute: () => null, getClientRects: () => [{}],
    getBoundingClientRect: () => ({ width: 300, height: 200 }),
  });
  const body = Object.assign(element(), { innerText: 'Звонок · Мария' });
  const card = Object.assign(element(body), { innerText: 'Мария' });
  const video = Object.assign(element(card), { videoWidth: 640, videoHeight: 480, readyState: 4 });
  const hangup = element(body);
  const staleAccept = element(body);
  const staleDecline = element(body);
  const document = {
    body,
    querySelectorAll: (selector) => selector === 'video' ? [video] : selector === '[aria-label="Завершить звонок"]' ? [hangup] : selector === '[aria-label="Принять"]' ? [staleAccept] : selector === '[aria-label="Отклонить"]' ? [staleDecline] : [],
    querySelector: () => null,
    createElement: () => ({ getContext: () => ({ drawImage() {} }), toDataURL: () => 'data:image/jpeg;base64,FRAME' }),
  };
  const window = {
    adventuraDesktop: { updateCallPip: (state) => states.push(state) },
    getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1' }),
    setInterval: (fn) => { tick = fn; }, setTimeout: () => 1, clearTimeout() {},
  };
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname, 'call-presence-inject.js'), 'utf8'), { window, document });
  tick();
  assert.equal(states[0].peerName, 'Мария');
  assert.equal(states[0].mode, 'active');
  assert.equal(states[0].frameDataUrl, 'data:image/jpeg;base64,FRAME');
  assert.equal(states[0].hasVideo, true);
});
