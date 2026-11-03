const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('../node_modules/typescript');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { backgroundThrottling: false, autoplayPolicy: 'no-user-gesture-required' } });
  try {
    await win.loadURL('data:text/html;charset=utf-8,<title>test</title>');
    const source = fs.readFileSync(path.join(__dirname, '../src/services/desktop/callPipCapture.ts'), 'utf8');
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    await win.webContents.executeJavaScript(`window.captureModule = (() => { const exports = {}; ${js}\nreturn exports; })(); void 0;`);
    const result = await win.webContents.executeJavaScript(`(async () => {
      window.ImageCapture = undefined;
      const c = document.createElement('canvas'); c.width = 320; c.height = 240;
      let n = 0; setInterval(() => { c.getContext('2d').fillStyle = '#' + (++n % 256).toString(16).padStart(2, '0') + '0000'; c.getContext('2d').fillRect(0, 0, 320, 240); }, 30);
      const stream = c.captureStream(25);
      const track = { mediaStreamTrack: stream.getVideoTracks()[0] };
      const p = { identity: 'remote', isLocal: false, screenShareTrack: track, videoTrack: null, cameraOn: false };
      const chosen = window.captureModule.pickCallPipVideo([p], 'remote');
      let count = 0;
      for (let i = 0; i < 10; i++) { if (await window.captureModule.captureVideoTrackFrame(track)) count++; await new Promise(r => setTimeout(r, 125)); }
      stream.getTracks().forEach(t => t.stop());
      return { count, screenShare: chosen.screenShare, selected: chosen.track === track };
    })()`);
    assert.equal(result.screenShare, true);
    assert.equal(result.selected, true);
    assert.ok(result.count >= 6, `Only ${result.count} frames captured`);
    console.log(`Screen share selected; captured ${result.count} of 10 frames: OK`);
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    win.destroy();
    app.exit(process.exitCode || 0);
  }
});
