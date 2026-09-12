#!/usr/bin/env node
/**
 * Export menu icons from Figma into assets/ui/menu/.
 *
 * Usage:
 *   FIGMA_ACCESS_TOKEN=xxx node scripts/export-figma-menu-icons.mjs
 *
 * File: https://www.figma.com/design/xaDiVQeAMtjgt99yoHJfXv/Untitled
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE_KEY = 'xaDiVQeAMtjgt99yoHJfXv';
const TOKEN = process.env.FIGMA_ACCESS_TOKEN;

const ICON_NODES = {
  profile: '13:355',
  dragon: '13:364',
  notifications: '13:399',
  settings: '13:393',
  master: '14:451',
  telegram: '14:454',
  support: '14:467',
  developer: '14:482',
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../assets/ui/menu');

if (!TOKEN) {
  console.error('Set FIGMA_ACCESS_TOKEN to export icons from Figma.');
  process.exit(1);
}

const ids = Object.values(ICON_NODES).join(',');
const imagesUrl = `https://api.figma.com/v1/images/${FILE_KEY}?ids=${encodeURIComponent(ids)}&format=svg`;

const imagesRes = await fetch(imagesUrl, {
  headers: { 'X-Figma-Token': TOKEN },
});

if (!imagesRes.ok) {
  console.error('Figma images API failed:', imagesRes.status, await imagesRes.text());
  process.exit(1);
}

const { images } = await imagesRes.json();
fs.mkdirSync(outDir, { recursive: true });

for (const [name, nodeId] of Object.entries(ICON_NODES)) {
  const url = images[nodeId];
  if (!url) {
    console.warn(`No export URL for ${name} (${nodeId})`);
    continue;
  }

  const svgRes = await fetch(url);
  if (!svgRes.ok) {
    console.warn(`Failed to download ${name}:`, svgRes.status);
    continue;
  }

  const svg = await svgRes.text();
  fs.writeFileSync(path.join(outDir, `${name}.svg`), svg);
  console.log(`saved ${name}.svg`);
}

console.log('Done. Run: node scripts/generate-menu-icon-assets.mjs');
