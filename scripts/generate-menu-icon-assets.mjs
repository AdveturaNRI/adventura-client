#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.resolve(__dirname, '../assets/icons');
const fallbackDir = path.resolve(__dirname, '../assets/ui/menu');
const out = path.resolve(__dirname, '../src/components/ui/navigation/menu-icon-assets.ts');

const MENU_ICON_FILES = {
  profile: 'Vector.svg',
  dragon: 'dragon-head-evil-legend-myth-svgrepo-com 1.svg',
  notifications: 'notification-bell-alarm 1.svg',
  settings: 'setting (1) 1.svg',
  master: 'dice-shield 1.svg',
  telegram: 'telegram 1.svg',
  support: 'support.svg',
  developer: 'developer.svg',
};

function readSvg(key, filename) {
  const primary = path.join(iconsDir, filename);
  if (fs.existsSync(primary)) {
    return fs.readFileSync(primary, 'utf8').trim();
  }

  const fallback = path.join(fallbackDir, `${key}.svg`);
  if (fs.existsSync(fallback)) {
    console.warn(`Using fallback for ${key}: ${fallback}`);
    return fs.readFileSync(fallback, 'utf8').trim();
  }

  console.warn(`Missing icon for ${key}`);
  return null;
}

const svgs = {};
for (const [key, filename] of Object.entries(MENU_ICON_FILES)) {
  const svg = readSvg(key, filename);
  if (svg) {
    svgs[key] = svg;
  }
}

const content = `import type { MenuIconKey } from './menu.config';

export const MENU_ICON_SVGS: Record<MenuIconKey, string> = ${JSON.stringify(svgs, null, 2)};
`;

fs.writeFileSync(out, content);
console.log(`Generated ${out}`);
