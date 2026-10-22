#!/usr/bin/env node
/**
 * Собирает классы из нормализованного дампа dnd.su →
 * src/data/handbook/dnd-classes.json (бандл приложения, офлайн).
 *
 * Usage:
 *   node scripts/handbook/build-dnd-classes.mjs
 *   node scripts/handbook/build-dnd-classes.mjs /path/to/run-…dump
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, '../..');
const repoRoot = path.resolve(clientRoot, '..');

const DEFAULT_DUMP = path.join(repoRoot, 'run-2026-10-12T08-18-07-224Z-0f2e957b');
const dumpRoot = path.resolve(process.argv[2] || DEFAULT_DUMP);
const outPath = path.join(clientRoot, 'src/data/handbook/dnd-classes.json');

const EDITIONS = [
  { folder: '5e2014', systemId: 'dnd5e-2014' },
  { folder: '5e2024', systemId: 'dnd5e-2024' },
];

/** Акценты «игровых» карточек по англ. имени класса. */
const CLASS_ACCENTS = {
  Artificer: '#B45309',
  Barbarian: '#9A3412',
  Bard: '#7C3AED',
  Cleric: '#CA8A04',
  Druid: '#3F6212',
  Fighter: '#9F1239',
  Monk: '#0F766E',
  Paladin: '#1D4ED8',
  Pugilist: '#C2410C',
  Ranger: '#166534',
  Rogue: '#334155',
  Sorcerer: '#BE185D',
  Warlock: '#6D28D9',
  Wizard: '#1E40AF',
};

const DEFAULT_CLASS_ACCENT = '#2F6B4F';

function shortBook(book) {
  if (!book) return '';
  const raw = String(book).trim();
  // PHB / PHB 2024 → единый RU-чип
  if (/^player'?s handbook(\s*2024)?$/i.test(raw)) {
    return 'Книга игрока';
  }
  let short = raw;
  if (short.length > 36) short = `${short.slice(0, 33)}…`;
  return short;
}

function coverUrlForClass(systemId, en, id) {
  const seed = `handbook-${systemId}-${(en || id || 'class')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')}`;
  return `https://picsum.photos/seed/${seed}/800/1200`;
}

function loadClasses(editionFolder, systemId) {
  const dir = path.join(dumpRoot, editionFolder, 'classes', 'normalized');
  if (!fs.existsSync(dir)) {
    throw new Error(`Нет папки классов: ${dir}`);
  }

  const files = fs
    .readdirSync(dir)
    .filter((name) => name.includes('_class_') && name.endsWith('.json'))
    .sort();

  const classes = [];
  for (const file of files) {
    const raw = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    const name = raw.name || {};
    const ru = String(name.ru || name.en || '?').trim();
    const en = String(name.en || '').trim();
    if (en.toLowerCase().includes('sidekick')) continue;

    const saves = Array.isArray(raw.savingThrows)
      ? raw.savingThrows.map(String).map((s) => s.trim()).filter(Boolean)
      : [];
    const source = raw.source || {};
    const book = source.book || '';
    const classification = source.classification || 'unknown';

    const tags = [];
    const bookTag = shortBook(book);
    if (bookTag) tags.push(bookTag);
    if (classification === 'official') tags.push('Официальный');
    else if (classification === 'homebrew') tags.push('Homebrew');

    const entryId = String(raw.id || '').replaceAll(':', '-');
    classes.push({
      id: entryId,
      systemId,
      category: 'classes',
      title: ru,
      summary: '',
      savingThrows: saves,
      tags,
      coverUrl: coverUrlForClass(systemId, en, entryId),
      accent: CLASS_ACCENTS[en] || DEFAULT_CLASS_ACCENT,
      _sortOfficial: classification === 'official' ? 0 : 1,
    });
  }

  classes.sort((a, b) => a._sortOfficial - b._sortOfficial || a.title.localeCompare(b.title, 'ru'));
  return classes.map(({ _sortOfficial, ...entry }) => entry);
}

const entries = EDITIONS.flatMap(({ folder, systemId }) => loadClasses(folder, systemId));

const payload = {
  version: 1,
  source: path.basename(dumpRoot),
  note: 'Классы dnd.su, сайдкики Tasha’s исключены. Бандлится в приложение — офлайн.',
  entries,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(`Wrote ${entries.length} classes → ${path.relative(clientRoot, outPath)}`);
