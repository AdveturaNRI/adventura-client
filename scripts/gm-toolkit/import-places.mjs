#!/usr/bin/env node
/**
 * Готовые топонимы с GitHub (не самодельная склейка prefix+root):
 * - subalterngames/Not_Constantinople — провинции и поселения CK2 (1379 / ~9k)
 * - Snake4life/fantasy-names — fantasy_towns + castles (готовые корни/имена)
 * - lorebench / community-tables — имена до «—» в EN-таблицах
 *
 * → scraped/places.json (RU, фонетическая транслитерация)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { translitName, translitWord } from './lib/translit-en-ru.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VENDOR = path.join(__dirname, 'vendor');
const SCRAPED = path.join(__dirname, 'scraped');
const OUT = path.join(SCRAPED, 'places.json');

function uniq(arr) {
  return [...new Set(arr.filter((x) => typeof x === 'string' && x.trim()))];
}

function title(s) {
  const t = String(s || '').trim();
  if (!t) return '';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Многословные топонимы: каждое слово отдельно, без склейки в кашу. */
function translitPlace(raw) {
  const text = String(raw || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  if (!text) return '';
  if (/^\{\{/.test(text)) return '';
  // уже кириллица
  if (/^[А-ЯЁа-яё]/.test(text) && !/[A-Za-z]/.test(text)) return text;

  const parts = text
    .split(/[\s/_-]+/)
    .map((p) => p.replace(/[^A-Za-zА-ЯЁа-яё]/g, ''))
    .filter((p) => p.length >= 2);

  if (!parts.length) return '';

  const ru = parts
    .map((p) => {
      const one = translitName(p) || translitWord(p);
      return one;
    })
    .filter(Boolean);

  if (!ru.length) return '';
  const joined = ru.length === 1 ? ru[0] : ru.join(' ');
  if (joined.length < 3 || joined.length > 28) return '';
  // отсев склеек вроде «Дэйродморгабриел»
  if (!/\s/.test(joined) && joined.length > 16) return '';
  return joined;
}

function parseNmArrays(jsText) {
  const arrays = {};
  const re = /var\s+(nm\d+|names\d+)\s*=\s*\[([^\]]*)\]/g;
  let m;
  while ((m = re.exec(jsText))) {
    const items = [...m[2].matchAll(/"([^"]*)"/g)].map((x) => x[1]);
    arrays[m[1]] = items;
  }
  return arrays;
}

/** Имя до тире/двоеточия в lorebench/community. */
function extractLeadingName(item) {
  const s = typeof item === 'string' ? item : item?.text || item?.name || '';
  const m = String(s).match(/^([^—–:\n]{2,40})\s*[—–:]/);
  return m ? m[1].trim() : '';
}

const SKIP_PROVINCE = /^(french|st\.?|the|new |old |east |west |north |south )/i;
const SKIP_SETTLEMENT = /^(st\.?\s|the\s)/i;

/** Культуры CK2, где слишком много узнаваемых RU/славянских реалий (Рязань, Тула…). */
const DENY_CULTURES = new Set([
  'ilmenian',
  'severian',
  'volhynian',
  'mordvin',
  'samoyed',
  'polish',
  'pommeranian',
  'croatian',
  'serbian',
  'bulgarian',
  'romanian',
  'hungarian',
  'lettigallish',
  'lithuanian',
  'prussian',
  'ugricbaltic',
  'komi',
  'khanty',
  'bolghar',
  'pecheneg',
  'cuman',
  'finnish',
  'northern_sami',
  'tbd',
  '',
]);

/** Узнаваемые современные/русские города — даже если культура другая. */
const DENY_EN_NAMES = new Set(
  [
    'ryazan',
    'moscow',
    'moskva',
    'tula',
    'kiev',
    'kyiv',
    'minsk',
    'novgorod',
    'smolensk',
    'pskov',
    'vladimir',
    'yaroslavl',
    'kostroma',
    'kursk',
    'orel',
    'oryol',
    'voronezh',
    'tambov',
    'kaluga',
    'tver',
    'bryansk',
    'belgorod',
    'rostov',
    'kazan',
    'samara',
    'saratov',
    'perm',
    'ufa',
    'omsk',
    'tomsk',
    'irkutsk',
    'yakutsk',
    'petrozavodsk',
    'archangelsk',
    'arkhangelsk',
    'murmansk',
    'vologda',
    'rybinsk',
    'kolomna',
    'sergiev',
    'sergiyev',
    'nizhny',
    'nizhnynovgorod',
    'petersburg',
    'petrograd',
    'leningrad',
    'volgograd',
    'stalingrad',
    'kharkov',
    'kharkiv',
    'odessa',
    'odesa',
    'lviv',
    'lvov',
    'chernigov',
    'chernihiv',
    'poltava',
    'danzig',
    'gdansk',
    'warsaw',
    'warszawa',
    'krakow',
    'cracow',
    'prague',
    'praha',
    'budapest',
    'bucharest',
    'sofia',
    'belgrade',
    'zagreb',
    'dublin',
    'london',
    'paris',
    'rome',
    'roma',
    'vienna',
    'berlin',
    'madrid',
    'lisbon',
    'athens',
    'istanbul',
    'constantinople',
    'reykjavik',
  ].map((x) => x.toLowerCase()),
);

const DENY_RU_RE =
  /^(Рязан|Москв|Тула|Киев|Минск|Новгород|Смоленск|Псков|Владимир|Ярославл|Казань|Самара|Одесса|Харьков|Данциг|Дублин|Лондон|Париж|Рим|Берлин|Прага|Варшава|Реикджавик)/i;

function isDeniedEnName(raw) {
  const key = String(raw || '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
  if (!key) return false;
  if (DENY_EN_NAMES.has(key)) return true;
  // Ryazansk / Novgorodskoe и т.п.
  for (const bad of DENY_EN_NAMES) {
    if (bad.length >= 5 && key.startsWith(bad) && key.length <= bad.length + 4) {
      return true;
    }
  }
  return false;
}

function importCk2() {
  const file = path.join(VENDOR, 'Not_Constantinople/provinces.json');
  if (!fs.existsSync(file)) return null;

  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const provinces = [];
  const settlements = [];

  for (const [prov, meta] of Object.entries(data)) {
    const culture = String(meta?.culture || '');
    if (DENY_CULTURES.has(culture)) continue;
    if (SKIP_PROVINCE.test(prov)) continue;
    if (/\d/.test(prov)) continue;
    if (isDeniedEnName(prov)) continue;

    const p = translitPlace(prov);
    if (p && !DENY_RU_RE.test(p)) provinces.push(p);

    for (const s of meta?.settlements || []) {
      if (SKIP_SETTLEMENT.test(s)) continue;
      if (/\d/.test(s)) continue;
      if (isDeniedEnName(s)) continue;
      const t = translitPlace(s);
      if (t && !DENY_RU_RE.test(t)) settlements.push(t);
    }
  }

  return {
    source:
      'https://github.com/subalterngames/Not_Constantinople (CK2, без слав./RU-культур)',
    provinces: uniq(provinces),
    settlements: uniq(settlements),
  };
}

function expandFantasyTowns(max = 1200) {
  const file = path.join(
    VENDOR,
    'fantasy-names/generators/towns_and_cities/fantasy_towns.js',
  );
  if (!fs.existsSync(file)) return [];
  const { nm1, nm2 } = parseNmArrays(fs.readFileSync(file, 'utf8'));
  if (!nm1?.length || !nm2?.length) return [];

  const out = [];
  // stride по обоим спискам — без монополии «Amber*»
  const step1 = Math.max(1, Math.floor(nm1.length / 40));
  const step2 = Math.max(1, Math.floor(nm2.length / 30));
  for (let i = 0; i < nm1.length && out.length < max; i += step1) {
    for (let j = 0; j < nm2.length && out.length < max; j += step2) {
      const a = nm1[i];
      const b = nm2[(i * 3 + j) % nm2.length];
      if (!a || !b || a === b) continue;
      const ru = translitPlace(title(a) + title(b));
      if (ru) out.push(ru);
    }
  }
  // добивка случайным смещением, если мало
  for (let n = 0; out.length < max && n < max * 3; n++) {
    const a = nm1[n % nm1.length];
    const b = nm2[(n * 17 + 5) % nm2.length];
    if (!a || !b || a === b) continue;
    const ru = translitPlace(title(a) + title(b));
    if (ru) out.push(ru);
  }
  return uniq(out).slice(0, max);
}

/** Перемешать без Math.random — стабильный билд. */
function shuffleStable(arr, seed = 0x9e3779b9) {
  const a = [...arr];
  let s = seed >>> 0;
  for (let i = a.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function importCastles() {
  const file = path.join(VENDOR, 'fantasy-names/generators/places/castles.js');
  if (!fs.existsSync(file)) return [];
  const arrays = parseNmArrays(fs.readFileSync(file, 'utf8'));
  const names = arrays.nm1 || [];
  return uniq(names.map(translitPlace).filter(Boolean));
}

function importScrapedTables() {
  const out = [];
  for (const name of ['lorebench.json', 'community-tables.json']) {
    const file = path.join(SCRAPED, name);
    if (!fs.existsSync(file)) continue;
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const tables = data.tables || {};
    for (const key of ['cityTownNames', 'villages', 'towns']) {
      const items = tables[key]?.items || [];
      for (const item of items) {
        const lead = extractLeadingName(item);
        if (!lead) continue;
        // только короткое имя места, не описание/таверна
        if (/\b(the|of|kingdom|guild|tavern|inn)\b/i.test(lead)) continue;
        const words = lead.trim().split(/\s+/);
        if (words.length > 2) continue;
        if (lead.length > 24) continue;
        const ru = translitPlace(lead);
        if (!ru || ru.length > 22) continue;
        if (ru.split(/\s+/).length > 2) continue;
        out.push(ru);
      }
    }
  }
  return uniq(out);
}

const KINGDOM_TITLES = [
  'Королевство',
  'Княжество',
  'Герцогство',
  'Графство',
  'Марка',
  'Земли',
  'Вольные земли',
  'Империя',
  'Ханство',
  'Царство',
];

function wrapKingdoms(bases, limit = 2500) {
  const pool = shuffleStable(
    uniq(bases).filter((n) => n && !DENY_RU_RE.test(n)),
  );
  const bare = pool.slice(0, 700);
  const wrapped = [];
  for (let i = 0; i < pool.length && bare.length + wrapped.length < limit; i++) {
    const titleRu = KINGDOM_TITLES[i % KINGDOM_TITLES.length];
    wrapped.push(`${titleRu} ${pool[i]}`);
  }
  return shuffleStable(uniq([...bare, ...wrapped]), 0xc0ffee).slice(0, limit);
}

const ck2 = importCk2();
const fantasyTowns = expandFantasyTowns(1200);
const castles = importCastles();
const fromTables = importScrapedTables();

if (!ck2 && !fantasyTowns.length && !castles.length) {
  console.error(
    'Нет vendor-данных для мест. Клонируй:\n' +
      '  git clone --depth 1 https://github.com/subalterngames/Not_Constantinople.git scripts/gm-toolkit/vendor/Not_Constantinople\n' +
      '  git clone --depth 1 https://github.com/Snake4life/fantasy-names.git scripts/gm-toolkit/vendor/fantasy-names',
  );
  process.exit(1);
}

const settlements = shuffleStable(
  uniq([
    ...fantasyTowns,
    ...castles,
    ...(ck2?.settlements ?? []),
    ...fromTables,
  ]).filter(
    (n) =>
      n.split(/\s+/).length <= 2 &&
      !/\bОф\b/.test(n) &&
      !DENY_RU_RE.test(n),
  ),
  0xbadc0de,
);

// Королевства: фентези-города/замки первыми, CK2 — только «нерусские» культуры
const kingdoms = wrapKingdoms([
  ...fantasyTowns,
  ...castles,
  ...(ck2?.provinces ?? []),
]);

const payload = {
  sources: [
    ck2?.source,
    fantasyTowns.length &&
      'https://github.com/Snake4life/fantasy-names (fantasy_towns + castles)',
    fromTables.length && 'lorebench / community-tables (leading names)',
  ].filter(Boolean),
  locale: 'ru',
  kingdoms,
  settlements,
  stats: {
    ck2Provinces: ck2?.provinces?.length ?? 0,
    ck2Settlements: ck2?.settlements?.length ?? 0,
    fantasyTowns: fantasyTowns.length,
    castles: castles.length,
    fromTables: fromTables.length,
    kingdomsOut: kingdoms.length,
    settlementsOut: settlements.length,
  },
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);

console.log('places → scraped/places.json');
console.log('sources:', payload.sources.join(', '));
for (const [k, v] of Object.entries(payload.stats)) {
  console.log(`  ${k}: ${v}`);
}
console.log('  sample kingdoms:', kingdoms.slice(0, 8).join(' · '));
console.log('  sample settlements:', settlements.slice(0, 8).join(' · '));
