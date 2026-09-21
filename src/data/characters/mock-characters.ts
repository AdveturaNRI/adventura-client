export type CharacterScope = 'mine' | 'community';

export type MockCharacter = {
  id: string;
  name: string;
  className: string;
  race: string;
  level: number;
  ownerName: string;
  system: string;
  isMine: boolean;
};

type CharacterTemplate = Omit<MockCharacter, 'id' | 'system' | 'ownerName'> & {
  ownerName?: string;
};

const CHARACTER_TEMPLATES: CharacterTemplate[] = [
  {
    name: 'Элара Ветрокрылая',
    className: 'Следопыт',
    race: 'Эльф',
    level: 7,
    isMine: true,
  },
  {
    name: 'Гром Камнебой',
    className: 'Варвар',
    race: 'Дворф',
    level: 5,
    isMine: true,
  },
  {
    name: 'Сильвия Ночная',
    className: 'Волшебница',
    race: 'Человек',
    level: 9,
    ownerName: 'Лена',
    isMine: false,
  },
  {
    name: 'Каэлен Теневой',
    className: 'Плут',
    race: 'Тифлинг',
    level: 4,
    ownerName: 'Артём',
    isMine: false,
  },
  {
    name: 'Брат Томас',
    className: 'Жрец',
    race: 'Человек',
    level: 6,
    isMine: true,
  },
  {
    name: 'Никс Шепчущая',
    className: 'Бард',
    race: 'Гоблин',
    level: 3,
    ownerName: 'Соня',
    isMine: false,
  },
  {
    name: 'Игорь Петров',
    className: 'Следователь',
    race: 'Человек',
    level: 1,
    ownerName: 'Даша',
    isMine: false,
  },
  {
    name: 'Мара Красная',
    className: 'Тореадор',
    race: 'Вампир',
    level: 8,
    ownerName: 'Влад',
    isMine: false,
  },
  {
    name: 'Рин Сато',
    className: 'Нетраннер',
    race: 'Человек',
    level: 4,
    ownerName: 'Кира',
    isMine: false,
  },
  {
    name: 'Хекс',
    className: 'Колдун',
    race: 'Полуорк',
    level: 6,
    isMine: true,
  },
  {
    name: 'Лира Солнечная',
    className: 'Паладин',
    race: 'Полуэльф',
    level: 8,
    ownerName: 'Оля',
    isMine: false,
  },
  {
    name: 'Вук',
    className: 'Воин',
    race: 'Человек',
    level: 2,
    ownerName: 'Макс',
    isMine: false,
  },
];

const FALLBACK_SYSTEM_NAMES = [
  'D&D 5e',
  'Pathfinder 2e',
  'Зов Ктулху',
  'Vampire: The Masquerade',
];

const PREFERRED_SYSTEM_HINTS = [
  'd&d',
  'dnd',
  'dungeons',
  'pathfinder',
  'ктулху',
  'cthulhu',
  'vampire',
  'вампир',
  'warhammer',
  'blades',
  'cyberpunk',
  'shadowrun',
  'savage',
];

export function pickMockCharacterSystems(catalogNames: string[]): string[] {
  if (catalogNames.length === 0) {
    return FALLBACK_SYSTEM_NAMES;
  }

  const preferred = catalogNames.filter((name) => {
    const lower = name.toLowerCase();
    return PREFERRED_SYSTEM_HINTS.some((hint) => lower.includes(hint));
  });

  const pool = preferred.length >= 3 ? preferred : catalogNames;
  return pool.slice(0, 8);
}

export function buildMockCharacters(
  systemNames: string[],
  ownerNickname = 'Вы',
): MockCharacter[] {
  const pool = systemNames.length > 0 ? systemNames : FALLBACK_SYSTEM_NAMES;

  return CHARACTER_TEMPLATES.map((template, index) => ({
    id: `mock-character-${index + 1}`,
    system: pool[index % pool.length],
    ...template,
    ownerName: template.isMine ? ownerNickname : (template.ownerName ?? 'Игрок'),
  }));
}

export function charactersByScope(
  items: MockCharacter[],
  scope: CharacterScope,
): MockCharacter[] {
  return items.filter((item) => (scope === 'mine' ? item.isMine : !item.isMine));
}

export function filterMockCharacters(
  items: MockCharacter[],
  query: string,
  systems: string[],
): MockCharacter[] {
  const needle = query.trim().toLowerCase();
  const systemSet = new Set(systems.map((name) => name.trim().toLowerCase()));

  return items.filter((item) => {
    if (systemSet.size > 0 && !systemSet.has(item.system.trim().toLowerCase())) {
      return false;
    }

    if (!needle) {
      return true;
    }

    return [item.name, item.className, item.race, item.system, item.ownerName]
      .join(' ')
      .toLowerCase()
      .includes(needle);
  });
}
