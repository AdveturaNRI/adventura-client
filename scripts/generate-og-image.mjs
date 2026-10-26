#!/usr/bin/env node
/**
 * Renders public/og-image.png (1200×630) — the link preview for messengers and search.
 * Usage: CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node scripts/generate-og-image.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const chromePath =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const logo = readFileSync(join(root, 'public/icons/icon-512.png')).toString('base64');

const chips = ['Поиск игроков', 'Игры по D&D', 'Звонки для партии', 'Кубики d20'];

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; overflow: hidden; background: #0B111B;
    font-family: -apple-system, "SF Pro Display", "Segoe UI", Roboto, sans-serif; color: #fff; position: relative; }
  .glow { position: absolute; border-radius: 50%; filter: blur(110px); opacity: .75; }
  .g1 { width: 620px; height: 620px; background: rgba(149,98,245,.45); top: -280px; left: -200px; }
  .g2 { width: 620px; height: 620px; background: rgba(21,122,254,.45); bottom: -320px; right: -160px; }
  .wrap { position: relative; height: 100%; padding: 72px 80px; display: flex; flex-direction: column; justify-content: space-between; }
  .brand { display: flex; align-items: center; gap: 18px; font-size: 40px; font-weight: 800; letter-spacing: -0.5px; }
  .brand img { width: 72px; height: 72px; }
  h1 { font-size: 68px; line-height: 1.05; font-weight: 800; letter-spacing: -2px; max-width: 980px; }
  .chips { display: flex; gap: 14px; flex-wrap: wrap; }
  .chip { padding: 12px 22px; border-radius: 999px; font-size: 24px; font-weight: 600;
    color: #84B9FF; background: rgba(21,122,254,.16); border: 1px solid rgba(21,122,254,.4); }
  .url { position: absolute; right: 80px; top: 92px; font-size: 26px; color: #B7C2D0; }
</style></head><body>
  <div class="glow g1"></div><div class="glow g2"></div>
  <div class="wrap">
    <div class="brand"><img src="data:image/png;base64,${logo}">Adventura</div>
    <h1>Игроки, мастера и кубики для D&amp;D и НРИ</h1>
    <div class="chips">${chips.map((chip) => `<span class="chip">${chip.replace('&', '&amp;')}</span>`).join('')}</div>
  </div>
  <div class="url">adventu.ru</div>
</body></html>`;

const browser = await puppeteer.launch({ executablePath: chromePath, headless: true });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.screenshot({ path: join(root, 'public/og-image.png'), type: 'png' });
  console.log('[og] public/og-image.png');
} finally {
  await browser.close();
}
