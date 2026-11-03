const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../src/utils/voice-call-start.ts'), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const exportsObject = {};
vm.runInNewContext(js, { exports: exportsObject });
const { resolveVoiceCallStart } = exportsObject;

test('only the specific ended call error triggers recovery', () => {
  assert.equal(exportsObject.isEndedCallError({ status: 404, message: 'Звонок уже завершён' }), true);
  assert.equal(exportsObject.isEndedCallError({ status: 404, message: 'Чат не найден' }), false);
  assert.equal(exportsObject.isEndedCallError({ status: 403, message: 'Звонок уже завершён' }), false);
  assert.equal(exportsObject.isCallAlreadyActiveError({ status: 400, message: 'В этом чате уже идёт звонок' }), true);
});

function operations(overrides = {}) {
  return { getActive: async () => null, isGroup: () => false, end: async () => {},
    join: async () => 'joined', invite: async () => ({ callId: 'new' }),
    isAlreadyActiveError: (error) => error?.message === 'busy', markEnded() {}, clearEnded() {}, ...overrides };
}

test('a call that ends after the active check is retried as a new call', async () => {
  let reads = 0, joins = 0, invites = 0;
  const result = await resolveVoiceCallStart(operations({
    getActive: async () => ++reads === 1 ? { callId: 'old', joinedCount: 2 } : null,
    join: async () => { joins++; return 'ended'; },
    invite: async () => { invites++; return { callId: 'new' }; },
  }));
  assert.equal(result.kind, 'invited');
  assert.equal(result.invite.callId, 'new');
  assert.equal(reads, 2); assert.equal(joins, 1); assert.equal(invites, 1);
});

test('a concurrent new call is joined instead of inviting twice', async () => {
  let reads = 0, invites = 0, joined;
  const result = await resolveVoiceCallStart(operations({
    getActive: async () => ++reads === 1 ? null : { callId: 'other', joinedCount: 1 },
    invite: async () => { invites++; throw new Error('busy'); },
    join: async (active) => { joined = active.callId; return 'joined'; },
  }));
  assert.equal(result.kind, 'joined'); assert.equal(joined, 'other'); assert.equal(invites, 1);
});

test('after an expired call it joins the replacement rather than ringing again', async () => {
  let reads = 0, invites = 0;
  const joined = [];
  const result = await resolveVoiceCallStart(operations({
    getActive: async () => ({ callId: ++reads === 1 ? 'expired' : 'replacement', joinedCount: 2 }),
    join: async (active) => { joined.push(active.callId); return active.callId === 'expired' ? 'ended' : 'joined'; },
    invite: async () => { invites++; },
  }));
  assert.equal(result.kind, 'joined');
  assert.deepEqual(joined, ['expired', 'replacement']);
  assert.equal(invites, 0);
});

test('a live group remaining after leaving a solo lobby is rejoined', async () => {
  const lobby = { callId: 'group', joinedCount: 1, isJoined: true };
  let ends = 0, invites = 0, joins = 0;
  const result = await resolveVoiceCallStart(operations({
    getActive: async () => lobby, isGroup: () => true,
    end: async () => { ends++; }, join: async () => { joins++; return 'joined'; },
    invite: async () => { invites++; },
  }));
  assert.equal(result.kind, 'joined'); assert.equal(ends, 1); assert.equal(joins, 1); assert.equal(invites, 0);
});

test('unexpected invite errors are surfaced without retrying', async () => {
  let invites = 0;
  await assert.rejects(resolveVoiceCallStart(operations({ invite: async () => { invites++; throw new Error('offline'); } })), /offline/);
  assert.equal(invites, 1);
});
