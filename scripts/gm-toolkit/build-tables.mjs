#!/usr/bin/env node
/**
 * Сборка таблиц GM Toolkit → adventura-client/src/data/gm-toolkit/
 * Источники:
 * 1) scraped/pynames.json — личные имена (Tiendil/pynames), НЕ Foundry-акторы
 * 2) scraped/ из scrape-foundry.mjs — профессии/расы/монстры/Mausritter
 * 3) seeds/ — где нет готовых RU-таблиц
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { races as seedRaces } from './seeds/races.mjs';
import { expandRaceNames, padSurnamesAndClans } from './seeds/name-parts.mjs';
import {
  appearances as seedAppearances,
  goals as seedGoals,
  mannerisms as seedMannerisms,
  occupations as seedOccupations,
  secrets,
} from './seeds/npc-tables.mjs';
import {
  adjectives,
  atmospheres,
  establishmentTypes,
  events,
  keepers,
  nouns,
  rumors,
  signatureItems,
} from './seeds/taverns.mjs';
import {
  crises,
  emblems,
  factionNameParts,
  factionSpheres,
  governments,
  hiddenAgendas,
  mottos,
  rulerTitles,
  rulerTraits,
} from './seeds/kingdoms.mjs';
import {
  settlementByType,
  settlementSizes,
} from './seeds/settlements.mjs';
import {
  currentThreats as seedThreats,
  dungeonAdjectives,
  dungeonNouns,
  owners,
  originalPurposes,
  placeNames as dungeonPlaceNames,
  treasures,
  traps,
} from './seeds/dungeons.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../../src/data/gm-toolkit');
const SCRAPED_DIR = path.join(__dirname, 'scraped');

function loadScraped(name) {
  const file = path.join(SCRAPED_DIR, name);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function uniq(arr) {
  return [...new Set(arr.filter((x) => typeof x === 'string' && x.trim().length > 0))];
}

function guessGender(name) {
  const n = name.trim().toLowerCase();
  if (/[ая]$/u.test(n) && !/(илья|кузьма|фома|никита|савва)$/u.test(n)) return 'f';
  return 'm';
}

function splitNames(names) {
  const m = [];
  const f = [];
  for (const name of names) {
    if (guessGender(name) === 'f') f.push(name);
    else m.push(name);
  }
  return { m: uniq(m), f: uniq(f) };
}

function assertNonEmpty(name, arr) {
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error(`Таблица «${name}» пуста`);
  }
}

function writeJson(filename, data) {
  const file = path.join(OUT_DIR, filename);
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  return file;
}

function communityItems(community, key) {
  return community?.tables?.[key]?.items ?? [];
}

/** Готовые топонимы из scraped/places.json (CK2 + fantasy-names). */
function loadPlaceNames() {
  const places = loadScraped('places.json');
  if (!places?.kingdoms?.length || !places?.settlements?.length) {
    throw new Error(
      'Нет scraped/places.json — сначала: node scripts/gm-toolkit/import-places.mjs',
    );
  }
  return {
    kingdoms: uniq(places.kingdoms),
    settlements: uniq(places.settlements),
  };
}

function expandDungeonNames() {
  const names = new Set();
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  for (const adj of dungeonAdjectives) {
    for (const noun of dungeonNouns) {
      const form = adj[noun.gender];
      if (!form) continue;
      names.add(`${form} ${noun.word}`);
    }
  }

  for (const noun of dungeonNouns) {
    for (const owner of owners) {
      names.add(`${cap(noun.word)} ${owner}`);
    }
  }

  for (const place of dungeonPlaceNames) {
    names.add(`Глубины ${place}`);
    names.add(`Тень ${place}`);
    names.add(`Сердце ${place}`);
    names.add(`Зов ${place}`);
    names.add(`Падение ${place}`);
  }

  return [...names];
}

function expandFactionNames() {
  const names = [];
  for (const adj of factionNameParts.adj) {
    for (const noun of factionNameParts.noun) {
      names.push(`${adj} ${noun}`);
    }
  }
  return uniq(names);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const foundryRu = loadScraped('foundry-ru.json');
const community = loadScraped('community-tables.json');
const lorebench = loadScraped('lorebench.json');
const pynames = loadScraped('pynames.json');
const fantasyNames = loadScraped('fantasy-names.json');

if (!foundryRu) {
  console.warn(
    '⚠ scraped/foundry-ru.json не найден. Запусти: node scripts/gm-toolkit/scrape-foundry.mjs',
  );
}
if (!pynames?.cultures) {
  console.warn(
    '⚠ scraped/pynames.json не найден. Запусти: node scripts/gm-toolkit/import-pynames.mjs',
  );
}
if (!fantasyNames?.races) {
  console.warn(
    '⚠ scraped/fantasy-names.json не найден. Запусти: node scripts/gm-toolkit/import-fantasy-names.mjs',
  );
}

/** Готовые пулы имён: раса → ключи cultures в pynames.json (мержатся).
 * Эльфов здесь нет: табличный expand раньше заливал всё префиксом «Аэль». */
const PYNAMES_FOR_RACE = {
  human_slavic: ['slavic_pagan'],
  human_nordic: ['scandinavian'],
  human_asian: ['mongolian', 'korean'],
  orc: ['orc'],
  goblin: ['goblin'],
  hobgoblin: ['goblin'],
  bugbear: ['goblin'],
  kobold: ['goblin'],
};

/** GitHub fantasy-names / elf-name-generator / utility-names → наши ключи рас. */
const FANTASY_NAMES_FOR_RACE = {
  gnome_rock: ['gnome_rock', 'gnome'],
  gnome_forest: ['gnome_forest', 'gnome'],
  dwarf_mountain: ['dwarf'],
  dwarf_hill: ['dwarf'],
  halfling: ['halfling'],
  dragonborn: ['dragonborn'],
  tiefling: ['tiefling'],
  elf_high: ['elf', 'elf_utility'],
  elf_wood: ['elf'],
  elf_drow: ['drow', 'elf'],
  elf_eladrin: ['eladrin', 'elf'],
  firbolg: ['goliath'],
  orc: ['orc_fr'],
};

function mergePynamesPools(cultureKeys) {
  const m = [];
  const f = [];
  for (const key of cultureKeys) {
    const pool = pynames?.cultures?.[key];
    if (!pool) continue;
    m.push(...(pool.m ?? []));
    f.push(...(pool.f ?? []));
  }
  return { m: uniq(m), f: uniq(f) };
}

function mergeFantasyRace(keys) {
  const m = [];
  const f = [];
  const surnames = [];
  const clans = [];
  const sources = [];
  for (const key of keys) {
    const pool = fantasyNames?.races?.[key];
    if (!pool) continue;
    m.push(...(pool.m ?? []));
    f.push(...(pool.f ?? []));
    surnames.push(...(pool.surnames ?? []));
    clans.push(...(pool.clans ?? []));
    if (pool.source) sources.push(pool.source);
  }
  return {
    m: uniq(m),
    f: uniq(f),
    surnames: uniq(surnames),
    clans: uniq(clans),
    source: sources[0] || 'fantasy-names',
  };
}

// Mausritter-имена — только отдельная раса, не в людей
const mausNames = uniq(foundryRu?.mausritter?.givenNames ?? []);
const mausSplit = splitNames(mausNames);
const mausSurnames = uniq(foundryRu?.mausritter?.surnames ?? []);

// Приоритет: pynames (RU) → GitHub fantasy datasets → seeds+parts
const NAME_TARGET = 160;

function diversifyByPrefix(list, { maxShare = 0.1, prefixLen = 3 } = {}) {
  if (!list?.length) return [];
  const limit = Math.max(4, Math.floor(list.length * maxShare));
  const counts = new Map();
  const out = [];
  for (const name of list) {
    const key = name.slice(0, prefixLen).toLowerCase();
    if ((counts.get(key) || 0) >= limit) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
    out.push(name);
  }
  return out.length >= 20 ? out : list;
}

const races = seedRaces.map((race) => {
  const fromPy = PYNAMES_FOR_RACE[race.key]
    ? mergePynamesPools(PYNAMES_FOR_RACE[race.key])
    : { m: [], f: [] };
  const fromGh = FANTASY_NAMES_FOR_RACE[race.key]
    ? mergeFantasyRace(FANTASY_NAMES_FOR_RACE[race.key])
    : { m: [], f: [], surnames: [], clans: [] };

  let names;
  let nameSource;
  let surnames = race.surnames ? uniq([...race.surnames]) : undefined;
  let clans = race.clans ? uniq([...race.clans]) : undefined;

  if (fromPy.m.length >= 40 && fromPy.f.length >= 40) {
    names = { m: uniq(fromPy.m), f: uniq(fromPy.f) };
    nameSource = 'pynames';
  } else if (fromGh.m.length >= 20 && fromGh.f.length >= 20) {
    // GitHub + seeds; режем доминирующие префиксы («Аэль…»)
    names = {
      m: diversifyByPrefix(uniq([...(race.names.m || []), ...fromGh.m]), {
        maxShare: 0.12,
      }).slice(0, 400),
      f: diversifyByPrefix(uniq([...(race.names.f || []), ...fromGh.f]), {
        maxShare: 0.12,
      }).slice(0, 400),
    };
    nameSource = fromGh.source;
    if (fromGh.surnames.length) {
      // готовые кланы + seed PHB (Бэрен/Накл), без многословного мусора
      surnames = uniq([
        ...(race.surnames ?? []),
        ...fromGh.surnames.filter((s) => s && !/\s/.test(s) && s.length >= 3 && s.length <= 18),
      ]);
    }
    if (fromGh.clans.length) {
      clans = uniq([...(clans ?? []), ...fromGh.clans]);
    }
  } else {
    const expanded = expandRaceNames(race.key, race.names, { target: NAME_TARGET });
    names = { m: expanded.m, f: expanded.f };
    nameSource = expanded.expanded ? 'seeds+parts' : 'seeds';
    if (expanded.surnames?.length) {
      surnames = uniq([...(surnames ?? []), ...expanded.surnames]);
    }
    if (expanded.clans?.length) {
      clans = uniq([...(clans ?? []), ...expanded.clans]);
    }
  }

  // Не добиваем гномов процедурными «Кнопочный Шестерёнка»
  const skipPad = race.key.startsWith('gnome_') || race.key === 'halfling';
  if (!skipPad) {
    const padded = padSurnamesAndClans(race.key, {
      surnames: surnames ?? [],
      clans: clans ?? [],
    });
    surnames = padded.surnames;
    clans = padded.clans;
  }

  return {
    ...race,
    names,
    surnames,
    clans,
    nameSource,
  };
});

// Мышиный народ из Mausritter — отдельная раса со своими именами
if (mausSplit.m.length && mausSplit.f.length) {
  races.push({
    key: 'mausritter_mouse',
    label: 'Мышь (Mausritter)',
    names: mausSplit,
    surnames: mausSurnames.length ? mausSurnames : undefined,
    source: 'foundry-vtt-ru/mausritter',
  });
}

// FBL kin / расы Foundry: только ярлыки, которых нет; имена берём у ближайшего seed-аналога
const LABEL_TO_SEED = {
  дварф: 'dwarf_mountain',
  эльф: 'elf_high',
  гном: 'gnome_rock',
  человек: 'human_slavic',
  полуэльф: 'elf_wood',
  полурослик: 'halfling',
  гоблин: 'goblin',
  орк: 'orc',
  тифлинг: 'tiefling',
  драконорождённый: 'dragonborn',
  голиаф: 'firbolg',
  полуволк: 'tabaxi',
};

function donorRaceForLabel(label) {
  const lower = label.toLowerCase();
  const built = (key) => races.find((r) => r.key === key);
  if (lower.includes('человек')) return built('human_slavic');
  const mapped = LABEL_TO_SEED[lower];
  if (mapped) return built(mapped);
  return built('human_slavic') || races[0];
}

const existingLabels = new Set(races.map((r) => r.label.toLowerCase()));
for (const label of [...(foundryRu?.raceLabels ?? []), ...(foundryRu?.fblKin ?? [])]) {
  const lower = label.toLowerCase().trim();
  if (!lower) continue;
  // Голые ярлыки Foundry («Человек», «Дварф») — дубли наших seed-рас с теми же именами
  if (LABEL_TO_SEED[lower]) continue;
  // FBL «Человек из …» без своих пулов имён — тоже славянский донор, путаница в пикере
  if (lower.startsWith('человек')) continue;
  if (existingLabels.has(lower)) continue;
  existingLabels.add(lower);

  const donor = donorRaceForLabel(label);
  const key = `fvtt_${lower.replace(/[^a-zа-яё0-9]+/giu, '_')}`.slice(0, 48);
  races.push({
    key,
    label,
    names: {
      m: [...donor.names.m],
      f: [...donor.names.f],
    },
    surnames: donor.surnames ? [...donor.surnames] : undefined,
    clans: donor.clans ? [...donor.clans] : undefined,
    source: 'foundry-vtt-ru',
  });
}

/** Современные / нефентезийные ярлыки. */
const ANACHRONISTIC_OCCUPATION_RE =
  /бирж|банк|инкасс|дириж|маклер|криминалист|аукцион|памфлет|спекулянт|сапёр|сапер|подрывник|инженер|архитектор|адвокат|коронер|парикмахер|массажист|модниц|миротворец|рекрутёр|рекрутер|фермер|механик|организатор|детектив|полиц|офицер|менеджер|бухгалтер|секретар|журналист|редактор|программист|пилот|водитель|такси|кассир|оператор|техник|хирург|психиатр|психолог|стоматолог|ветеринар(?! )/iu;

/** Классовые фичи / заклинания, случайно попавшие в «профессии». */
const FEATURE_OCCUPATION_RE =
  /удар|атак|заговор|заклинани|ярость|действие|критическ|дополнительн|улучшенн|бонусн|умения|владени|спасброс|преимущ|ячейк|реакци|круг земли|домена |клятвы |скрытая|исподтишка|хитроумн|бесчестн|выверенн|отражение|усиленн|шокирующ|сияющ|благословлён|безрассудн|жестокий|лепка |запоминание |фирменные |мастер заклина|добыча охотника|драконьи закл|заклинания бестии/iu;

const OCCUPATION_DENYLIST = new Set([
  'кошель',
  'приют для верных',
  'сапёр',
  'сапер',
  'подрывник',
  'инженер осад',
  'архитектор',
  'адвокат',
  'коронер',
  'парикмахер',
  'банщик-массажист',
  'модница-портниха',
  'миротворец',
  'сектант-рекрутёр',
  'механик големов',
  'фермер',
  'организатор турниров',
  'аукционист',
]);

function isLikelyOccupation(label) {
  if (!label || label.length < 3 || label.length > 40) return false;
  if (OCCUPATION_DENYLIST.has(label.toLowerCase())) return false;
  if (ANACHRONISTIC_OCCUPATION_RE.test(label)) return false;
  if (FEATURE_OCCUPATION_RE.test(label)) return false;
  return true;
}

const npc = {
  races,
  occupations: uniq([
    ...(foundryRu?.occupations ?? []).filter(isLikelyOccupation),
    ...seedOccupations,
  ]).filter(isLikelyOccupation),
  // Mausritter-внешность («венок из маргариток») не мешаем в общий пул — мышиная тематика
  appearances: uniq([...seedAppearances]),
  mannerisms: uniq([...seedMannerisms]),
  secrets: uniq(secrets),
  goals: uniq([...seedGoals]),
  sources: {
    foundryRu: Boolean(foundryRu),
    pynames: Boolean(pynames?.cultures),
    personNamesFromFoundry: 0,
    mausritterNames: mausNames.length,
  },
};

const tavern = {
  types: establishmentTypes,
  adjectives,
  nouns,
  keepers: uniq(keepers),
  atmospheres: uniq(atmospheres),
  signatureItems: uniq(signatureItems),
  events: uniq(events),
  rumors: uniq(rumors),
  // сырые EN-таблицы community/lorebench — для справки/будущего перевода
  importedEn: {
    tavernNames: communityItems(community, 'tavernNames'),
    tavernEvents: communityItems(community, 'tavernEvents'),
    tavernFood: communityItems(community, 'tavernFood'),
    tavernDrinks: communityItems(community, 'tavernDrinks'),
    lorebenchTaverns: lorebench?.tables?.tavernInnNames?.items ?? [],
    lorebenchRumors: lorebench?.tables?.tavernRumors?.items ?? [],
  },
};

const importedPlaces = loadPlaceNames();

const kingdom = {
  names: importedPlaces.kingdoms,
  governments,
  rulerTitles: uniq(rulerTitles),
  rulerTraits: uniq(rulerTraits),
  crises: uniq(crises),
  factionSpheres: uniq(factionSpheres),
  factionNames: expandFactionNames(),
  emblems: uniq(emblems),
  mottos: uniq(mottos),
  hiddenAgendas: uniq(hiddenAgendas),
  importedEn: {
    factions: communityItems(community, 'factions'),
    lorebenchFactions: lorebench?.tables?.factionsGuilds?.items ?? [],
  },
};

const settlement = {
  sizes: settlementSizes,
  names: importedPlaces.settlements,
  byType: Object.fromEntries(
    settlementSizes.map((size) => {
      const pack = settlementByType[size.key] ?? { landmarks: [], problems: [] };
      return [
        size.key,
        {
          landmarks: uniq(pack.landmarks ?? []),
          problems: uniq(pack.problems ?? []),
        },
      ];
    }),
  ),
  importedEn: {
    villages: communityItems(community, 'villages'),
    towns: communityItems(community, 'towns'),
    cityTownNames: lorebench?.tables?.cityTownNames?.items ?? [],
  },
};

const dungeon = {
  names: expandDungeonNames(),
  originalPurposes: uniq(originalPurposes),
  currentThreats: uniq(seedThreats),
  traps: uniq(traps),
  treasures: uniq(treasures),
  importedEn: {
    dungeonEncounters: communityItems(community, 'dungeonEncounters'),
    dungeonRooms: lorebench?.tables?.dungeonRooms?.items ?? [],
    questHooks: lorebench?.tables?.questHooks?.items ?? [],
  },
};

assertNonEmpty('races', npc.races);
assertNonEmpty('occupations', npc.occupations);
assertNonEmpty('tavern.types', tavern.types);
assertNonEmpty('kingdom.names', kingdom.names);
assertNonEmpty('settlement.names', settlement.names);
for (const size of settlement.sizes) {
  const pack = settlement.byType?.[size.key];
  assertNonEmpty(`settlement.byType.${size.key}.landmarks`, pack?.landmarks);
  assertNonEmpty(`settlement.byType.${size.key}.problems`, pack?.problems);
}
assertNonEmpty('dungeon.names', dungeon.names);

for (const race of npc.races) {
  if (!race.names?.m?.length || !race.names?.f?.length) {
    throw new Error(`Раса ${race.key}: нет имён М/Ж`);
  }
}

writeJson('npc.json', npc);
writeJson('tavern.json', tavern);
writeJson('kingdom.json', kingdom);
writeJson('settlement.json', settlement);
writeJson('dungeon.json', dungeon);
writeJson('sources.json', {
  pynames: pynames
    ? {
        source: pynames.source,
        cultures: Object.fromEntries(
          Object.entries(pynames.cultures).map(([k, v]) => [
            k,
            { m: v.m?.length ?? 0, f: v.f?.length ?? 0 },
          ]),
        ),
      }
    : null,
  foundryRu: foundryRu
    ? {
        source: foundryRu.source,
        raceLabels: foundryRu.raceLabels.length,
        personNamesIgnored: foundryRu.personNames.length,
        occupations: foundryRu.occupations.length,
        monsters: foundryRu.monsterNames.length,
        mausritter: {
          givenNames: foundryRu.mausritter.givenNames.length,
          surnames: foundryRu.mausritter.surnames.length,
          appearances: foundryRu.mausritter.appearances.length,
          mannerisms: foundryRu.mausritter.mannerisms.length,
          goals: foundryRu.mausritter.goals.length,
          landmarks: foundryRu.mausritter.landmarks.length,
        },
      }
    : null,
  community: community?.source ?? null,
  lorebench: lorebench?.source ?? null,
  places: (() => {
    const places = loadScraped('places.json');
    if (!places) return null;
    return {
      sources: places.sources,
      kingdoms: importedPlaces.kingdoms.length,
      settlements: importedPlaces.settlements.length,
      stats: places.stats,
    };
  })(),
});

const raceNameCount = npc.races.reduce(
  (sum, r) => sum + r.names.m.length + r.names.f.length,
  0,
);

const stats = {
  races: npc.races.length,
  raceNames: raceNameCount,
  occupations: npc.occupations.length,
  appearances: npc.appearances.length,
  mannerisms: npc.mannerisms.length,
  secrets: npc.secrets.length,
  goals: npc.goals.length,
  tavernTypes: tavern.types.length,
  tavernAdjectives:
    tavern.adjectives.m.length + tavern.adjectives.f.length + tavern.adjectives.n.length,
  tavernNouns: tavern.nouns.m.length + tavern.nouns.f.length + tavern.nouns.n.length,
  keepers: tavern.keepers.length,
  atmospheres: tavern.atmospheres.length,
  signatureItems: tavern.signatureItems.length,
  events: tavern.events.length,
  rumors: tavern.rumors.length,
  kingdomNames: kingdom.names.length,
  governments: kingdom.governments.length,
  crises: kingdom.crises.length,
  factionNames: kingdom.factionNames.length,
  settlementNames: settlement.names.length,
  landmarks: Object.values(settlement.byType).reduce(
    (sum, pack) => sum + (pack.landmarks?.length ?? 0),
    0,
  ),
  problems: Object.values(settlement.byType).reduce(
    (sum, pack) => sum + (pack.problems?.length ?? 0),
    0,
  ),
  dungeonNames: dungeon.names.length,
  originalPurposes: dungeon.originalPurposes.length,
  currentThreats: dungeon.currentThreats.length,
  traps: dungeon.traps.length,
  treasures: dungeon.treasures.length,
};

writeJson('stats.json', stats);

const indexTs = `/* Автогенерация: scripts/gm-toolkit/build-tables.mjs — не править руками */
import npc from './npc.json';
import tavern from './tavern.json';
import kingdom from './kingdom.json';
import settlement from './settlement.json';
import dungeon from './dungeon.json';
import stats from './stats.json';

export { npc, tavern, kingdom, settlement, dungeon, stats };
export default { npc, tavern, kingdom, settlement, dungeon, stats };
`;

fs.writeFileSync(path.join(OUT_DIR, 'index.ts'), indexTs, 'utf8');

console.log('GM Toolkit — статистика таблиц\n');
console.log(
  `Источники: pynames=${pynames ? 'да' : 'нет'}, fantasy-names=${fantasyNames ? 'да' : 'нет'}, foundry-vtt-ru=${foundryRu ? 'да' : 'нет'}, community=${community ? 'да' : 'нет'}, lorebench=${lorebench ? 'да' : 'нет'}`,
);
const pynamesRaceCount = races.filter((r) => r.nameSource === 'pynames').length;
console.log(
  `  Имена: pynames на ${pynamesRaceCount} расах (Foundry personNames отключены); Mausritter: ${mausNames.length}`,
);
console.log('── NPC ──');
console.log(`  Расы:              ${stats.races}`);
console.log(`  Имена (всего):     ${stats.raceNames}`);
console.log(`  Профессии:         ${stats.occupations}`);
console.log(`  Внешность:         ${stats.appearances}`);
console.log(`  Манеры:            ${stats.mannerisms}`);
console.log(`  Секреты:           ${stats.secrets}`);
console.log(`  Цели:              ${stats.goals}`);
console.log('── Таверны ──');
console.log(`  Типы заведений:    ${stats.tavernTypes}`);
console.log(`  Прилагательные:    ${stats.tavernAdjectives}`);
console.log(`  Существительные:   ${stats.tavernNouns}`);
console.log(`  Хозяева:           ${stats.keepers}`);
console.log(`  Атмосфера:         ${stats.atmospheres}`);
console.log(`  Фирменные блюда:   ${stats.signatureItems}`);
console.log(`  Происшествия:      ${stats.events}`);
console.log(`  Слухи:             ${stats.rumors}`);
console.log('── Королевства / фракции ──');
console.log(`  Названия земель:   ${stats.kingdomNames}`);
console.log(`  Формы правления:   ${stats.governments}`);
console.log(`  Кризисы:           ${stats.crises}`);
console.log(`  Фракции:           ${stats.factionNames}`);
console.log('── Поселения ──');
console.log(`  Названия:          ${stats.settlementNames}`);
console.log(`  Доминанты:         ${stats.landmarks}`);
console.log(`  Проблемы:          ${stats.problems}`);
console.log('── Подземелья ──');
console.log(`  Названия:          ${stats.dungeonNames}`);
console.log(`  Назначения:        ${stats.originalPurposes}`);
console.log(`  Угрозы:            ${stats.currentThreats}`);
console.log(`  Ловушки:           ${stats.traps}`);
console.log(`  Сокровища:         ${stats.treasures}`);
console.log(`\nЗаписано в ${OUT_DIR}`);
