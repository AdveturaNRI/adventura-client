const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

test('automatic location attempt is claimed once per session', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/components/map/clubs-map-session.ts'), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, require: () => ({ MAP_DEFAULT_CENTER: [55.75, 37.62], MAP_DEFAULT_ZOOM: 10 }) });
  assert.equal(exports.beginClubsMapInitialLocate(), true);
  assert.equal(exports.beginClubsMapInitialLocate(), false);
  assert.equal(exports.getClubsMapSession().didInitialLocate, true);
});
