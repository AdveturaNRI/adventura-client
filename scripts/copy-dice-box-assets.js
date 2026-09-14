#!/usr/bin/env node
/**
 * Copies @3d-dice/dice-box theme meshes + ESM bundles into Expo public/.
 * Uses /dice-box/* — Metro reserves /assets/*.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pkgDist = path.join(root, 'node_modules', '@3d-dice', 'dice-box', 'dist');
const assetsSrc = path.join(pkgDist, 'assets');
const assetsDest = path.join(root, 'public', 'dice-box');
const vendorDest = path.join(root, 'public', 'vendor', 'dice-box');
const diceRollerPath = path.join(assetsDest, 'dice-roller.html');

function copyRecursive(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const fromPath = path.join(from, entry.name);
    const toPath = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(fromPath, toPath);
    } else {
      fs.copyFileSync(fromPath, toPath);
    }
  }
}

if (!fs.existsSync(assetsSrc)) {
  console.warn('[copy-dice-box-assets] Package assets not found, skip.');
  process.exit(0);
}

// This app-owned iframe is intentionally co-located with the dice assets.
// Keep it while replacing package-owned assets during every postinstall.
const diceRollerHtml = fs.existsSync(diceRollerPath)
  ? fs.readFileSync(diceRollerPath)
  : null;

fs.rmSync(assetsDest, { recursive: true, force: true });
copyRecursive(assetsSrc, assetsDest);

if (diceRollerHtml) {
  fs.writeFileSync(diceRollerPath, diceRollerHtml);
}

// Clean preview scene for picker cards: die meshes only, no collider physics.
const DIE_NAMES = new Set(['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']);
const defaultTheme = path.join(assetsDest, 'themes', 'default', 'default.json');
if (fs.existsSync(defaultTheme)) {
  const data = JSON.parse(fs.readFileSync(defaultTheme, 'utf8'));
  if (Array.isArray(data.meshes)) {
    data.meshes = data.meshes
      .filter((m) => DIE_NAMES.has(String(m.name || '')))
      .map((m) => {
        const copy = { ...m };
        delete copy.physicsImpostor;
        delete copy.physicsMass;
        delete copy.physicsFriction;
        delete copy.physicsRestitution;
        return copy;
      });
  }
  delete data.gravity;
  delete data.colliderFaceMap;
  fs.writeFileSync(
    path.join(assetsDest, 'themes', 'default', 'preview.babylon'),
    JSON.stringify(data),
  );
}

fs.mkdirSync(vendorDest, { recursive: true });
for (const name of [
  'dice-box.es.min.js',
  'world.onscreen.min.js',
  'world.offscreen.min.js',
  'world.none.min.js',
]) {
  const src = path.join(pkgDist, name);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(vendorDest, name));
  }
}

console.log('[copy-dice-box-assets] → public/dice-box + public/vendor/dice-box');
