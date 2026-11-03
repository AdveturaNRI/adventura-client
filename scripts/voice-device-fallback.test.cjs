const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

function load(file, requireMock = require, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, require: requireMock, setTimeout, clearTimeout, ...globals });
  return exports;
}
const { decideVoiceDeviceFallback, recoverVoiceInputToSystem, watchVoiceDeviceChanges } = load('src/utils/voice-device-fallback.ts');
const devices = [{ kind: 'audioinput', deviceId: 'default' }, { kind: 'audioinput', deviceId: 'internal' },
  { kind: 'audiooutput', deviceId: 'default' }, { kind: 'audiooutput', deviceId: 'speakers' }];
const base = { devices, preferredInput: 'usb-mic', preferredOutput: 'usb-headset', activeInput: 'usb-mic', activeOutput: 'usb-headset',
  inputEnded: true, mutedByUser: false, inputAlreadyDefault: false, outputAlreadyDefault: false };

test('lost microphone and headset fall back to system devices', () => {
  const result = decideVoiceDeviceFallback(base);
  assert.equal(result.input, true); assert.equal(result.inputReset, true); assert.equal(result.output, true);
});
test('device removal and track ending trigger recovery, and listeners are removed on exit', async () => {
  const devices = new EventTarget();
  const oldTrack = new EventTarget();
  const nextTrack = new EventTarget();
  let track = oldTrack, onTrackChange, calls = 0;
  const stop = watchVoiceDeviceChanges({
    devices, getTrack: () => track, listenTracks: (callback) => { onTrackChange = callback; return () => {}; },
    onChange: () => { calls++; }, debounceMs: 5,
  });
  const wait = () => new Promise((resolve) => setTimeout(resolve, 25));
  await wait();
  devices.dispatchEvent(new Event('devicechange'));
  devices.dispatchEvent(new Event('devicechange'));
  await wait(); assert.equal(calls, 2);
  oldTrack.dispatchEvent(new Event('ended'));
  await wait(); assert.equal(calls, 3);
  track = nextTrack; onTrackChange();
  oldTrack.dispatchEvent(new Event('ended'));
  await wait(); assert.equal(calls, 3);
  nextTrack.dispatchEvent(new Event('ended'));
  await wait(); assert.equal(calls, 4);
  stop();
  devices.dispatchEvent(new Event('devicechange'));
  nextTrack.dispatchEvent(new Event('ended'));
  await wait(); assert.equal(calls, 4);
});
test('a muted microphone is prepared for default but never automatically enabled', () => {
  const result = decideVoiceDeviceFallback({ ...base, mutedByUser: true });
  assert.equal(result.input, false); assert.equal(result.inputReset, true);
});
test('a muted but still present device does not switch just because its track stopped', () => {
  const result = decideVoiceDeviceFallback({ ...base, devices: [...devices, { kind: 'audioinput', deviceId: 'usb-mic' }], mutedByUser: true });
  assert.equal(result.inputReset, false);
});
test('do not keep switching an already recovered default device', () => {
  const result = decideVoiceDeviceFallback({ ...base, activeInput: 'default', activeOutput: 'default', inputEnded: false, inputAlreadyDefault: true, outputAlreadyDefault: true });
  assert.equal(result.input, false); assert.equal(result.output, false);
});
test('recover again if a replacement system device is also removed', () => {
  const result = decideVoiceDeviceFallback({ ...base, inputEnded: false, inputAlreadyDefault: true, outputAlreadyDefault: true });
  assert.equal(result.input, true); assert.equal(result.output, true);
});
test('empty device enumeration does not misidentify permission-limited devices', () => {
  const result = decideVoiceDeviceFallback({ ...base, devices: [], inputEnded: false });
  assert.equal(result.input, false); assert.equal(result.output, false);
});
test('recovery switches to default and restores processing', async () => {
  const calls = [];
  const result = await recoverVoiceInputToSystem({
    switchToDefault: async () => calls.push('default'), isCurrent: () => true, isMutedByUser: () => false,
    restoreTrack: async () => calls.push('restore'), applyProcessing: async () => calls.push('processing'), enforceMute: async () => calls.push('mute'),
  });
  assert.equal(result, 'recovered'); assert.deepEqual(calls, ['default', 'restore', 'processing']);
});
test('disconnecting a device never enables a microphone muted by the user', async () => {
  const calls = [];
  const result = await recoverVoiceInputToSystem({
    switchToDefault: async () => calls.push('default'), isCurrent: () => true, isMutedByUser: () => true,
    restoreTrack: async () => calls.push('restore'), applyProcessing: async () => calls.push('processing'), enforceMute: async () => calls.push('mute'),
  });
  assert.equal(result, 'prepared'); assert.deepEqual(calls, ['default', 'mute']);
});
test('muting during recovery switches the microphone back off', async () => {
  const calls = []; let muted = false;
  const result = await recoverVoiceInputToSystem({
    switchToDefault: async () => calls.push('default'), isCurrent: () => true, isMutedByUser: () => muted,
    restoreTrack: async () => { calls.push('restore'); muted = true; },
    applyProcessing: async () => calls.push('processing'), enforceMute: async () => calls.push('mute'),
  });
  assert.equal(result, 'prepared'); assert.deepEqual(calls, ['default', 'restore', 'mute']);
});
test('muting while the system device is being selected prevents restoring audio', async () => {
  const calls = []; let muted = false;
  const result = await recoverVoiceInputToSystem({
    switchToDefault: async () => { calls.push('default'); muted = true; }, isCurrent: () => true, isMutedByUser: () => muted,
    restoreTrack: async () => calls.push('restore'), applyProcessing: async () => calls.push('processing'), enforceMute: async () => calls.push('mute'),
  });
  assert.equal(result, 'prepared'); assert.deepEqual(calls, ['default', 'mute']);
});
test('leaving the call stops recovery before a new microphone can start', async () => {
  const calls = [];
  const result = await recoverVoiceInputToSystem({
    switchToDefault: async () => calls.push('default'), isCurrent: () => false, isMutedByUser: () => false,
    restoreTrack: async () => calls.push('restore'), applyProcessing: async () => calls.push('processing'), enforceMute: async () => calls.push('mute'),
  });
  assert.equal(result, 'cancelled'); assert.deepEqual(calls, ['default']);
});
test('resetting an audio element uses the browser default sink', async () => {
  class HTMLMediaElement { async setSinkId(id) { this.sink = id; } }
  const mockRequire = (id) => id === 'react-native' ? { Platform: { OS: 'web' } } : {};
  const module = load('src/utils/voice-media-devices.ts', mockRequire, { HTMLMediaElement });
  const element = new HTMLMediaElement();
  await module.applyAudioOutputToElement(element, null);
  assert.equal(element.sink, '');
});
