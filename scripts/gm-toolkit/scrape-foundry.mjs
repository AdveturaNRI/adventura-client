#!/usr/bin/env node
/**
 * Парсинг Foundry VTT ru-ru (public/compendium) + community tables.
 * Результат: scripts/gm-toolkit/scraped/*.json
 *
 * Источники (vendor/):
 * - phenomen/foundry-vtt-ru
 * - foundry-vtt-community/tables
 * - lorebench-tools/lorebench-tables
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VENDOR = path.join(__dirname, 'vendor');
const OUT = path.join(__dirname, 'scraped');
const CYR = /[А-Яа-яЁё]/;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function uniq(arr) {
  return [...new Set(arr.map((x) => String(x).trim()).filter(Boolean))];
}

function isCyrillic(text) {
  return CYR.test(String(text ?? ''));
}

function resultTexts(results) {
  if (!results) return [];
  const items = Array.isArray(results)
    ? results
    : typeof results === 'object'
      ? Object.values(results)
      : [];
  const out = [];
  for (const item of items) {
    if (typeof item === 'string') {
      out.push(item);
      continue;
    }
    if (!item || typeof item !== 'object') continue;
    const text =
      item.text ||
      item.description ||
      item.name ||
      (typeof item.result === 'string' ? item.result : '');
    if (text) out.push(String(text).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  }
  return out.filter(Boolean);
}

function babeleEntries(file) {
  if (!fs.existsSync(file)) return {};
  const data = readJson(file);
  return data.entries && typeof data.entries === 'object' ? data.entries : {};
}

function stripPrefix(name) {
  return String(name)
    .replace(/^\([^)]+\)\s*/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const CREATURE_NAME_RE =
  /карга|ведьм|дракон|элементаль|гигант|голем|демон|дьявол|ангел|нежить|скелет|зомби|призрак|дух|слава|стая|рой|мух|паук|змея|волк|медведь|орёл|гриф|осёл|конь|лошад|козёл|собак|кот\b|крыс|корабл|ковёр|аппарат|меч\b|кнут|щит|доспех|зелье|свиток|кольцо|амулет|гоблин|орк\b|тролль|огр\b|кобольд|бука|мимик|слизь|куб|аватара|иллюзорн|пляшущ|летающ|ездов/i;

function looksLikePersonName(name) {
  if (!name || !isCyrillic(name)) return false;
  const value = String(name).trim();
  if (value.length < 2 || value.length > 22) return false;
  if (/[0-9(+/]/.test(value)) return false;
  if (CREATURE_NAME_RE.test(value)) return false;

  const parts = value.split(/\s+/);
  // Одно слово: Акра, Всеслава, Рэндал
  if (parts.length === 1) {
    return /^[А-ЯЁA-Z][а-яёa-z'-]{1,20}$/u.test(parts[0]);
  }
  // Два слова: только если оба похожи на личные имена (не «Болотная карга»)
  if (parts.length === 2) {
    const [a, b] = parts;
    const looksGiven = /^[А-ЯЁA-Z][а-яёa-z'-]{1,16}$/u.test(a);
    const looksFamily = /^[А-ЯЁA-Z][а-яёa-z'-]{1,18}$/u.test(b);
    // отсекаем прилагательное + существительное («Болотная карга», «Серый волк»)
    if (/ая$|яя$|ое$|ее$|ый$|ий$|ой$/u.test(a.toLowerCase()) && !/ич$|на$/u.test(a.toLowerCase())) {
      return false;
    }
    return looksGiven && looksFamily;
  }
  return false;
}

function ensureVendor() {
  const ru = path.join(VENDOR, 'foundry-vtt-ru');
  if (!fs.existsSync(ru)) {
    throw new Error(
      `Нет vendor/foundry-vtt-ru. Склонируй:\n` +
        `  cd adventura-client/scripts/gm-toolkit/vendor && \\\n` +
        `  git clone --depth 1 --branch v14 https://github.com/phenomen/foundry-vtt-ru.git`,
    );
  }
  return ru;
}

function scrapeFoundryRu(ruRoot) {
  const dndAg = path.join(ruRoot, 'public/compendium/dnd5e/ag');
  const dndDs = path.join(ruRoot, 'public/compendium/dnd5e/ds');

  const raceEntriesDs = babeleEntries(path.join(dndDs, 'dnd5e.races.json'));
  const raceEntriesAg = babeleEntries(path.join(dndAg, 'dnd5e.races.json'));
  const origins = babeleEntries(path.join(dndAg, 'dnd5e.origins24.json'));

  const RACE_KEY_RE =
    /^(dragonborn|dwarf|elf|gnome|halfling|half-elf|half-orc|human|tiefling|orc|goliath|aasimar|tabaxi|firbolg|kenku|triton|yuan-ti|goblin|hobgoblin|bugbear|kobold|centaur|minotaur|lizardfolk|leonin|satyr|fairy|harengon|owlin|shifter|warforged|changeling|kalashtar|verdant|plasmoid|thri-kreen|autognome|reborn|hexblood|dhampir)/i;
  const RACE_KEY_EXCLUDE_RE =
    /(cunning|nimbleness|endurance|attacks|trance|legacy|ancestry|feature|speed|vision|weapon|tool|resistance|knowledge|training|cast|spell)/i;

  const raceLabels = [];
  const raceMap = {};
  for (const [key, value] of Object.entries({ ...raceEntriesDs, ...raceEntriesAg })) {
    if (!value || typeof value !== 'object') continue;
    const name = value.name;
    if (!name || !isCyrillic(name)) continue;
    if (!RACE_KEY_RE.test(key) || RACE_KEY_EXCLUDE_RE.test(key)) continue;
    if (/^(Храбрость|Выброс|Проворство|Гномья|Транс|Тёмное|Увеличение|Стойкость|Сопротивление|Ремесленн)/.test(name)) {
      continue;
    }
    raceLabels.push(name);
    raceMap[key] = name;
  }

  // origins24: расовые корни вида "Elf, High" → только если имя уже по-русски
  for (const [key, value] of Object.entries(origins)) {
    if (!value || typeof value !== 'object') continue;
    if (!/,/.test(key) && !RACE_KEY_RE.test(key)) continue;
    if (RACE_KEY_EXCLUDE_RE.test(key)) continue;
    const name = value.name;
    if (!name || !isCyrillic(name) || name === key) continue;
    if (name.includes(',')) continue;
    raceLabels.push(name);
    raceMap[key] = name;
  }

  const classes = babeleEntries(path.join(dndAg, 'dnd5e.classes24.json'));
  const classNames = [];
  for (const value of Object.values(classes)) {
    if (value?.name && isCyrillic(value.name) && value.name.length < 40) {
      classNames.push(value.name);
    }
  }

  const backgrounds = babeleEntries(path.join(dndAg, 'dnd5e.backgrounds.json'));
  // Только предыстории (+ ниже FBL-профессии). origins24 сюда НЕ мешаем —
  // там «хитроумный удар», «ярость» и прочие фичи классов.
  const occupations = [];
  for (const value of Object.values(backgrounds)) {
    if (value?.name && isCyrillic(value.name) && value.name.length < 50) {
      occupations.push(value.name.toLowerCase());
    }
  }

  const monsters = babeleEntries(path.join(dndAg, 'dnd5e.monsters.json'));
  const monsterNames = [];
  for (const value of Object.values(monsters)) {
    if (value?.name && isCyrillic(value.name)) monsterNames.push(value.name);
  }

  const actors = babeleEntries(path.join(dndAg, 'dnd5e.actors24.json'));
  const heroes = babeleEntries(path.join(dndAg, 'dnd5e.heroes.json'));
  const personNames = [];
  for (const value of Object.values(actors)) {
    const name = value?.name;
    if (looksLikePersonName(name)) personNames.push(stripPrefix(name));
  }
  for (const value of Object.values(heroes)) {
    const raw = value?.name || '';
    const match = raw.match(/^([^(/]+)/);
    const name = match?.[1]?.trim();
    if (looksLikePersonName(name)) personNames.push(name);
  }

  const blades = babeleEntries(
    path.join(ruRoot, 'public/compendium/blades-in-the-dark/blades-in-the-dark.npc.json'),
  );
  for (const value of Object.values(blades)) {
    const name = stripPrefix(value?.name || '');
    if (looksLikePersonName(name)) personNames.push(name);
  }

  const mausritter = babeleEntries(
    path.join(ruRoot, 'public/compendium/mausritter/mausritter.tables.json'),
  );
  const maus = {
    givenNames: [],
    surnames: [],
    appearances: [],
    mannerisms: [],
    goals: [],
    landmarks: [],
    settlementBits: [],
  };
  for (const value of Object.values(mausritter)) {
    const title = value?.name || '';
    const texts = resultTexts(value.results);
    if (/Имя при рождении/i.test(title)) maus.givenNames.push(...texts);
    else if (/Матроним/i.test(title)) maus.surnames.push(...texts);
    else if (/Внешность/i.test(title) || /Физическая особенность/i.test(title)) {
      maus.appearances.push(...texts);
    } else if (/Особенность/i.test(title) || /склонност/i.test(title)) {
      maus.mannerisms.push(...texts);
    } else if (/Желания/i.test(title)) maus.goals.push(...texts.map((t) => `хочет: ${t}`));
    else if (/Интересная деталь/i.test(title)) maus.landmarks.push(...texts);
    else if (/Гекс -/i.test(title)) maus.settlementBits.push(...texts);
  }

  let fblKin = [];
  let fblProf = [];
  const fblPath = path.join(ruRoot, 'public/compendium/fbl/dataset/dataset-ru.json');
  if (fs.existsSync(fblPath)) {
    const fbl = readJson(fblPath);
    fblKin = Object.values(fbl.kin || {}).map((k) => k.name).filter(isCyrillic);
    fblProf = Object.values(fbl.profession || {}).map((p) => p.name.toLowerCase()).filter(Boolean);
  }

  const tables = babeleEntries(path.join(dndAg, 'dnd5e.tables.json'));
  const tableSnippets = [];
  for (const value of Object.values(tables)) {
    for (const text of resultTexts(value.results)) {
      if (isCyrillic(text) && text.length < 80) tableSnippets.push(text);
    }
  }

  return {
    source: 'phenomen/foundry-vtt-ru',
    raceLabels: uniq(raceLabels),
    raceMap,
    classNames: uniq(classNames),
    occupations: uniq([...occupations, ...fblProf]),
    monsterNames: uniq(monsterNames),
    personNames: uniq(personNames),
    fblKin: uniq(fblKin),
    mausritter: {
      givenNames: uniq(maus.givenNames),
      surnames: uniq(maus.surnames),
      appearances: uniq(maus.appearances),
      mannerisms: uniq(maus.mannerisms),
      goals: uniq(maus.goals),
      landmarks: uniq(maus.landmarks),
      settlementBits: uniq(maus.settlementBits),
    },
    tableSnippets: uniq(tableSnippets),
  };
}

function scrapeCommunityTables() {
  const root = path.join(VENDOR, 'tables/independent_tables');
  if (!fs.existsSync(root)) {
    return { source: 'foundry-vtt-community/tables', missing: true, tables: {} };
  }

  const wanted = {
    tavernNames: '100-tavern-names.json',
    tavernEvents: '100-tavern-encounters.json',
    tavernFood: '100-tavern-food.json',
    tavernDrinks: '100-signature-tavern-drinks.json',
    professions: '100-city-professions.json',
    npcJobs: '100-npc-jobs.json',
    quirks: '100-personality-quirks.json',
    physicalTraits: '100-npc-physical-traits.json',
    villages: '300-small-fantasy-village-names.json',
    towns: '100-unique-towns-villages.json',
    factions: '100-factions.json',
    dungeonEncounters: '100-interesting-dungeon-encounters.json',
    dwarfClans: '100-dwarven-clan-names.json',
    elvenTraits: '100-elven-traits.json',
    dwarvenTraits: '100-dwarven-features.json',
    dragonbornTraits: '100-dragonborn-traits.json',
    tieflingTraits: '100-tiefling-traits.json',
    orcTraits: '100-orc-and-half-orc-traits.json',
    aasimarTraits: '100-aasimar-traits.json',
    halflingTraits: '100-halfling-traits.json',
  };

  const tables = {};
  for (const [key, file] of Object.entries(wanted)) {
    const full = path.join(root, file);
    if (!fs.existsSync(full)) continue;
    const data = readJson(full);
    tables[key] = {
      name: data.name || file,
      items: uniq(resultTexts(data.results)),
    };
  }

  return {
    source: 'foundry-vtt-community/tables',
    language: 'en',
    tables,
  };
}

function scrapeLorebench() {
  const root = path.join(VENDOR, 'lorebench-tables/tables');
  if (!fs.existsSync(root)) {
    return { source: 'lorebench-tools/lorebench-tables', missing: true, tables: {} };
  }

  const wanted = {
    fantasyNpcNames: 'fantasy-npc-names.json',
    tavernInnNames: 'tavern-inn-names.json',
    tavernRumors: 'tavern-rumors.json',
    npcQuirks: 'npc-quirks.json',
    cityTownNames: 'city-town-names.json',
    factionsGuilds: 'factions-guilds.json',
    dungeonRooms: 'dungeon-rooms.json',
    questHooks: 'quest-hooks.json',
    shopNames: 'shop-merchant-names.json',
  };

  const tables = {};
  for (const [key, file] of Object.entries(wanted)) {
    const full = path.join(root, file);
    if (!fs.existsSync(full)) continue;
    const data = readJson(full);
    tables[key] = {
      name: data.name || file,
      items: uniq(resultTexts(data.results)),
    };
  }

  return {
    source: 'lorebench-tools/lorebench-tables',
    language: 'en',
    license: 'free for commercial use (do not resell packs)',
    tables,
  };
}

const ruRoot = ensureVendor();
fs.mkdirSync(OUT, { recursive: true });

const foundryRu = scrapeFoundryRu(ruRoot);
const community = scrapeCommunityTables();
const lorebench = scrapeLorebench();

fs.writeFileSync(path.join(OUT, 'foundry-ru.json'), `${JSON.stringify(foundryRu, null, 2)}\n`);
fs.writeFileSync(path.join(OUT, 'community-tables.json'), `${JSON.stringify(community, null, 2)}\n`);
fs.writeFileSync(path.join(OUT, 'lorebench.json'), `${JSON.stringify(lorebench, null, 2)}\n`);

const stats = {
  foundryRu: {
    raceLabels: foundryRu.raceLabels.length,
    personNames: foundryRu.personNames.length,
    occupations: foundryRu.occupations.length,
    monsters: foundryRu.monsterNames.length,
    mausGiven: foundryRu.mausritter.givenNames.length,
    mausSurnames: foundryRu.mausritter.surnames.length,
    mausAppearances: foundryRu.mausritter.appearances.length,
    mausMannerisms: foundryRu.mausritter.mannerisms.length,
    mausGoals: foundryRu.mausritter.goals.length,
    mausLandmarks: foundryRu.mausritter.landmarks.length,
    fblKin: foundryRu.fblKin.length,
  },
  community: Object.fromEntries(
    Object.entries(community.tables || {}).map(([k, v]) => [k, v.items.length]),
  ),
  lorebench: Object.fromEntries(
    Object.entries(lorebench.tables || {}).map(([k, v]) => [k, v.items.length]),
  ),
};

fs.writeFileSync(path.join(OUT, 'stats.json'), `${JSON.stringify(stats, null, 2)}\n`);

console.log('Скрапинг Foundry / community / lorebench\n');
console.log('── foundry-vtt-ru (RU) ──');
for (const [k, v] of Object.entries(stats.foundryRu)) {
  console.log(`  ${k}: ${v}`);
}
console.log('── community tables (EN) ──');
for (const [k, v] of Object.entries(stats.community)) {
  console.log(`  ${k}: ${v}`);
}
console.log('── lorebench (EN) ──');
for (const [k, v] of Object.entries(stats.lorebench)) {
  console.log(`  ${k}: ${v}`);
}
console.log(`\nЗаписано в ${OUT}`);
