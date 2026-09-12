#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.resolve(__dirname, '../assets/icons');
const out = path.resolve(__dirname, '../src/components/ui/navigation/navbar-icon-assets.ts');

const NAVBAR_ICON_FILES = {
  wanderers: 'user-search 1.svg',
  games: 'dragon-head-evil-legend-myth-svgrepo-com 1.svg',
  chats: 'message 1.svg',
  profile: 'Vector.svg',
};

const svgs = {};
for (const [key, filename] of Object.entries(NAVBAR_ICON_FILES)) {
  const file = path.join(iconsDir, filename);
  if (!fs.existsSync(file)) {
    console.warn(`Missing ${file}`);
    continue;
  }
  svgs[key] = fs.readFileSync(file, 'utf8').trim();
}

const content = `export type NavbarIconKey = ${Object.keys(NAVBAR_ICON_FILES).map((k) => `'${k}'`).join(' | ')};\n\nexport const NAVBAR_ICON_SVGS: Record<NavbarIconKey, string> = ${JSON.stringify(svgs, null, 2)};\n`;

fs.writeFileSync(out, content);
console.log(`Generated ${out}`);
