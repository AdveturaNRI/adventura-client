// Run with Electron: exercise the legacy page watcher with a live video element.
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1000, height: 700, webPreferences: { backgroundThrottling: false, autoplayPolicy: 'no-user-gesture-required' } });
  try {
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent('<!doctype html><body><div>Звонок · Мария</div><button aria-label="Завершить звонок">Завершить</button><div><video id="video" width="320" height="240" muted autoplay></video><div>Мария</div></div></body>'));
    await win.webContents.executeJavaScript(`(async () => {
      window.capturedStates = [];
      window.adventuraDesktop = { updateCallPip: state => window.capturedStates.push(state) };
      const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 240;
      canvas.getContext('2d').fillRect(0, 0, 320, 240);
      let frameNo = 0;
      window.testDraw = setInterval(() => { canvas.getContext('2d').fillStyle = '#' + (++frameNo % 256).toString(16).padStart(2, '0') + '0000'; canvas.getContext('2d').fillRect(0, 0, 320, 240); }, 35);
      window.testStream = canvas.captureStream(25);
      const video = document.getElementById('video'); video.srcObject = window.testStream;
      await video.play();
    })()`);
    await win.webContents.executeJavaScript(fs.readFileSync(path.join(__dirname, 'call-presence-inject.js'), 'utf8'));
    await new Promise((resolve) => setTimeout(resolve, 1800));
    const result = await win.webContents.executeJavaScript(`window.capturedStates.find(state => state.hasVideo) || null`);
    if (!result) console.log(await win.webContents.executeJavaScript(`({states: window.capturedStates, width: video.videoWidth, height: video.videoHeight, ready: video.readyState, rects: video.getClientRects().length})`));
    assert.ok(result && result.frameDataUrl.startsWith('data:image/jpeg;base64,'));
    assert.equal(result.peerName, 'Мария');
    const frameCount = await win.webContents.executeJavaScript('window.capturedStates.filter(state => state.hasVideo).length');
    assert.ok(frameCount >= 6, `Expected at least 6 frames, got ${frameCount}`);
    console.log(`Captured ${frameCount} video frames in 1.8 seconds`);
    console.log('Remote video frame reaches the call window: OK');
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    win.destroy();
    app.exit(process.exitCode || 0);
  }
});
