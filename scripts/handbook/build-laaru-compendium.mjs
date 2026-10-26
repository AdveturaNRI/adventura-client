#!/usr/bin/env node
/**
 * Лёгкий индекс из модуля Foundry Laaru•Compendium (LevelDB packs):
 * классы, расы, происхождения, заклинания → src/data/handbook/laaru/*.json
 *
 * Без HTML. Обложки классов — свои в assets/handbook/classes.
 * Портреты рас — из модуля (assets/images/pic/race_*) → assets/handbook/races
 * + сгенерированный require-маппинг race-covers.generated.ts
 *
 * Usage:
 *   node scripts/handbook/build-laaru-compendium.mjs
 *   node scripts/handbook/build-laaru-compendium.mjs /path/to/laaru-dnd5-hw
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ClassicLevel } from 'classic-level';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, '../..');
const DEFAULT_MODULE = path.join(os.homedir(), 'Downloads', 'laaru-dnd5-hw');
const moduleRoot = path.resolve(process.argv[2] || process.env.LAARU_MODULE || DEFAULT_MODULE);
const outDir = path.join(clientRoot, 'src/data/handbook/laaru');
const raceAssetsDir = path.join(clientRoot, 'assets/handbook/races');
const raceCoversOut = path.join(clientRoot, 'src/data/handbook/race-covers.generated.ts');
const cropRaceFramesPy = path.join(__dirname, 'crop-laaru-race-frames.py');

const SYSTEM_ID = 'dnd5e-2014';

const SCHOOL_RU = {
  abj: 'Ограждение',
  con: 'Вызов',
  div: 'Прорицание',
  enc: 'Очарование',
  evo: 'Воплощение',
  ill: 'Иллюзия',
  nec: 'Некромантия',
  trs: 'Преобразование',
};

const SAVE_RU = {
  str: 'Сила',
  dex: 'Ловкость',
  con: 'Телосложение',
  int: 'Интеллект',
  wis: 'Мудрость',
  cha: 'Харизма',
};

const BOOK_RU = {
  PHB: 'Книга игрока',
  'Player Handbook': 'Книга игрока',
  "Player's Handbook": 'Книга игрока',
  TCE: 'Таша',
  XGE: 'Занатар',
  SCAG: 'Побережье Меча',
  EEPC: 'Элементальное зло',
  VGM: 'Воло',
  MTF: 'Морденкайнен',
  MPMM: 'Монстры мультивселенной',
  FTD: 'Физикум',
  SCC: 'Стриксхейвен',
  EGW: 'Эберрон',
  AI: 'Аквирер',
  GGR: 'Равника',
};

const CLASS_ACCENTS = {
  artificer: '#B45309',
  barbarian: '#9A3412',
  bard: '#7C3AED',
  cleric: '#CA8A04',
  druid: '#3F6212',
  fighter: '#9F1239',
  monk: '#0F766E',
  paladin: '#1D4ED8',
  ranger: '#166534',
  rogue: '#334155',
  sorcerer: '#BE185D',
  warlock: '#6D28D9',
  wizard: '#1E40AF',
  'blood-hunter': '#7F1D1D',
};

const SIDEKICK_IDS = new Set(['expert', 'warrior', 'spellcaster', 'doggo', 'steed']);

function stripHtml(html = '') {
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<\/?(br|p|div|li|tr|h\d)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim();
}

/** Короткий текст для карточки; заклинаниям summary не пишем. */
function shortBlurb(html, max = 110) {
  let t = stripHtml(html);
  t = t.replace(/^Описание[^\n]{0,100}\n?/i, '').trim();
  t = t.replace(/^\([^)]*нажмите[^)]*\)\s*/i, '').trim();
  const parts = t
    .split(/\n+/)
    .map((s) => s.trim())
    .filter((p) => p.length > 24 && !/нажмите/i.test(p));
  let body = parts[0] || '';
  body = body.replace(/\s+/g, ' ').trim();
  if (!body) return '';
  if (body.length <= max) return body;
  const cut = body.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > 50 ? cut.slice(0, sp) : cut).trim()}…`;
}

const RACE_BLURB_MAX = 180;
const RACE_BLURB_HARD_MAX = 240;

/** `@Compendium[id]{скальными гномами}` → «скальными гномами», броски `[[/r d8]]` — прочь. */
function stripFoundryRefs(text) {
  return String(text)
    .replace(/@\w+\[[^\]]*\]\{([^}]*)\}/g, '$1')
    .replace(/@\w+\[[^\]]*\]/g, '')
    .replace(/\[\[[^\]]*\]\]/g, '');
}

function htmlParagraphs(html) {
  const source = String(html || '');
  // Описание лежит в <details>; после него идут таблицы особенностей — их не трогаем.
  const details = source.match(/<details\b[^>]*>([\s\S]*?)<\/details>/i);
  const body = (details ? details[1] : source)
    .replace(/<summary[\s\S]*?<\/summary>/gi, '')
    .replace(/<table[\s\S]*?<\/table>/gi, '');
  const blocks = body.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) || [];
  return blocks.map((raw) => {
    const inner = raw.replace(/^<p\b[^>]*>/i, '').replace(/<\/p>$/i, '');
    const text = stripHtml(stripFoundryRefs(inner.replace(/<br\s*\/?>/gi, ' ')))
      .replace(/\u00ad/g, '')
      .replace(/\s+/g, ' ')
      .replace(/ —(?=\S)/g, ' — ')
      .trim();
    return {
      text,
      alignedRight: /text-align:\s*right/i.test(raw),
      italicOnly: /^\s*["«“]?\s*<em>[\s\S]*<\/em>\s*["»”]?\s*$/i.test(inner),
    };
  }).filter((p) => p.text);
}

/** Первый абзац самого описания: без эпиграфа, подписи к нему и «нажмите…». */
function raceLeadParagraph(html) {
  const ps = htmlParagraphs(html);
  const isAttribution = (p) => p && (p.alignedRight || /^[—–]\s/.test(p.text));
  // Подпись без выравнивания («Ричард Ли Байерс „Чёрный букет“») и заголовки-абзацы.
  const isCaption = (p) => p.text.length < 80 && !/[.!?…:]/.test(p.text);
  for (let i = 0; i < ps.length; i += 1) {
    const p = ps[i];
    if (p.text.length < 25 || isAttribution(p) || isCaption(p)) continue;
    if (p.italicOnly || /^["«“]/.test(p.text) || /нажмите/i.test(p.text)) continue;
    if (isAttribution(ps[i + 1])) continue;
    return p.text.endsWith(':') && ps[i + 1] ? `${p.text} ${ps[i + 1].text}` : p.text;
  }
  return '';
}

function splitSentences(text) {
  return (text.match(/[^.!?…]+(?:[.!?…]+["»”)]*|$)/g) || []).map((s) => s.trim()).filter(Boolean);
}

/**
 * Лид расы для плитки: целые предложения до ~180 символов.
 * Слишком длинное первое предложение режем по «;», и только в крайнем случае — по слову.
 */
function raceBlurb(html) {
  const sentences = splitSentences(raceLeadParagraph(html));
  let out = '';
  for (const sentence of sentences) {
    const next = out ? `${out} ${sentence}` : sentence;
    const tooShort = out.length > 0 && out.length < 60 && next.length <= 220;
    if (out && next.length > RACE_BLURB_MAX && !tooShort) break;
    out = next;
  }
  if (out.length <= RACE_BLURB_HARD_MAX) return out;
  const clause = out.slice(0, RACE_BLURB_HARD_MAX).lastIndexOf(';');
  if (clause > 60) return `${out.slice(0, clause).trim()}.`;
  const cut = out.slice(0, RACE_BLURB_HARD_MAX - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[\s,;:—–-]+$/, '')}…`;
}

/** Латинские «двойники» кириллицы в заголовках (Mетка → Метка). */
function fixLookalikeCyrillic(text) {
  return String(text || '')
    .replace(/^M(?=етк)/, 'М')
    .replace(/^H(?=апарник)/i, 'Н')
    .replace(/^A(?=втогном)/, 'А');
}

function ruTitle(name) {
  return fixLookalikeCyrillic(
    String(name || '')
      .replace(/\s*\/\s*[A-Za-zÀ-ÿ].*$/, '')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

function looksLikeRuTranslit(word) {
  return /yj$|ij$|yy$|aya$|uyu$|ogo$|emu$|nik$|tel$|shij|ckij|skij|nyy|zh|kh|shch|sch|ov$|ev$|in$|iaf$|ia$/.test(
    word,
  );
}

/** Англ. часть из «Раса / Race Name» или из латинского identifier (без транслита). */
function enSubtitle(name, identifier = '') {
  const m = String(name || '').match(/\s*\/\s*([A-Za-zÀ-ÿ][\w '’\-]*)$/);
  if (m) return m[1].trim();
  const id = String(identifier || '').trim();
  if (!id || /[^a-z0-9\-']/i.test(id)) return '';
  const parts = id
    .split(/[-_]+/)
    .filter(Boolean)
    .filter((w) => !looksLikeRuTranslit(w.toLowerCase()));
  if (parts.length === 0) return '';
  return parts.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

const BOOK_CODE = {
  PHB: 'PHB',
  'Player Handbook': 'PHB',
  "Player's Handbook": 'PHB',
  TCE: 'TCE',
  XGE: 'XGE',
  VGM: 'VGM',
  MTF: 'MTF',
  MPMM: 'MPMM',
  SCAG: 'SCAG',
  EEPC: 'EEPC',
  FTD: 'FTD',
  SCC: 'SCC',
  EGW: 'EGW',
  GGR: 'GGR',
  ERLW: 'ERLW',
  AI: 'AI',
};

function bookCode(source = {}) {
  const raw = String(source.book || source.custom || '').trim();
  if (!raw) return '';
  if (BOOK_CODE[raw]) return BOOK_CODE[raw];
  if (/^player'?s?\s*handbook/i.test(raw)) return 'PHB';
  const upper = raw.toUpperCase();
  if (/^[A-Z0-9]{2,6}$/.test(upper)) return upper;
  return raw.length > 8 ? raw.slice(0, 8) : raw;
}

function bookTag(source = {}) {
  const raw = String(source.book || source.custom || '').trim();
  if (!raw) return '';
  if (BOOK_RU[raw]) return BOOK_RU[raw];
  if (/^player'?s?\s*handbook/i.test(raw)) return 'Книга игрока';
  if (raw.length > 28) return `${raw.slice(0, 25)}…`;
  return raw;
}

function isOfficialBook(source = {}) {
  const raw = String(source.book || source.custom || '').trim().toUpperCase();
  return ['PHB', 'TCE', 'XGE', 'SCAG', 'EEPC', 'VGM', 'MTF', 'MPMM', 'FTD', 'SCC', 'EGW'].some(
    (b) => raw === b || raw.startsWith(`${b} `),
  ) || /player'?s?\s*handbook/i.test(source.book || source.custom || '');
}

function classSaves(doc) {
  const adv = Array.isArray(doc.system?.advancement) ? doc.system.advancement : [];
  const grants = [];
  for (const row of adv) {
    if (row?.type !== 'Trait') continue;
    const list = row.configuration?.grants || row.value?.chosen || [];
    for (const g of list) {
      const m = String(g).match(/^saves:([a-z]{3})$/i);
      if (m) grants.push(m[1].toLowerCase());
    }
  }
  return [...new Set(grants)].map((k) => SAVE_RU[k] || k);
}

function classAccent(identifier = '') {
  const id = String(identifier).toLowerCase().replace(/-+$/, '');
  return CLASS_ACCENTS[id] || '#2F6B4F';
}

function isSidekick(doc) {
  const id = String(doc.system?.identifier || '').toLowerCase();
  if (SIDEKICK_IDS.has(id)) return true;
  const name = String(doc.name || '');
  return /напарник|hапарник|haпарник/i.test(name);
}

async function readPack(packName) {
  const dir = path.join(moduleRoot, 'packs', packName);
  if (!fs.existsSync(dir)) {
    throw new Error(`Нет пака: ${dir}`);
  }
  const db = new ClassicLevel(dir, { valueEncoding: 'json' });
  await db.open();
  const docs = [];
  try {
    for await (const [, value] of db.iterator()) {
      const doc = value?.value ?? value;
      if (doc && typeof doc === 'object' && doc.name && doc.type) {
        docs.push(doc);
      }
    }
  } finally {
    await db.close();
  }
  return docs;
}

function dedupeByTitle(entries) {
  const seen = new Set();
  const out = [];
  for (const e of entries) {
    const key = e.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

function sortEntries(entries, { alphaOnly = false } = {}) {
  return entries.sort((a, b) => {
    if (!alphaOnly) {
      const ao = a.tags.includes('Официальный') ? 0 : 1;
      const bo = b.tags.includes('Официальный') ? 0 : 1;
      if (ao !== bo) return ao - bo;
    }
    return a.title.localeCompare(b.title, 'ru');
  });
}

function writeJson(fileName, payload) {
  const outPath = path.join(outDir, fileName);
  fs.writeFileSync(outPath, `${JSON.stringify(payload)}\n`, 'utf8');
  const kb = (Buffer.byteLength(JSON.stringify(payload)) / 1024).toFixed(1);
  console.log(`  ${fileName}: ${payload.entries.length} → ${kb} KB`);
  return payload.entries.length;
}

/** Foundry path → файл в модуле (с decode %20 и т.п.). */
function resolveModuleAsset(img) {
  if (!img) return null;
  let rel = decodeURIComponent(String(img));
  rel = rel.replace(/^modules\/laaru-dnd5-hw\//, '');
  if (rel.startsWith('modules/')) rel = rel.replace(/^modules\/[^/]+\//, '');
  const full = path.join(moduleRoot, rel);
  return fs.existsSync(full) ? full : null;
}

function safeRaceFileName(srcPath) {
  const base = path.basename(srcPath);
  const ext = path.extname(base).toLowerCase() || '.webp';
  const stem = path
    .basename(base, path.extname(base))
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
  return `${stem || 'race'}${ext === '.png' ? '.png' : '.webp'}`;
}

/**
 * Копирует портреты рас, пишет coverFile в entries и генерит require-мап.
 * @returns {{ copied: number, mapped: number, missing: number }}
 */
function syncRaceCovers(entries, raceDocsById) {
  fs.mkdirSync(raceAssetsDir, { recursive: true });
  const copiedNames = new Set();
  const idToFile = new Map();
  let missing = 0;

  for (const entry of entries) {
    const foundryId = entry.id.replace(/^laaru-race-/, '');
    const doc = raceDocsById.get(foundryId);
    const src = resolveModuleAsset(doc?.img);
    if (!src) {
      missing += 1;
      continue;
    }
    const fileName = safeRaceFileName(src);
    const dest = path.join(raceAssetsDir, fileName);
    if (!copiedNames.has(fileName)) {
      fs.copyFileSync(src, dest);
      copiedNames.add(fileName);
    }
    entry.coverFile = fileName;
    idToFile.set(entry.id, fileName);
  }

  // Удалить старые файлы, которых больше нет в мапе
  const keep = new Set(idToFile.values());
  for (const name of fs.readdirSync(raceAssetsDir)) {
    if (!keep.has(name) && /\.(webp|png|jpe?g)$/i.test(name)) {
      fs.unlinkSync(path.join(raceAssetsDir, name));
    }
  }

  // У портретов Laaru часто вшита салатовая рамка — срезаем.
  if (copiedNames.size > 0 && fs.existsSync(cropRaceFramesPy)) {
    const crop = spawnSync('python3', [cropRaceFramesPy, raceAssetsDir], {
      encoding: 'utf8',
    });
    if (crop.status !== 0) {
      console.warn(`  race frame crop failed: ${crop.stderr || crop.stdout || crop.status}`);
    } else {
      console.log(`  race frames: ${(crop.stdout || '').trim()}`);
    }
  }

  const lines = [
    '/* eslint-disable */',
    '/** Автогенерация: npm run build:handbook-laaru — не править руками. */',
    '',
    'const RACE_COVER_BY_ID: Record<string, number> = {',
  ];
  const sortedIds = [...idToFile.keys()].sort();
  for (const id of sortedIds) {
    const file = idToFile.get(id);
    lines.push(`  ${JSON.stringify(id)}: require('../../../assets/handbook/races/${file}'),`);
  }
  lines.push('};');
  lines.push('');
  lines.push('export function getHandbookRaceCoverSource(id: string): number | undefined {');
  lines.push('  return RACE_COVER_BY_ID[id];');
  lines.push('}');
  lines.push('');
  fs.writeFileSync(raceCoversOut, `${lines.join('\n')}\n`, 'utf8');

  return { copied: copiedNames.size, mapped: idToFile.size, missing };
}

if (!fs.existsSync(path.join(moduleRoot, 'module.json'))) {
  console.error(`Не найден модуль Laaru: ${moduleRoot}`);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

// LevelDB: только последовательно — параллельные open ломают iterator.
const classDocs = await readPack('classes');
const raceDocs = await readPack('races');
const raceMpmm = await readPack('racesmpmm');
const bgDocs = await readPack('backgrounds');
const spellDocs = await readPack('spells');

const classes = sortEntries(
  dedupeByTitle(
    classDocs
      .filter((d) => d.type === 'class' && !isSidekick(d))
      .map((d) => {
        const official = isOfficialBook(d.system?.source);
        const tags = [];
        const book = bookTag(d.system?.source);
        if (book) tags.push(book);
        tags.push(official ? 'Официальный' : 'Homebrew');
        return {
          id: `laaru-class-${d._id}`,
          systemId: SYSTEM_ID,
          category: 'classes',
          title: ruTitle(d.name),
          summary: shortBlurb(d.system?.description?.value, 110),
          savingThrows: classSaves(d),
          tags,
          accent: classAccent(d.system?.identifier),
        };
      })
      .filter((e) => e.title),
  ),
);

const allRaceDocs = [...raceDocs, ...raceMpmm].filter((d) => d.type === 'race');
const raceDocsById = new Map(allRaceDocs.map((d) => [d._id, d]));

const races = sortEntries(
  dedupeByTitle(
    allRaceDocs
      .map((d) => {
        const official = isOfficialBook(d.system?.source);
        const tags = [];
        const code = bookCode(d.system?.source);
        const book = bookTag(d.system?.source);
        if (code) tags.push(code);
        else if (book) tags.push(book);
        tags.push(official ? 'Официальный' : 'Homebrew');
        const subtitle = enSubtitle(d.name, d.system?.identifier);
        return {
          id: `laaru-race-${d._id}`,
          systemId: SYSTEM_ID,
          category: 'races',
          title: ruTitle(d.name),
          ...(subtitle ? { subtitle } : {}),
          summary: raceBlurb(d.system?.description?.value),
          tags,
        };
      })
      // «Своя раса» TCE — конструктор. Метки/варианты гнездим в UI под базовой расой.
      .filter((e) => e.title && !/^Своя\s+раса/i.test(e.title)),
  ),
  { alphaOnly: true },
);

const raceCoverStats = syncRaceCovers(races, raceDocsById);

const backgrounds = sortEntries(
  dedupeByTitle(
    bgDocs
      .filter((d) => d.type === 'background')
      .map((d) => {
        const official = isOfficialBook(d.system?.source);
        const tags = [];
        const book = bookTag(d.system?.source);
        if (book) tags.push(book);
        tags.push(official ? 'Официальный' : 'Homebrew');
        return {
          id: `laaru-bg-${d._id}`,
          systemId: SYSTEM_ID,
          category: 'backgrounds',
          title: ruTitle(d.name),
          summary: shortBlurb(d.system?.description?.value, 100),
          tags,
        };
      })
      .filter((e) => e.title),
  ),
);

// Заклинания: без summary (теги несут круг/школу) — сильно легче бандл.
const spells = sortEntries(
  dedupeByTitle(
    spellDocs
      .filter((d) => d.type === 'spell')
      .map((d) => {
        const level = Number(d.system?.level);
        const tags = [
          level === 0 || Number.isNaN(level) ? 'Заговор' : `${level} круг`,
          SCHOOL_RU[d.system?.school] || '',
          bookTag(d.system?.source),
        ].filter(Boolean);
        return {
          id: `laaru-spell-${d._id}`,
          systemId: SYSTEM_ID,
          category: 'spells',
          title: ruTitle(d.name),
          summary: '',
          tags,
        };
      })
      .filter((e) => e.title),
  ),
);

const meta = {
  version: 1,
  source: 'laaru-dnd5-hw',
  note: 'Лёгкий индекс карточек. Полные HTML/токены из Foundry не включаем.',
};

console.log(`Laaru → ${path.relative(clientRoot, outDir)}`);
writeJson('classes.json', { ...meta, category: 'classes', entries: classes });
writeJson('races.json', { ...meta, category: 'races', entries: races });
writeJson('backgrounds.json', { ...meta, category: 'backgrounds', entries: backgrounds });
writeJson('spells.json', { ...meta, category: 'spells', entries: spells });
console.log(
  `  races covers: ${raceCoverStats.mapped}/${races.length} mapped, ${raceCoverStats.copied} files, ${raceCoverStats.missing} без файла`,
);

const totalKb = (
  ['classes', 'races', 'backgrounds', 'spells']
    .map((n) => fs.statSync(path.join(outDir, `${n}.json`)).size)
    .reduce((a, b) => a + b, 0) / 1024
).toFixed(1);
const raceAssetsKb = fs
  .readdirSync(raceAssetsDir)
  .filter((n) => /\.(webp|png|jpe?g)$/i.test(n))
  .reduce((sum, n) => sum + fs.statSync(path.join(raceAssetsDir, n)).size, 0);
console.log(
  `Итого JSON: ${totalKb} KB; портреты рас: ${(raceAssetsKb / 1024).toFixed(0)} KB (${path.relative(clientRoot, raceAssetsDir)})`,
);
