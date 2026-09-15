/**
 * EN → RU для фентезийных имён:
 * - личные имена: фонетическая транслитерация (Alston → Альстон)
 * - составные фамилии: перевод корней + склейка (Tealeaf → Чайлист)
 */

const DIGRAPHS = [
  ['sch', 'ш'],
  ['tch', 'тч'],
  ['chr', 'кр'],
  ['ch', 'ч'],
  ['sh', 'ш'],
  ['th', 'т'],
  ['ph', 'ф'],
  ['gh', 'г'],
  ['ck', 'к'],
  ['qu', 'кв'],
  ['wh', 'у'],
  ['wr', 'р'],
  ['kn', 'н'],
  ['ng', 'нг'],
  ['zh', 'ж'],
  ['kh', 'х'],
  ['oe', 'ё'],
  ['ae', 'э'],
  ['ia', 'иа'],
  ['io', 'ио'],
  ['iu', 'иу'],
  ['ya', 'я'],
  ['yo', 'ё'],
  ['yu', 'ю'],
  ['ye', 'е'],
  ['oo', 'у'],
  ['ee', 'и'],
  ['ea', 'и'],
  ['ou', 'ау'],
  ['au', 'ау'],
  ['ai', 'ай'],
  ['ay', 'эй'],
  ['oi', 'ой'],
  ['oy', 'ой'],
  ['ew', 'ью'],
  ['aw', 'о'],
  ['ow', 'оу'],
];

const LETTERS = {
  a: 'а', b: 'б', c: 'к', d: 'д', e: 'е', f: 'ф', g: 'г', h: 'х',
  i: 'и', j: 'дж', k: 'к', l: 'л', m: 'м', n: 'н', o: 'о', p: 'п',
  q: 'к', r: 'р', s: 'с', t: 'т', u: 'у', v: 'в', w: 'в', x: 'кс',
  y: 'и', z: 'з', ä: 'э', ö: 'ё', ü: 'ю',
  á: 'а', é: 'е', í: 'и', ó: 'о', ú: 'у',
};

/** Полные русские формы корней (не обрубки). */
const ROOT_RU = {
  good: 'добро',
  tea: 'чай',
  leaf: 'лист',
  under: 'под',
  bough: 'ветвь',
  tall: 'высокий',
  fellow: 'брат',
  hard: 'крепкий',
  bottle: 'бутыль',
  hill: 'холм',
  topple: 'шатун',
  thorn: 'шип',
  gage: 'мера',
  reed: 'тростник',
  bank: 'берег',
  whisper: 'шёпот',
  shadow: 'тень',
  spring: 'родник',
  tumble: 'кувырок',
  fizzle: 'шипение',
  bang: 'хлопок',
  muddle: 'путаница',
  foot: 'ступня',
  baffle: 'загадка',
  gab: 'болтовня',
  twinkle: 'мерцание',
  toe: 'палец',
  toes: 'пальцы',
  spark: 'искра',
  gem: 'самоцвет',
  glimmer: 'блеск',
  gear: 'шестерня',
  stone: 'камень',
  crystal: 'кристалл',
  whistle: 'свисток',
  iron: 'железо',
  maw: 'пасть',
  blood: 'кровь',
  tusk: 'клык',
  skull: 'череп',
  cleaver: 'секач',
  ash: 'пепел',
  walker: 'ходец',
  agate: 'агат',
  anvil: 'наковальня',
  axe: 'топор',
  beard: 'борода',
  breaker: 'лом',
  delver: 'копатель',
  fist: 'кулак',
  forge: 'кузня',
  gold: 'золото',
  grim: 'хмурый',
  jade: 'нефрит',
  lead: 'свинец',
  long: 'длинный',
  oak: 'дуб',
  obsidian: 'обсидиан',
  onyx: 'оникс',
  plate: 'пластина',
  quartz: 'кварц',
  raven: 'ворон',
  silver: 'серебро',
  slate: 'сланец',
  spear: 'копьё',
  true: 'правда',
  black: 'чёрный',
  dark: 'тёмный',
  fire: 'огонь',
  flame: 'пламя',
  helm: 'шлем',
  shield: 'щит',
  pick: 'кайло',
  mine: 'шахта',
  tooth: 'зуб',
  green: 'зелёный',
  bramble: 'терновник',
  moss: 'мох',
  river: 'река',
  wind: 'ветер',
  moon: 'луна',
  star: 'звезда',
  sun: 'солнце',
  snow: 'снег',
  frost: 'мороз',
  thunder: 'гром',
  storm: 'буря',
  light: 'свет',
  bright: 'яркий',
  quick: 'быстрый',
  sweet: 'сладкий',
  honey: 'мёд',
  berry: 'ягода',
  pipe: 'трубка',
  weed: 'трава',
  barrel: 'бочка',
  burrow: 'нора',
  bridge: 'мост',
  field: 'поле',
  wood: 'лес',
  forest: 'лес',
  mountain: 'гора',
  deep: 'глубь',
  high: 'высь',
  low: 'низ',
  red: 'красный',
  white: 'белый',
  blue: 'синий',
  gray: 'серый',
  grey: 'серый',
  cog: 'зубчатка',
  tink: 'звяк',
  top: 'верх',
  mud: 'грязь',
  puddle: 'лужа',
  badger: 'барсук',
  cloak: 'плащ',
  aleslosh: 'пивохлёб',
  sparklegem: 'искроцвет',
  cogs: 'шестерёнки',
  bimp: 'бимп',
  ashhearth: 'пепельный очаг',
};

function titleRu(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function endsWithVowel(s) {
  return /[аеёиоуыэюя]$/iu.test(s);
}

function startsWithVowel(s) {
  return /^[аеёиоуыэюя]/iu.test(s);
}

/** Склейки в одно слово без соединительной «о». */
const TIGHT = new Set([
  'чай лист',
  'шёпот лист',
  'добро бочка',
  'искра камень',
  'тень ветвь',
  'под ветвь',
  'кровь клык',
  'железо пасть',
  'агат топор',
  'агат борода',
  'агат кулак',
  'агат кузня',
  'агат ступня',
  'агат лом',
  'шип мера',
  'холм шатун',
]);

function glueRuParts(parts) {
  if (parts.length === 1) return titleRu(parts[0]);
  const spaced = parts.map((p) => p.toLowerCase()).join(' ');
  if (parts.length === 2 && TIGHT.has(spaced)) {
    return titleRu(parts.map((p) => p.toLowerCase()).join(''));
  }
  // только короткие префиксы: добро+бочка, чай+лист
  if (parts.length === 2) {
    const a = parts[0].toLowerCase();
    const b = parts[1].toLowerCase();
    if (a.length <= 5 && (endsWithVowel(a) || startsWithVowel(b))) {
      return titleRu(a + b);
    }
  }
  return parts.map((p) => titleRu(p.toLowerCase())).join(' ');
}

/** Фонетическая транслитерация одного латинского слова. */
export function translitWord(word) {
  let s = String(word || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-zа-яё]/giu, '');
  if (!s) return '';
  if (/^[а-яё]+$/iu.test(s)) return titleRu(s);

  let out = '';
  let i = 0;
  while (i < s.length) {
    let matched = false;
    for (const [lat, ru] of DIGRAPHS) {
      if (s.startsWith(lat, i)) {
        out += ru;
        i += lat.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    out += LETTERS[s[i]] || s[i];
    i += 1;
  }
  out = out.replace(/кк/g, 'к').replace(/сс$/g, 'с').replace(/ии+/g, 'и');
  return titleRu(out);
}

function splitCamel(text) {
  return text.split(/(?=[A-Z])/).filter(Boolean);
}

function greedyRoots(lower) {
  const roots = Object.keys(ROOT_RU).sort((a, b) => b.length - a.length);
  const parts = [];
  let rest = lower;
  while (rest.length) {
    let hit = null;
    for (const root of roots) {
      if (rest.startsWith(root)) {
        hit = root;
        break;
      }
    }
    if (!hit) break;
    parts.push(ROOT_RU[hit]);
    rest = rest.slice(hit.length);
  }
  return { parts, rest };
}

/**
 * Только фонетика: Fizzlebang → Физзлбанг, не «Шипение Хлопок».
 * Составные EN-имена склеиваются в одно слово перед транслитом.
 */
export function translitName(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';
  if (/^\{\{/.test(text)) return '';
  if (/^[А-ЯЁа-яё]/.test(text) && !/[A-Za-z]/.test(text)) {
    // уже по-русски, но многословные «фамилии» из старого перевода отбрасываем
    if (/\s/.test(text)) return '';
    return text;
  }

  const flat = text
    .replace(/([a-zа-яё])([A-ZА-ЯЁ])/gu, '$1$2')
    .replace(/[\s'_-]+/g, '')
    .toLowerCase();
  const out = translitWord(flat);
  if (!out || out.length < 2 || out.length > 22) return '';
  if (/\s/.test(out)) return '';
  return out;
}

/**
 * @deprecated semantic mode давал «Шипение Хлопок» — по умолчанию фонетика.
 */
export function translateFantasyName(raw, { mode = 'phonetic' } = {}) {
  if (mode === 'phonetic') return translitName(raw);

  const text = String(raw || '').trim();
  if (!text) return '';
  if (/^\{\{/.test(text)) return '';
  if (/^[А-ЯЁа-яё]/.test(text) && !/[A-Za-z]/.test(text)) return text;

  if (/\s/.test(text)) {
    return text
      .split(/\s+/)
      .map((w) => translateFantasyName(w, { mode: 'semantic' }))
      .filter(Boolean)
      .join(' ');
  }

  const lower = text.toLowerCase();
  if (ROOT_RU[lower]) return titleRu(ROOT_RU[lower]);

  const camel = splitCamel(text);
  if (camel.length > 1) {
    const mapped = camel.map((p) => {
      const l = p.toLowerCase();
      return ROOT_RU[l] || translitWord(p).toLowerCase();
    });
    return glueRuParts(mapped);
  }

  const { parts, rest } = greedyRoots(lower);
  if (parts.length && !rest) return glueRuParts(parts);
  if (parts.length && rest.length <= 5) {
    return glueRuParts([...parts, translitWord(rest).toLowerCase()]);
  }

  return translitWord(text);
}

export function translateList(arr, mode = 'phonetic') {
  return [
    ...new Set(
      (arr || [])
        .map((x) => (mode === 'phonetic' ? translitName(x) : translateFantasyName(x, { mode })))
        .filter(Boolean),
    ),
  ];
}
