import type { HandbookSystem } from './types';

const cover = (seed: string) => `https://picsum.photos/seed/${seed}/960/1200`;

/** Мок систем для хаба справочника. Позже подтянем с API + обложки. */
export const MOCK_HANDBOOK_SYSTEMS: HandbookSystem[] = [
  {
    id: 'dnd5e',
    name: 'Dungeons & Dragons 5e',
    shortName: 'D&D 5e',
    tagline: 'Классика подземелий и драконов',
    description:
      'Расы, классы, заклинания и бестиарий пятой редакции — всё, что нужно за столом.',
    coverUrl: cover('handbook-dnd5e'),
    accent: '#C45C26',
    isOfficial: true,
  },
  {
    id: 'pf2e',
    name: 'Pathfinder 2e',
    shortName: 'Pathfinder 2e',
    tagline: 'Глубокая тактика и кастомизация',
    description:
      'Предыстории, архетипы, навыки и монстры — справочник под вторую редакцию.',
    coverUrl: cover('handbook-pf2e'),
    accent: '#2F6B4F',
    isOfficial: true,
  },
  {
    id: 'coc',
    name: 'Зов Ктулху',
    shortName: 'Зов Ктулху',
    tagline: 'Ужас, расследования и безумие',
    description:
      'Профессии, мифы, артефакты и правила Sanity для игр в духе Лавкрафта.',
    coverUrl: cover('handbook-coc'),
    accent: '#5B3A8C',
    isOfficial: true,
  },
  {
    id: 'vtm',
    name: 'Vampire: The Masquerade',
    shortName: 'Vampire',
    tagline: 'Политика ночи и кровь кланов',
    description: 'Кланы, дисциплины, маскарад и охотники — шпаргалка по World of Darkness.',
    coverUrl: cover('handbook-vtm'),
    accent: '#8B1E2D',
    isOfficial: true,
  },
  {
    id: 'blades',
    name: 'Blades in the Dark',
    shortName: 'Blades',
    tagline: 'Банды, налёты и город теней',
    description: 'Плейбуки, фракции, стресс и entanglements для криминальных историй.',
    coverUrl: cover('handbook-blades'),
    accent: '#3D5A80',
    isOfficial: true,
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk RED',
    shortName: 'Cyberpunk',
    tagline: 'Неон, хром и уличный жаргон',
    description: 'Роли, импланты, оружие и Night City — быстрый доступ к RED.',
    coverUrl: cover('handbook-cyber'),
    accent: '#D4A017',
    isOfficial: true,
  },
];

export function getHandbookSystem(systemId: string): HandbookSystem | undefined {
  return MOCK_HANDBOOK_SYSTEMS.find((system) => system.id === systemId);
}
