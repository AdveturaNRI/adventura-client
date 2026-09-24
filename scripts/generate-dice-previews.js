#!/usr/bin/env node
/**
 * Bakes static die preview PNGs from @3d-dice theme meshes (same look as picker).
 * Output: public/dice-previews/{RRGGBB}/d20.png …
 *
 * Usage: node scripts/generate-dice-previews.mjs
 * Needs Google Chrome (macOS path below) or CHROME_PATH.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const root = path.join(__dirname, '..');
const publicDir = path.join(root, 'public');
const outDir = path.join(publicDir, 'dice-previews');

const CHROME =
  process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js')) return 'application/javascript';
  if (filePath.endsWith('.json') || filePath.endsWith('.babylon')) return 'application/json';
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      const safe = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
      const filePath = path.join(publicDir, safe === '/' ? 'dice-preview-bake.html' : safe);
      if (!filePath.startsWith(publicDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404);
        res.end('missing');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType(filePath) });
      fs.createReadStream(filePath).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, port });
    });
  });
}

async function main() {
  if (!fs.existsSync(CHROME)) {
    console.error('[generate-dice-previews] Chrome not found at', CHROME);
    process.exit(1);
  }

  let puppeteer;
  try {
    puppeteer = require('puppeteer-core');
  } catch {
    console.error('[generate-dice-previews] Install puppeteer-core: npm i -D puppeteer-core');
    process.exit(1);
  }

  const previewBabylon = path.join(publicDir, 'dice-box', 'themes', 'default', 'preview.babylon');
  if (!fs.existsSync(previewBabylon)) {
    console.error('[generate-dice-previews] Run postinstall / copy-dice-box-assets first');
    process.exit(1);
  }

  const { server, port } = await startServer();
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: [
      '--use-angle=swiftshader',
      '--enable-webgl',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
      '--no-sandbox',
    ],
  });

  try {
    const page = await browser.newPage();
    page.on('console', (msg) => {
      const text = msg.text();
      if (text) console.log('[bake]', text);
    });
    page.on('pageerror', (err) => console.error('[bake pageerror]', err));

    await page.goto(`http://127.0.0.1:${port}/dice-preview-bake.html`, {
      waitUntil: 'networkidle0',
      timeout: 120000,
    });

    await page.waitForFunction(
      () => window.__DICE_PREVIEW_BAKE__ && (window.__DICE_PREVIEW_BAKE__.done || window.__DICE_PREVIEW_BAKE__.error),
      { timeout: 600000 },
    );

    const result = await page.evaluate(() => window.__DICE_PREVIEW_BAKE__);
    if (result.error) {
      throw new Error(result.error);
    }

    fs.rmSync(outDir, { recursive: true, force: true });
    let count = 0;
    for (const [rel, dataUrl] of Object.entries(result.files)) {
      const match = /^data:image\/png;base64,(.+)$/.exec(dataUrl);
      if (!match) continue;
      const dest = path.join(outDir, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, Buffer.from(match[1], 'base64'));
      count += 1;
    }
    console.log(`[generate-dice-previews] wrote ${count} files → public/dice-previews`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
