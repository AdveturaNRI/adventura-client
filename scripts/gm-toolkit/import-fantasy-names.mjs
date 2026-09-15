#!/usr/bin/env node
/**
 * Импорт готовых фентезийных имён с GitHub:
 * - Snake4life/fantasy-names — D&D syllable generators
 * - bradleynelson/elf-name-generator — gnome/dwarf/halfling/orc (MIT)
 * - Random-Tables/utility-names-fantasy — dwarf/elf lists (MIT)
 *
 * → scraped/fantasy-names.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { translateFantasyName, translateList } from './lib/translit-en-ru.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VENDOR = path.join(__dirname, 'vendor');
const OUT = path.join(__dirname, 'scraped/fantasy-names.json');

function uniq(arr) {
  return [...new Set(arr.filter((x) => typeof x === 'string' && x.trim()))];
}

function title(s) {
  const t = String(s || '').trim();
  if (!t) return '';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** Парсит var nmN = ["a","b",...] из fantasy-names generators. */
function parseNmArrays(jsText) {
  const arrays = {};
  const re = /var\s+(nm\d+)\s*=\s*\[([^\]]*)\]/g;
  let m;
  while ((m = re.exec(jsText))) {
    const items = [...m[2].matchAll(/"([^"]*)"/g)].map((x) => x[1]);
    arrays[m[1]] = items;
  }
  return arrays;
}

function expandPair(a, b, max = 400) {
  const out = [];
  outer: for (const x of a) {
    for (const y of b) {
      const name = title(`${x}${y}`);
      if (name.length < 3 || name.length > 18) continue;
      out.push(name);
      if (out.length >= max) break outer;
    }
  }
  return uniq(out);
}

function importSnakeDnD() {
  const dir = path.join(VENDOR, 'fantasy-names/generators/dungeon_and_dragons');
  if (!fs.existsSync(dir)) return null;

  const map = {
    gnomes: 'gnome',
    dwarfs: 'dwarf',
    elfs: 'elf',
    drows: 'drow',
    eladrins: 'eladrin',
    halflings: 'halfling',
    dragonborns: 'dragonborn',
    tieflings: 'tiefling',
    half_orcs: 'half_orc',
    half_elfs: 'half_elf',
    goliaths: 'goliath',
  };

  const races = {};
  for (const [fileStem, key] of Object.entries(map)) {
    const file = path.join(dir, `${fileStem}.js`);
    if (!fs.existsSync(file)) continue;
    const arrays = parseNmArrays(fs.readFileSync(file, 'utf8'));
    // стандарт: nm1+nm2 = male, nm3+nm4 = female
    if (!arrays.nm1 || !arrays.nm2) continue;
    const m = expandPair(arrays.nm1, arrays.nm2, 350);
    const f =
      arrays.nm3 && arrays.nm4
        ? expandPair(arrays.nm3, arrays.nm4, 350)
        : m.slice(0, Math.min(200, m.length));
    races[key] = {
      m,
      f,
      source: 'Snake4life/fantasy-names (dungeon_and_dragons)',
    };
  }
  return races;
}

function componentLabel(item) {
  return title(
    item.text ||
      item.prefix_text?.replace(/-$/, '') ||
      item.suffix_text ||
      item.root ||
      '',
  );
}

function importBradNelson() {
  const dir = path.join(VENDOR, 'elf-name-generator/data');
  if (!fs.existsSync(dir)) return null;

  const gnomeClans = readJson(path.join(dir, 'gnomishClanNames.json'));
  const gnomeNicks = readJson(path.join(dir, 'gnomishNicknames.json'));
  const gnomePersonal = readJson(path.join(dir, 'gnomishPersonalNames.json'));
  const halfFamily = readJson(path.join(dir, 'halflingFamilyNames.json'));
  const halfPersonal = readJson(path.join(dir, 'halflingPersonalNames.json'));
  const orcPersonal = readJson(path.join(dir, 'orcPersonalNames.json'));
  const orcClans = readJson(path.join(dir, 'orcClanNames.json'));
  const orcEpithets = readJson(path.join(dir, 'orcEpithets.json'));

  const clanFor = (sub) =>
    uniq(
      gnomeClans
        .filter((c) => !c.subrace || c.subrace.includes(sub))
        .map(componentLabel)
        .filter(Boolean),
    );

  const gnomeGiven = (gender, sub) => {
    const pool = gnomePersonal.filter((p) => {
      if (p.subrace && !p.subrace.includes(sub)) return false;
      if (!p.gender || p.gender === 'neutral') return true;
      return p.gender === gender;
    });
    // полные имена (prefix === suffix) + комбинации prefix×suffix
    const complete = [];
    const prefixes = [];
    const suffixes = [];
    for (const p of pool) {
      const pre = (p.prefix_text || '').replace(/-$/, '');
      const suf = p.suffix_text || '';
      if (pre && suf && pre.toLowerCase() === suf.toLowerCase()) {
        complete.push(title(pre));
      } else {
        if (p.can_be_prefix !== false && pre) prefixes.push(title(pre));
        if (p.can_be_suffix && suf) suffixes.push(suf);
      }
    }
    const combos = expandPair(uniq(prefixes), uniq(suffixes), 200);
    return uniq([...complete, ...combos]);
  };

  const halfGiven = (gender) =>
    uniq(
      halfPersonal
        .filter((p) => {
          if (!p.gender || p.gender === 'neutral') return true;
          return p.gender === gender;
        })
        .map((p) => title((p.prefix_text || p.root || '').replace(/-$/, '')))
        .filter(Boolean),
    );

  return {
    gnome_rock: {
      m: gnomeGiven('male', 'rock'),
      f: gnomeGiven('female', 'rock'),
      surnames: clanFor('rock'),
      nicknames: uniq(gnomeNicks.map((n) => n.text).filter(Boolean)),
      source: 'bradleynelson/elf-name-generator',
    },
    gnome_forest: {
      m: gnomeGiven('male', 'forest'),
      f: gnomeGiven('female', 'forest'),
      surnames: clanFor('forest'),
      nicknames: uniq(gnomeNicks.map((n) => n.text).filter(Boolean)),
      source: 'bradleynelson/elf-name-generator',
    },
    halfling: {
      m: halfGiven('male'),
      f: halfGiven('female'),
      surnames: uniq(halfFamily.map((x) => x.text).filter(Boolean)),
      source: 'bradleynelson/elf-name-generator',
    },
    orc_fr: {
      m: uniq(orcPersonal.filter((p) => p.subrace?.includes('mountain') || !p.subrace).map((p) => title(p.text || p.root))),
      f: uniq(orcPersonal.filter((p) => p.subrace?.includes('gray') || p.subrace?.includes('mountain')).map((p) => title(p.text || p.root))),
      clans: uniq(orcClans.map((c) => title(c.text || c.root))),
      epithets: uniq(orcEpithets.map((e) => e.text).filter(Boolean)),
      source: 'bradleynelson/elf-name-generator',
    },
  };
}

function importUtilityTables() {
  const dir = path.join(VENDOR, 'utility-names-fantasy');
  if (!fs.existsSync(dir)) return null;

  const dwarven = readJson(path.join(dir, 'dwarven.json'));
  const elven = readJson(path.join(dir, 'elven.json'));

  const table = (obj, key) =>
    (obj?.[key]?.table || [])
      .map((s) => String(s).trim())
      .filter((s) => s && !s.includes('{{'))
      .map((s) => title(s));

  const dwarfStarts = table(dwarven, 'surname-start');
  const dwarfEnds = (dwarven?.['surname-end']?.table || [])
    .map((s) => String(s).trim().toLowerCase())
    .filter(Boolean);
  const dwarfSurnames = uniq(
    dwarfStarts.flatMap((start) => dwarfEnds.map((end) => `${start}${end}`)),
  ).slice(0, 150);

  // elven.json структура: male-middle / female-middle / ...
  const elfM = uniq([
    ...table(elven, 'male'),
    ...table(elven, 'male-middle'),
    ...table(elven, 'male-start'),
  ]);
  const elfF = uniq([
    ...table(elven, 'female'),
    ...table(elven, 'female-middle'),
    ...table(elven, 'female-start'),
  ]);

  return {
    dwarf: {
      m: uniq(table(dwarven, 'male')),
      f: uniq(table(dwarven, 'female')),
      surnames: dwarfSurnames,
      source: 'Random-Tables/utility-names-fantasy',
    },
    elf_utility: {
      m: elfM,
      f: elfF.length ? elfF : elfM,
      source: 'Random-Tables/utility-names-fantasy',
    },
  };
}

const snake = importSnakeDnD();
const brad = importBradNelson();
const utility = importUtilityTables();

if (!snake && !brad && !utility) {
  throw new Error(
    'Нет vendor-репозиториев. Склонируй:\n' +
      '  git clone --depth 1 https://github.com/Snake4life/fantasy-names.git scripts/gm-toolkit/vendor/fantasy-names\n' +
      '  git clone --depth 1 https://github.com/bradleynelson/elf-name-generator.git scripts/gm-toolkit/vendor/elf-name-generator\n' +
      '  git clone --depth 1 https://github.com/Random-Tables/utility-names-fantasy.git scripts/gm-toolkit/vendor/utility-names-fantasy',
  );
}

function localizeRace(pool) {
  if (!pool) return pool;
  // Только фонетика — иначе Fizzlebang → «Шипение Хлопок»
  return {
    ...pool,
    m: translateList(pool.m, 'phonetic'),
    f: translateList(pool.f, 'phonetic'),
    surnames: pool.surnames ? translateList(pool.surnames, 'phonetic') : undefined,
    clans: pool.clans ? translateList(pool.clans, 'phonetic') : undefined,
    nicknames: undefined, // прозвища не мешаем в фамилию
    epithets: pool.epithets ? translateList(pool.epithets, 'phonetic') : undefined,
  };
}

const merged = {
  ...(snake || {}),
  ...(utility || {}),
  ...(brad || {}),
};

const racesLocalized = Object.fromEntries(
  Object.entries(merged).map(([key, val]) => [key, localizeRace(val)]),
);

const payload = {
  sources: [
    snake && 'https://github.com/Snake4life/fantasy-names',
    brad && 'https://github.com/bradleynelson/elf-name-generator',
    utility && 'https://github.com/Random-Tables/utility-names-fantasy',
  ].filter(Boolean),
  locale: 'ru',
  transliteration: 'phonetic + compound dictionary',
  races: racesLocalized,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);

console.log('fantasy-names → scraped/fantasy-names.json');
console.log('sources:', payload.sources.join(', '));
for (const [key, val] of Object.entries(payload.races)) {
  const sur = val.surnames?.length ?? val.clans?.length ?? 0;
  console.log(
    `  ${key}: М ${val.m?.length ?? 0}, Ж ${val.f?.length ?? 0}, fam/clan ${sur} (${val.source})`,
  );
}
