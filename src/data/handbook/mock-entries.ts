import type { HandbookCategory, HandbookCategoryFilter, HandbookEntry } from './types';

export const MOCK_HANDBOOK_ENTRIES: HandbookEntry[] = [
  // D&D 5e
  {
    id: 'dnd-race-elf',
    systemId: 'dnd5e',
    category: 'races',
    title: 'Эльф',
    summary: 'Долгожители лесов и городов. Темновидение, Fey Ancestry, бонус к ловкости.',
    tags: ['PHB', 'Humanoid'],
  },
  {
    id: 'dnd-race-dwarf',
    systemId: 'dnd5e',
    category: 'races',
    title: 'Дварф',
    summary: 'Стойкие горцы. Сопротивление яду, владение топорами, бонус к телосложению.',
    tags: ['PHB'],
  },
  {
    id: 'dnd-class-fighter',
    systemId: 'dnd5e',
    category: 'classes',
    title: 'Воин',
    summary: 'Боевой стиль, Second Wind, Action Surge. Архетипы от Champion до Eldritch Knight.',
    tags: ['PHB', 'Martial'],
  },
  {
    id: 'dnd-class-wizard',
    systemId: 'dnd5e',
    category: 'classes',
    title: 'Волшебник',
    summary: 'Книга заклинаний, ритуалы, школы магии. Arcane Recovery на коротком отдыхе.',
    tags: ['PHB', 'Caster'],
  },
  {
    id: 'dnd-spell-fireball',
    systemId: 'dnd5e',
    category: 'spells',
    title: 'Огненный шар',
    summary: '3-й круг, эвокация. Сфера 20 футов, 8d6 огня, спасбросок Ловкости.',
    tags: ['Evocation', '3'],
  },
  {
    id: 'dnd-eq-bag',
    systemId: 'dnd5e',
    category: 'equipment',
    title: 'Сумка хранения',
    summary: 'Экстрамерное пространство ~64 куб. фута. Вес содержимого не учитывается.',
    tags: ['Wondrous', 'Rare'],
  },
  {
    id: 'dnd-beast-owlbear',
    systemId: 'dnd5e',
    category: 'bestiary',
    title: 'Совомедведь',
    summary: 'CR 3. Мультиатака клювом и когтями, большой размер, тёмновидение.',
    tags: ['Monstrosity', 'CR 3'],
  },
  {
    id: 'dnd-rule-advantage',
    systemId: 'dnd5e',
    category: 'rules',
    title: 'Преимущество и помеха',
    summary: 'Бросаешь 2d20, берёшь больший или меньший. Не стакаются между собой.',
    tags: ['Core'],
  },

  // Pathfinder 2e
  {
    id: 'pf-ancestry-human',
    systemId: 'pf2e',
    category: 'races',
    title: 'Человек',
    summary: 'Гибкие предыстории и наследия. Два буста характеристик на выбор.',
    tags: ['Ancestry'],
  },
  {
    id: 'pf-class-rogue',
    systemId: 'pf2e',
    category: 'classes',
    title: 'Плут',
    summary: 'Sneak Attack, racket на 1 уровне, куча skill feats. Ключевой атрибут — Ловкость.',
    tags: ['Martial'],
  },
  {
    id: 'pf-spell-heal',
    systemId: 'pf2e',
    category: 'spells',
    title: 'Heal',
    summary: '1–3 действия: касание, 30 футов или область. Лечит живых, жжёт нежить.',
    tags: ['Necromancy', 'Font'],
  },
  {
    id: 'pf-eq-runes',
    systemId: 'pf2e',
    category: 'equipment',
    title: 'Руны оружия',
    summary: 'Фундаментальные (+1 и striking) и свойства. Переносятся через transfer.',
    tags: ['Runes'],
  },
  {
    id: 'pf-beast-dragon',
    systemId: 'pf2e',
    category: 'bestiary',
    title: 'Молодой красный дракон',
    summary: 'Огненное дыхание, frightful presence, иммунитет к огню.',
    tags: ['Dragon', 'Level 10'],
  },
  {
    id: 'pf-rule-degrees',
    systemId: 'pf2e',
    category: 'rules',
    title: 'Степени успеха',
    summary: 'Crit success / success / failure / crit failure. ±10 к DC меняет степень.',
    tags: ['Core'],
  },

  // Call of Cthulhu
  {
    id: 'coc-occ-detective',
    systemId: 'coc',
    category: 'classes',
    title: 'Детектив',
    summary: 'Credit Rating, Library Use, Spot Hidden. Классика расследований 1920-х.',
    tags: ['Occupation'],
  },
  {
    id: 'coc-race-human',
    systemId: 'coc',
    category: 'races',
    title: 'Человек',
    summary: 'Единственная «раса» игроков. Характеристики 3d6, EDU и POW важны для Sanity.',
    tags: ['Investigator'],
  },
  {
    id: 'coc-spell-elder',
    systemId: 'coc',
    category: 'spells',
    title: 'Знак Древних',
    summary: 'Ритуал защиты. Тратит POW и Sanity, отгоняет часть мифосных сущностей.',
    tags: ['Mythos'],
  },
  {
    id: 'coc-eq-tome',
    systemId: 'coc',
    category: 'equipment',
    title: 'Некрономикон',
    summary: 'Чтение даёт Mythos и ломает Sanity. Язык и время изучения — на усмотрение Хранителя.',
    tags: ['Tome', 'Mythos'],
  },
  {
    id: 'coc-beast-deepone',
    systemId: 'coc',
    category: 'bestiary',
    title: 'Глубоководный',
    summary: 'Амфибия Иннсмута. Когти, укус, иногда вызывает Deep One Hybrid.',
    tags: ['Mythos'],
  },
  {
    id: 'coc-rule-sanity',
    systemId: 'coc',
    category: 'rules',
    title: 'Sanity',
    summary: 'Потеря Sanity → temporary / indefinite insanity. Bout of madness на сессии.',
    tags: ['Core'],
  },

  // Vampire
  {
    id: 'vtm-clan-brujah',
    systemId: 'vtm',
    category: 'races',
    title: 'Бруха',
    summary: 'Мятежники и философы. Celerity, Potence, Presence. Слабость — ярость.',
    tags: ['Clan'],
  },
  {
    id: 'vtm-clan-nosferatu',
    systemId: 'vtm',
    category: 'races',
    title: 'Носферату',
    summary: 'Уродливые шпионы канализации. Animalism, Obfuscate, Potence.',
    tags: ['Clan'],
  },
  {
    id: 'vtm-disc-obfuscate',
    systemId: 'vtm',
    category: 'spells',
    title: 'Obfuscate',
    summary: 'Невидимость и маски. От Cloak of Shadows до Vanish.',
    tags: ['Discipline'],
  },
  {
    id: 'vtm-eq-blood',
    systemId: 'vtm',
    category: 'equipment',
    title: 'Пакет крови',
    summary: 'Голод −1 без охоты. Риск следов и вопросов от камарильи.',
    tags: ['Gear'],
  },
  {
    id: 'vtm-beast-hunter',
    systemId: 'vtm',
    category: 'bestiary',
    title: 'Второй инквизиции',
    summary: 'Охотники с tech и верой. Солнечный свет, огонь, слежка.',
    tags: ['Antagonist'],
  },
  {
    id: 'vtm-rule-hunger',
    systemId: 'vtm',
    category: 'rules',
    title: 'Hunger dice',
    summary: 'Красные кости в пуле. Messy Critical и Bestial Failure на голодных успехах.',
    tags: ['V5'],
  },

  // Blades
  {
    id: 'blades-playbook-cutter',
    systemId: 'blades',
    category: 'classes',
    title: 'Cutter',
    summary: 'Боевой playbook. Battleborn, dangerous friends, тяжёлое оружие.',
    tags: ['Playbook'],
  },
  {
    id: 'blades-playbook-lurk',
    systemId: 'blades',
    category: 'classes',
    title: 'Lurk',
    summary: 'Скрытность и взлом. Ghost Veil, rope & hook, rooftop routes.',
    tags: ['Playbook'],
  },
  {
    id: 'blades-eq-special',
    systemId: 'blades',
    category: 'equipment',
    title: 'Fine shadow cloak',
    summary: 'Плюс к Prowl. Занимает load; качество влияет на позицию.',
    tags: ['Item'],
  },
  {
    id: 'blades-faction-lamp',
    systemId: 'blades',
    category: 'bestiary',
    title: 'The Lampblacks',
    summary: 'Уличная банда Досквола. Rivalry с Red Sashes.',
    tags: ['Faction'],
  },
  {
    id: 'blades-rule-stress',
    systemId: 'blades',
    category: 'rules',
    title: 'Stress и Trauma',
    summary: 'Resist → stress. 9 stress = trauma и выбывание до следующей сессии.',
    tags: ['Core'],
  },
  {
    id: 'blades-race-ghost',
    systemId: 'blades',
    category: 'races',
    title: 'Ghost',
    summary: 'Не игровой «расой», а угрозой/союзником. Possess, electroplasm, whisper ties.',
    tags: ['Spirit'],
  },

  // Cyberpunk
  {
    id: 'cp-role-solo',
    systemId: 'cyberpunk',
    category: 'classes',
    title: 'Solo',
    summary: 'Боевая роль. Combat Awareness, оружие и броня под street fight.',
    tags: ['Role'],
  },
  {
    id: 'cp-role-netrunner',
    systemId: 'cyberpunk',
    category: 'classes',
    title: 'Netrunner',
    summary: 'Interface, программы, architecture. Скорость в сети решает бой.',
    tags: ['Role'],
  },
  {
    id: 'cp-eq-cyberarm',
    systemId: 'cyberpunk',
    category: 'equipment',
    title: 'Cyberarm',
    summary: 'Имплант руки. Слоты под оружие и инструменты, цена Humanity.',
    tags: ['Cyberware'],
  },
  {
    id: 'cp-spell-program',
    systemId: 'cyberpunk',
    category: 'spells',
    title: 'Sword',
    summary: 'Атакующая программа в NET. Black ICE отвечает тем же языком.',
    tags: ['Program'],
  },
  {
    id: 'cp-beast-boostergang',
    systemId: 'cyberpunk',
    category: 'bestiary',
    title: 'Boostergang',
    summary: 'Уличная банда с хромами. Число и дерзость важнее одиночного CR.',
    tags: ['Gang'],
  },
  {
    id: 'cp-rule-humanity',
    systemId: 'cyberpunk',
    category: 'rules',
    title: 'Humanity Loss',
    summary: 'Киберварка ест Empathy. Слишком низко — cyberpsycho risk.',
    tags: ['Core'],
  },
];

export function getHandbookEntriesForSystem(
  systemId: string,
  category: HandbookCategoryFilter = 'all',
): HandbookEntry[] {
  return MOCK_HANDBOOK_ENTRIES.filter((entry) => {
    if (entry.systemId !== systemId) return false;
    if (category === 'all') return true;
    return entry.category === category;
  });
}

export function countEntriesByCategory(
  systemId: string,
): Record<HandbookCategory, number> {
  const counts: Record<HandbookCategory, number> = {
    races: 0,
    classes: 0,
    spells: 0,
    equipment: 0,
    bestiary: 0,
    rules: 0,
  };

  for (const entry of MOCK_HANDBOOK_ENTRIES) {
    if (entry.systemId === systemId) {
      counts[entry.category] += 1;
    }
  }

  return counts;
}
