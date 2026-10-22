import type { Ionicons } from '@expo/vector-icons';

import type { HandbookCategory, HandbookCategoryFilter } from './types';

export const HANDBOOK_CATEGORY_LABELS: Record<HandbookCategory, string> = {
  classes: 'Классы',
  races: 'Расы',
  backgrounds: 'Предыстории',
  feats: 'Черты',
  glossary: 'Глоссарий',
  spells: 'Заклинания',
  bestiary: 'Бестиарий',
  magicItems: 'Магические предметы',
  equipment: 'Снаряжение',
  beginners: 'Новичку',
  rules: 'Правила',
};

export const HANDBOOK_CATEGORY_HINTS: Record<HandbookCategory, string> = {
  classes: 'Архетипы и роли',
  races: 'Народы и происхождения',
  backgrounds: 'Происхождение и навыки героя',
  feats: 'Таланты и улучшения',
  glossary: 'Термины и состояния',
  spells: 'Магия и эффекты',
  bestiary: 'Монстры и враги',
  magicItems: 'Артефакты и чудеса',
  equipment: 'Оружие, броня и предметы',
  beginners: 'С чего начать за столом',
  rules: 'Механики за столом',
};

/** В 2024 «расы» → «виды» (species). */
const SPECIES_SYSTEM_IDS = new Set(['dnd5e-2024']);

export function getHandbookCategoryLabel(
  category: HandbookCategory,
  systemId?: string | null,
): string {
  if (category === 'races' && systemId && SPECIES_SYSTEM_IDS.has(systemId)) {
    return 'Виды';
  }
  return HANDBOOK_CATEGORY_LABELS[category];
}

export function getHandbookCategoryHint(
  category: HandbookCategory,
  systemId?: string | null,
): string {
  if (category === 'races' && systemId && SPECIES_SYSTEM_IDS.has(systemId)) {
    return 'Виды персонажей и происхождения';
  }
  return HANDBOOK_CATEGORY_HINTS[category];
}

export function getHandbookCategoryFilterLabel(
  filter: HandbookCategoryFilter,
  systemId?: string | null,
): string {
  if (filter === 'all') return 'Все';
  return getHandbookCategoryLabel(filter, systemId);
}

/** Порядок как на референсе dnd.su / TTG. */
export const HANDBOOK_CATEGORY_ORDER: HandbookCategory[] = [
  'classes',
  'races',
  'backgrounds',
  'feats',
  'glossary',
  'spells',
  'bestiary',
  'magicItems',
  'equipment',
  'beginners',
];

/** Акценты плиток разделов — не серые, отличаются друг от друга. */
export const HANDBOOK_CATEGORY_ACCENTS: Record<HandbookCategory, string> = {
  classes: '#2F6B4F',
  races: '#157AFE',
  backgrounds: '#A16207',
  feats: '#7C3AED',
  glossary: '#0E7490',
  spells: '#8B5CF6',
  bestiary: '#B45309',
  magicItems: '#DB2777',
  equipment: '#C45C26',
  beginners: '#059669',
  rules: '#0E7490',
};

/** Панорамные обложки разделов. Локальные — `assets/handbook/categories`. */
const categoryCoverUri = (seed: string) =>
  `https://picsum.photos/seed/${seed}/1280/800`;

export type HandbookCategoryCover = {
  source?: number;
  uri?: string;
};

export const HANDBOOK_CATEGORY_COVERS: Record<HandbookCategory, HandbookCategoryCover> = {
  classes: {
    source: require('../../../assets/handbook/categories/p2w7xc.jpg'),
  },
  races: {
    source: require('../../../assets/handbook/categories/k4n8qm.jpg'),
  },
  backgrounds: { source: require('../../../assets/handbook/categories/b5j2wn.jpg') },
  feats: { source: require('../../../assets/handbook/categories/f7x4ka.jpg') },
  glossary: { source: require('../../../assets/handbook/categories/g1r9tp.jpg') },
  spells: {
    source: require('../../../assets/handbook/categories/r6t3yf.jpg'),
  },
  bestiary: {
    source: require('../../../assets/handbook/categories/m3q8zd.jpg'),
  },
  magicItems: { source: require('../../../assets/handbook/categories/w8d3hs.jpg') },
  equipment: {
    source: require('../../../assets/handbook/categories/h9m1vb.jpg'),
  },
  beginners: { source: require('../../../assets/handbook/categories/n5z6cu.jpg') },
  rules: { uri: categoryCoverUri('handbook-cat-rules') },
};

export const HANDBOOK_CATEGORY_FILTER_LABELS: Record<HandbookCategoryFilter, string> = {
  all: 'Все',
  ...HANDBOOK_CATEGORY_LABELS,
};

export const HANDBOOK_CATEGORY_ICONS: Record<
  HandbookCategory,
  keyof typeof Ionicons.glyphMap
> = {
  classes: 'shield-outline',
  races: 'people-outline',
  backgrounds: 'scroll-outline',
  feats: 'diamond-outline',
  glossary: 'bookmark-outline',
  spells: 'flash-outline',
  bestiary: 'paw-outline',
  magicItems: 'color-wand-outline',
  equipment: 'hammer-outline',
  beginners: 'school-outline',
  rules: 'book-outline',
};
