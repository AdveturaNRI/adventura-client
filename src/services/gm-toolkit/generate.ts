import { dungeon, kingdom, npc, settlement, tavern } from '@/data/gm-toolkit';

import { pickFresh, pickOne } from './pick';
import type {
  DungeonCard,
  Gender,
  KingdomCard,
  NpcCard,
  RaceDef,
  SettlementCard,
  TavernCard,
} from './types';

type GenderResolved = 'm' | 'f';
type NounGender = 'm' | 'f' | 'n';

function resolveGender(gender: Gender, rng: () => number): GenderResolved {
  if (gender === 'random') {
    return rng() < 0.5 ? 'm' : 'f';
  }
  return gender;
}

/**
 * JS `\b` не считает кириллицу «словом» — границы по Unicode-буквам.
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function ruWordRe(word: string): RegExp {
  return new RegExp(`(?<!\\p{L})${escapeRegExp(word)}(?!\\p{L})`, 'giu');
}

function applyRuWordFixes(text: string, fixes: readonly [string, string][]): string {
  let out = text;
  for (const [from, to] of fixes) {
    out = out.replace(ruWordRe(from), to);
  }
  return out;
}

/**
 * Согласование славянских фамилий по полу.
 * Составные прозвища («Серый Волк») и неславянские фамилии не трогаем.
 */
export function inflectSurname(surname: string, gender: GenderResolved): string {
  const value = surname.trim();
  if (!value || gender === 'm') return value;
  if (/\s/.test(value) || /[-'’]/.test(value)) return value;
  if (/^(аль-|ибн\s)/i.test(value)) return value;

  const lower = value.toLowerCase();

  const rules: [RegExp, string][] = [
    [/ский$/u, 'ская'],
    [/цкий$/u, 'цкая'],
    [/ской$/u, 'ская'],
    [/цкой$/u, 'цкая'],
    [/ний$/u, 'няя'],
    [/ный$/u, 'ная'],
    [/евой$/u, 'евая'],
    [/овой$/u, 'овая'],
    [/ной$/u, 'ная'],
    [/овый$/u, 'овая'],
    [/евый$/u, 'евая'],
    [/ов$/u, 'ова'],
    [/ев$/u, 'ева'],
    [/ёв$/u, 'ёва'],
    [/ин$/u, 'ина'],
    [/ын$/u, 'ына'],
  ];

  for (const [pattern, ending] of rules) {
    const match = lower.match(pattern);
    if (!match) continue;
    return value.slice(0, value.length - match[0].length) + ending;
  }

  return value;
}

/**
 * Согласование прошедшего / кратких форм в секретах и целях по полу NPC.
 * Словарь вместо слепой морфологии — «журнал» не превратится в «журнала».
 */
const FEMALE_PHRASE_FIXES: [string, string][] = [
  // Сначала целые фразы — иначе одиночные глаголы ломают «сам …»
  ['сам основал', 'сама основала'],
  ['теперь сам цель', 'теперь сама цель'],
  ['считается мёртвым', 'считается мёртвой'],
  ['как дезертира', 'как дезертирку'],
  ['не помнит, кто он был', 'не помнит, кем она была'],
  ['его «смерть»', 'её «смерть»'],
  ['двоюродный брат', 'двоюродная сестра'],
  ['незаконнорождённый ребёнок знати', 'незаконнорождённая дочь знати'],
  ['боится, что его узнают', 'боится, что её узнают'],
  ['подменил', 'подменила'],
  ['убил', 'убила'],
  ['бежал', 'бежала'],
  ['отравил', 'отравила'],
  ['украл', 'украла'],
  ['закопал', 'закопала'],
  ['продал', 'продала'],
  ['подделал', 'подделала'],
  ['потерял', 'потеряла'],
  ['сбежал', 'сбежала'],
  ['дезертировал', 'дезертировала'],
  ['подкупил', 'подкупила'],
  ['фальсифицировал', 'фальсифицировала'],
  ['воровал', 'воровала'],
  ['похитил', 'похитила'],
  ['нашёл', 'нашла'],
  ['открыл', 'открыла'],
  ['закрыл', 'закрыла'],
  ['вызвал', 'вызвала'],
  ['пробовал', 'пробовала'],
  ['видел', 'видела'],
  ['помог', 'помогла'],
  ['утопил', 'утопила'],
  ['инсценировал', 'инсценировала'],
  ['передумал', 'передумала'],
  ['собрал', 'собрала'],
  ['основал', 'основала'],
  ['поджёг', 'подожгла'],
  ['поджег', 'подожгла'],
  ['нанял', 'наняла'],
  ['приехал', 'приехала'],
  ['отомстил', 'отомстила'],
  ['обещал', 'обещала'],
  ['приписал', 'приписала'],
  ['помолвлен', 'помолвлена'],
  ['не смог', 'не смогла'],
  ['связан', 'связана'],
  ['заражён', 'заражена'],
  ['заражен', 'заражена'],
  ['должен', 'должна'],
  ['обязан', 'обязана'],
  ['последний из', 'последняя из'],
];

export function agreePhraseGender(text: string, gender: GenderResolved): string {
  if (gender === 'm' || !text) return text;
  return applyRuWordFixes(text, FEMALE_PHRASE_FIXES);
}

function buildNpcName(race: RaceDef, gender: GenderResolved, rng: () => number): string {
  const given = pickFresh(`npc.name.${race.key}.${gender}`, race.names[gender], rng);
  if (race.clans?.length) {
    const clan = pickFresh(`npc.clan.${race.key}`, race.clans, rng);
    return `${given} из клана «${clan}»`;
  }
  if (race.surnames?.length) {
    const raw = pickFresh(`npc.surname.${race.key}`, race.surnames, rng);
    return `${given} ${inflectSurname(raw, gender)}`;
  }
  return given;
}

export function listRaces(): RaceDef[] {
  return npc.races as RaceDef[];
}

export function findRace(raceKey: string): RaceDef | undefined {
  return listRaces().find((race) => race.key === raceKey);
}

export type GenerateNpcOptions = {
  occupation?: string;
  rng?: () => number;
};

/** Возраст «взрослого» NPC по расе (лет). */
function ageRangeForRace(raceKey: string): [number, number] {
  const key = raceKey.toLowerCase();
  if (key.startsWith('elf_')) return [80, 750];
  if (key.startsWith('dwarf_')) return [50, 350];
  if (key.startsWith('gnome_')) return [40, 350];
  if (key === 'halfling') return [20, 120];
  if (key === 'dragonborn') return [15, 70];
  if (key === 'tiefling') return [18, 90];
  if (key === 'orc') return [12, 50];
  if (key === 'goblin' || key === 'kobold') return [8, 40];
  if (key === 'hobgoblin' || key === 'bugbear') return [14, 60];
  if (key.startsWith('gith')) return [20, 100];
  if (key === 'aasimar') return [18, 120];
  if (key === 'firbolg') return [30, 200];
  if (key === 'triton') return [20, 150];
  if (key === 'tabaxi' || key === 'kenku' || key === 'changeling') return [16, 70];
  if (key === 'yuan_ti') return [18, 120];
  return [16, 70];
}

function rollAge(raceKey: string, rng: () => number): number {
  const [min, max] = ageRangeForRace(raceKey);
  return min + Math.floor(rng() * (max - min + 1));
}

function formatAgeYears(age: number): string {
  const mod10 = age % 10;
  const mod100 = age % 100;
  if (mod10 === 1 && mod100 !== 11) return `${age} год`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${age} года`;
  return `${age} лет`;
}

export function generateNPC(
  raceKey: string | 'random' = 'random',
  gender: Gender = 'random',
  options: GenerateNpcOptions = {},
): NpcCard {
  const rng = options.rng ?? Math.random;
  const races = listRaces();
  const race =
    raceKey === 'random'
      ? pickFresh('npc.race', races, rng)
      : (findRace(raceKey) ?? pickFresh('npc.race', races, rng));
  const resolvedGender = resolveGender(gender, rng);
  const name = buildNpcName(race, resolvedGender, rng);
  const age = rollAge(race.key, rng);
  const occupation = options.occupation ?? pickFresh('npc.occupation', npc.occupations, rng);
  const appearance = pickFresh('npc.appearance', npc.appearances, rng);
  const mannerism = pickFresh('npc.mannerism', npc.mannerisms, rng);
  const secret = agreePhraseGender(pickFresh('npc.secret', npc.secrets, rng), resolvedGender);
  const goal = agreePhraseGender(pickFresh('npc.goal', npc.goals, rng), resolvedGender);

  const summary = `${name} — ${race.label}, ${formatAgeYears(age)}, ${occupation}. ${appearance}; ${mannerism}. Секрет: ${secret}.`;

  return {
    category: 'npc',
    name,
    raceKey: race.key,
    raceLabel: race.label,
    gender: resolvedGender,
    age,
    occupation,
    appearance,
    mannerism,
    secret,
    goal,
    summary,
  };
}

export type GenerateTavernOptions = {
  typeKey?: string | 'random';
  rng?: () => number;
};

export function generateTavern(options: GenerateTavernOptions = {}): TavernCard {
  const rng = options.rng ?? Math.random;
  const types = tavern.types;
  const type =
    options.typeKey && options.typeKey !== 'random'
      ? (types.find((item) => item.key === options.typeKey) ?? pickOne(types, rng))
      : pickFresh('tavern.type', types, rng);

  const genders: NounGender[] = ['m', 'f', 'n'];
  const nounGender = pickFresh('tavern.gender', genders, rng);
  const adj = pickFresh(`tavern.adj.${nounGender}`, tavern.adjectives[nounGender], rng);
  const noun = pickFresh(`tavern.noun.${nounGender}`, tavern.nouns[nounGender], rng);
  const name = `${adj} ${noun}`;

  const keeper = pickFresh('tavern.keeper', tavern.keepers, rng);
  const atmosphere = pickFresh('tavern.atmosphere', tavern.atmospheres, rng);
  const signature = pickFresh('tavern.signature', tavern.signatureItems, rng);
  const event = pickFresh('tavern.event', tavern.events, rng);
  const rumor = pickFresh('tavern.rumor', tavern.rumors, rng);

  const summary = `${name} (${type.label}). Хозяин: ${keeper}. Фирменное: ${signature}. Сейчас: ${event}. Слух: ${rumor}.`;

  return {
    category: 'tavern',
    name,
    typeKey: type.key,
    typeLabel: type.label,
    keeper,
    atmosphere,
    signature,
    event,
    rumor,
    summary,
  };
}

export type GenerateKingdomOptions = {
  rng?: () => number;
};

/** Правители королевств — не только славяне. */
const RULER_RACE_KEYS = [
  'human_nordic',
  'human_celtic',
  'human_arabic',
  'human_greek',
  'human_asian',
  'human_slavic',
  'elf_high',
  'elf_wood',
  'elf_eladrin',
  'dwarf_mountain',
  'dwarf_hill',
  'halfling',
  'tiefling',
  'dragonborn',
  'aasimar',
  'orc',
  'githyanki',
  'firbolg',
] as const;

const FEMALE_TRAIT_FIXES: [string, string][] = [
  ['справедливый', 'справедливая'],
  ['жёсткий', 'жёсткая'],
  ['жесткий', 'жёсткая'],
  ['мягкий', 'мягкая'],
  ['нерешительный', 'нерешительная'],
  ['параноидальный', 'параноидальная'],
  ['молодой', 'молодая'],
  ['горячий', 'горячая'],
  ['старый', 'старая'],
  ['уставший', 'уставшая'],
  ['щедрый', 'щедрая'],
  ['скупой', 'скупая'],
  ['благочестивый', 'благочестивая'],
  ['скрытый', 'скрытая'],
  ['талантливый', 'талантливая'],
  ['болен', 'больна'],
  ['одержим', 'одержима'],
  ['любим', 'любима'],
  ['труслив', 'труслива'],
];

function agreeRulerTrait(trait: string, gender: GenderResolved): string {
  if (gender === 'm' || !trait) return trait;
  return applyRuWordFixes(trait, FEMALE_TRAIT_FIXES);
}

function pickRulerRace(rng: () => number): RaceDef {
  const pool = RULER_RACE_KEYS.map((key) => findRace(key)).filter(
    (race): race is RaceDef => Boolean(race),
  );
  if (!pool.length) return pickFresh('npc.race', listRaces(), rng);
  return pickFresh('kingdom.rulerRace', pool, rng);
}

export function generateKingdom(options: GenerateKingdomOptions = {}): KingdomCard {
  const rng = options.rng ?? Math.random;
  const name = pickFresh('kingdom.name', kingdom.names, rng);
  const governmentDef = pickFresh('kingdom.government', kingdom.governments, rng);
  const government = governmentDef.label;
  const governmentDescription = governmentDef.description;

  const race = pickRulerRace(rng);
  const gender = resolveGender('random', rng);
  const trait = agreeRulerTrait(
    pickFresh('kingdom.trait', kingdom.rulerTraits, rng),
    gender,
  );
  const rulerName = buildNpcName(race, gender, rng);
  const ruler = `${rulerName} (${race.label}) — ${trait}`;

  const crisis = pickFresh('kingdom.crisis', kingdom.crises, rng);
  const faction = pickFresh('kingdom.faction', kingdom.factionNames, rng);
  const factionSphere = pickFresh('kingdom.sphere', kingdom.factionSpheres, rng);
  const emblem = pickFresh('kingdom.emblem', kingdom.emblems, rng);
  const motto = pickFresh('kingdom.motto', kingdom.mottos, rng);
  const hiddenAgenda = pickFresh('kingdom.agenda', kingdom.hiddenAgendas, rng);

  const summary = `${name}. ${government}: ${governmentDescription} Правитель: ${ruler}. Кризис: ${crisis}. Фракция «${faction}» (${factionSphere}).`;

  return {
    category: 'kingdom',
    name,
    government,
    governmentDescription,
    ruler,
    crisis,
    faction,
    factionSphere,
    emblem,
    motto,
    hiddenAgenda,
    summary,
  };
}

export type GenerateSettlementOptions = {
  size?: string | 'random';
  rng?: () => number;
};

export function generateSettlement(
  size: string | 'random' = 'random',
  options: GenerateSettlementOptions = {},
): SettlementCard {
  const rng = options.rng ?? Math.random;
  const sizeKey = options.size ?? size;
  const sizes = settlement.sizes;
  const sizeDef =
    sizeKey !== 'random'
      ? (sizes.find((item) => item.key === sizeKey) ?? pickOne(sizes, rng))
      : pickFresh('settlement.size', sizes, rng);

  const pack =
    settlement.byType?.[sizeDef.key] ??
    ({ landmarks: [] as string[], problems: [] as string[] } as const);
  const landmarks = pack.landmarks?.length ? pack.landmarks : (['пустое место'] as string[]);
  const problems = pack.problems?.length ? pack.problems : (['тишина тревожит'] as string[]);

  const name = pickFresh('settlement.name', settlement.names, rng);
  const landmark = pickFresh(`settlement.landmark.${sizeDef.key}`, landmarks, rng);
  const problem = pickFresh(`settlement.problem.${sizeDef.key}`, problems, rng);

  const summary = `${name} — ${sizeDef.label}. Особенность: ${landmark}. Проблема: ${problem}.`;

  return {
    category: 'settlement',
    name,
    sizeKey: sizeDef.key,
    sizeLabel: sizeDef.label,
    landmark,
    problem,
    summary,
  };
}

export type GenerateDungeonOptions = {
  rng?: () => number;
};

export function generateDungeon(options: GenerateDungeonOptions = {}): DungeonCard {
  const rng = options.rng ?? Math.random;
  const name = pickFresh('dungeon.name', dungeon.names, rng);
  const originalPurpose = pickFresh('dungeon.purpose', dungeon.originalPurposes, rng);
  const currentThreat = pickFresh('dungeon.threat', dungeon.currentThreats, rng);
  const trap = pickFresh('dungeon.trap', dungeon.traps, rng);
  const treasure = pickFresh('dungeon.treasure', dungeon.treasures, rng);

  const summary = `${name}. Было: ${originalPurpose}. Сейчас: ${currentThreat}. Опасность: ${trap}. Слух о сокровище: ${treasure}.`;

  return {
    category: 'dungeon',
    name,
    originalPurpose,
    currentThreat,
    trap,
    treasure,
    summary,
  };
}

export function listTavernTypes() {
  return tavern.types;
}

export function listSettlementSizes() {
  return settlement.sizes;
}
