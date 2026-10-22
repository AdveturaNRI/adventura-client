#!/usr/bin/env node
/**
 * Embeds assets/dice/*.svg into src/components/dice/die-svg-assets.ts
 * for runtime SvgXml rendering (no baked preview images).
 *
 * Usage: node scripts/embed-dice-svgs.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const srcDir = path.join(root, 'assets/dice');
const outPath = path.join(root, 'src/components/dice/die-svg-assets.ts');

const DIES = [
  [4, 'd4'],
  [6, 'd6'],
  [8, 'd8'],
  [10, 'd10'],
  [12, 'd12'],
  [20, 'd20'],
  [100, 'd100'],
];

const lines = [];
lines.push(`import type { DieGlyphSides } from '@/components/dice/DieGlyph';`);
lines.push('');
lines.push(`/** Raw SVG markup from assets/dice — tinted at runtime in DieMeshPreview. */`);
lines.push(`export const DIE_SVG_BY_SIDES: Record<DieGlyphSides, string> = {`);

for (const [sides, name] of DIES) {
  const filePath = path.join(srcDir, `${name}.svg`);
  if (!fs.existsSync(filePath)) {
    console.warn('[embed-dice-svgs] missing', filePath);
    continue;
  }
  const xml = fs.readFileSync(filePath, 'utf8').trim();
  lines.push(`  ${sides}: ${JSON.stringify(xml)},`);
}

lines.push(`};`);
lines.push('');

fs.writeFileSync(outPath, lines.join('\n'));
console.log(`[embed-dice-svgs] wrote ${outPath}`);
