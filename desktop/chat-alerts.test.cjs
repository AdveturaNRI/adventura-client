const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('an open chat is not considered focused while another application has focus', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/utils/chat-alerts.js'), 'utf8')
    .replace(/^import .*;\r?\n/gm, '')
    .replace(/\bexport\s+/g, '');
  const document = { visibilityState: 'visible', hasFocus: () => false };
  const context = { Platform: { OS: 'web' }, document, window: {}, setInterval, clearInterval };
  vm.runInNewContext(source + `\nsetFocusedChatConversation('chat-1');`, context);
  assert.equal(vm.runInNewContext(`isChatConversationFocused('chat-1')`, context), false);
  document.hasFocus = () => true;
  assert.equal(vm.runInNewContext(`isChatConversationFocused('chat-1')`, context), true);
});
