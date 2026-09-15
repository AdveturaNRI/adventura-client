#!/usr/bin/env node
/**
 * Импорт готовых имён из Tiendil/pynames
 * https://github.com/Tiendil/pynames
 * → scraped/pynames.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, 'vendor/pynames/pynames/generators/fixtures');
const OUT = path.join(__dirname, 'scraped/pynames.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function uniq(arr) {
  return [...new Set(arr.filter((x) => typeof x === 'string' && x.trim()))];
}

/** Именительный падеж: строка или ru[0] из полного набора форм. */
function nominative(ru) {
  if (typeof ru === 'string') return ru.trim();
  if (Array.isArray(ru) && ru[0]) return String(ru[0]).trim();
  return '';
}

const MALE_A_EXCEPTIONS = new Set([
  'илья', 'никита', 'кузьма', 'фома', 'савва', 'лука', 'даниила', 'данила', 'лёва', 'лева',
]);

const NAME_DENYLIST = new Set(['блуд', 'пиранья', 'карга']);

function looksOkGivenName(name, gender) {
  if (!name || name.length < 2 || name.length > 24) return false;
  if (!/^[А-ЯЁA-Z]/u.test(name)) return false;
  if (/\s/.test(name)) return false;
  if (NAME_DENYLIST.has(name.toLowerCase())) return false;
  if (gender === 'm') {
    const lower = name.toLowerCase();
    if (/[ая]$/u.test(lower) && !MALE_A_EXCEPTIONS.has(lower)) return false;
  }
  return true;
}

function fromListFile(file) {
  const data = readJson(path.join(FIXTURES, file));
  const m = [];
  const f = [];
  for (const entry of data.names || []) {
    const genders = entry.genders || {};
    if (genders.m?.ru) {
      const n = nominative(genders.m.ru);
      if (looksOkGivenName(n, 'm')) m.push(n);
    }
    if (genders.f?.ru) {
      const n = nominative(genders.f.ru);
      if (looksOkGivenName(n, 'f')) f.push(n);
    }
  }
  return { m: uniq(m), f: uniq(f), source: data.source || file };
}

function tableValues(tables, key, lang = 'ru') {
  const rows = tables?.[key] || [];
  const out = [];
  for (const row of rows) {
    const raw = row?.languages?.[lang] ?? row?.languages?.en;
    const v = nominative(raw);
    if (v) out.push(v);
  }
  return uniq(out);
}

function expandTableNames(file, { maxPerGender = 600 } = {}) {
  const data = readJson(path.join(FIXTURES, file));
  const tables = data.tables || {};
  const templates = data.templates || {};
  const m = new Set();
  const f = new Set();

  for (const tmpl of Object.values(templates)) {
    const genders = tmpl.genders || [];
    const parts = tmpl.template || [];
    const pools = parts.map((key) => tableValues(tables, key));
    if (pools.some((p) => p.length === 0)) continue;

    const [a, b = [''], c = ['']] = pools;
    // равномерно по префиксам — иначе весь пул = «Аэль…» от первого слога
    const perPrefix = Math.max(2, Math.ceil(maxPerGender / Math.max(a.length, 1)));

    for (const x of a) {
      let forPrefix = 0;
      prefixDone: for (const y of b) {
        for (const z of c) {
          if (forPrefix >= perPrefix) break prefixDone;
          if (m.size >= maxPerGender && f.size >= maxPerGender) break prefixDone;

          const name = `${x}${y}${z}`.replace(/'{2,}/g, "'");
          let added = false;
          if (genders.includes('m') && m.size < maxPerGender && looksOkGivenName(name, 'm')) {
            const before = m.size;
            m.add(name);
            if (m.size > before) added = true;
          }
          if (genders.includes('f') && f.size < maxPerGender && looksOkGivenName(name, 'f')) {
            const before = f.size;
            f.add(name);
            if (f.size > before) added = true;
          }
          if (added) forPrefix += 1;
        }
      }
    }
  }

  return {
    m: [...m],
    f: [...f],
    source: data.source || file,
  };
}

if (!fs.existsSync(FIXTURES)) {
  throw new Error(
    `Нет ${FIXTURES}. Склонируй: git clone --depth 1 https://github.com/Tiendil/pynames.git scripts/gm-toolkit/vendor/pynames`,
  );
}

const pagan = fromListFile('pagan_names_list.json');
const scandinavian = fromListFile('scandinavian_names_list.json');
const mongolian = fromListFile('mongolian_names_list.json');
const korean = fromListFile('korean_names_list.json');
const orc = fromListFile('orc_names_list.json');
const elfDnd = expandTableNames('elven_dnd_names_tables.json', { maxPerGender: 350 });
const elfWh = expandTableNames('elven_warhammer_names_tables.json', { maxPerGender: 250 });
const goblin = expandTableNames('goblin_names_tables.json', { maxPerGender: 300 });

const payload = {
  source: 'https://github.com/Tiendil/pynames',
  license: 'open-source (pynames)',
  cultures: {
    slavic_pagan: pagan,
    scandinavian,
    mongolian,
    korean,
    orc,
    elf_dnd: elfDnd,
    elf_warhammer: elfWh,
    goblin,
  },
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);

console.log('pynames → scraped/pynames.json');
for (const [key, val] of Object.entries(payload.cultures)) {
  console.log(`  ${key}: М ${val.m.length}, Ж ${val.f.length}`);
}
