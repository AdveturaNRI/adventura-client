import type { HandbookSystem } from './types';

/** Старый id до разделения редакций — ведём на 2014. */
export const LEGACY_HANDBOOK_SYSTEM_IDS: Record<string, string> = {
  dnd5e: 'dnd5e-2014',
};

/** Мок систем для хаба справочника. Обложки — `assets/handbook/systems`. */
export const MOCK_HANDBOOK_SYSTEMS: HandbookSystem[] = [
  {
    id: 'dnd5e-2014',
    name: 'D&D 5e (2014)',
    shortName: 'D&D 2014',
    tagline: 'Классическая пятая редакция',
    description:
      'Расы, классы, заклинания и бестиарий по правилам 2014 — PHB, DMG и дополнения эпохи.',
    coverSource: require('../../../assets/handbook/systems/a8j2np.png'),
    accent: '#C45C26',
    isOfficial: true,
  },
  {
    id: 'dnd5e-2024',
    name: 'D&D 5e (2024)',
    shortName: 'D&D 2024',
    tagline: 'Обновлённые правила пятой редакции',
    description:
      'Виды, классы, заклинания и снаряжение по правилам 2024 — Книга игрока и связанные книги.',
    coverSource: require('../../../assets/handbook/systems/b5k9wm.png'),
    accent: '#B45309',
    isOfficial: true,
  },
];

export function resolveHandbookSystemId(systemId: string): string {
  return LEGACY_HANDBOOK_SYSTEM_IDS[systemId] ?? systemId;
}

export function getHandbookSystem(systemId: string): HandbookSystem | undefined {
  const resolved = resolveHandbookSystemId(systemId);
  return MOCK_HANDBOOK_SYSTEMS.find((system) => system.id === resolved);
}
