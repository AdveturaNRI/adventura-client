#!/usr/bin/env node
/**
 * Tints hand-drawn dice SVGs (assets/dice/*.svg) into
 * public/dice-previews/{RRGGBB}/dN.svg for each accent in the dice palette.
 *
 * Face fills are grayscale hex; numerals stay white.
 *
 * Usage: node scripts/colorize-dice-previews.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const srcDir = path.join(root, 'assets/dice');
const outRoot = path.join(root, 'public/dice-previews');

const DIES = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'];
const PALETTE = [
  '#157AFE',
  '#E53935',
  '#43A047',
  '#FB8C00',
  '#8E24AA',
  '#00ACC1',
  '#F9A825',
  '#F5F0E6',
  '#455A64',
  '#212121',
];

function parseHex(hex) {
  const h = hex.replace('#', '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function toHex([r, g, b]) {
  return (
    '#' +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

function luminance([r, g, b]) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Map grayscale face fill → accent shade; keep white numerals. */
function tintFaceHex(faceHex, accentRgb, maxFaceLum) {
  const face = parseHex(faceHex);
  const lum = luminance(face);
  // Near-white face highlights stay a bit brighter than flat multiply.
  const t = Math.pow(lum / (maxFaceLum || 255), 0.9);
  return toHex([
    accentRgb[0] * t,
    accentRgb[1] * t,
    accentRgb[2] * t,
  ]);
}

function colorizeSvg(svgText, accentRgb) {
  const faceHexes = new Set();
  const re = /fill="(#[0-9A-Fa-f]{3,8})"/g;
  let m;
  while ((m = re.exec(svgText))) {
    const hex = m[1];
    if (hex.toLowerCase() === '#fff' || hex.toLowerCase() === '#ffffff') continue;
    faceHexes.add(hex);
  }

  let maxFaceLum = 0;
  for (const hex of faceHexes) {
    maxFaceLum = Math.max(maxFaceLum, luminance(parseHex(hex)));
  }
  if (maxFaceLum < 1) maxFaceLum = 189; // #BDBDBD

  let out = svgText;
  for (const hex of faceHexes) {
    const tinted = tintFaceHex(hex, accentRgb, maxFaceLum);
    // Replace fill="…" only (not clipPath white rects — those use fill="white").
    out = out.split(`fill="${hex}"`).join(`fill="${tinted}"`);
  }
  return out;
}

let count = 0;
for (const hex of PALETTE) {
  const folder = hex.slice(1).toUpperCase();
  const outDir = path.join(outRoot, folder);
  fs.mkdirSync(outDir, { recursive: true });
  const accent = parseHex(hex);

  for (const die of DIES) {
    const srcPath = path.join(srcDir, `${die}.svg`);
    if (!fs.existsSync(srcPath)) {
      console.warn('[colorize-dice-previews] missing', srcPath);
      continue;
    }
    const src = fs.readFileSync(srcPath, 'utf8');
    const tinted = colorizeSvg(src, accent);
    fs.writeFileSync(path.join(outDir, `${die}.svg`), tinted);
    count += 1;
  }
}

console.log(`[colorize-dice-previews] wrote ${count} SVGs → public/dice-previews`);
