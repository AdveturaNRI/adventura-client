import type { Ionicons } from '@expo/vector-icons';

import type { HandbookCategory, HandbookCategoryFilter } from './types';

export const HANDBOOK_CATEGORY_LABELS: Record<HandbookCategory, string> = {
  races: 'Расы',
  classes: 'Классы',
  spells: 'Заклинания',
  equipment: 'Снаряжение',
  bestiary: 'Бестиарий',
  rules: 'Правила',
};

export const HANDBOOK_CATEGORY_HINTS: Record<HandbookCategory, string> = {
  races: 'Народы и происхождения',
  classes: 'Архетипы и роли',
  spells: 'Магия и эффекты',
  equipment: 'Оружие, броня и предметы',
  bestiary: 'Монстры и враги',
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

export const HANDBOOK_CATEGORY_ORDER: HandbookCategory[] = [
  'races',
  'classes',
  'spells',
  'equipment',
  'bestiary',
  // 'rules' — временно скрыт
];

/** Акценты плиток разделов — не серые, отличаются друг от друга. */
export const HANDBOOK_CATEGORY_ACCENTS: Record<HandbookCategory, string> = {
  races: '#157AFE',
  classes: '#2F6B4F',
  spells: '#8B5CF6',
  equipment: '#C45C26',
  bestiary: '#B45309',
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
  races: {
    source: require('../../../assets/handbook/categories/k4n8qm.jpg'),
  },
  classes: {
    source: require('../../../assets/handbook/categories/p2w7xc.jpg'),
  },
  spells: {
    source: require('../../../assets/handbook/categories/r6t3yf.jpg'),
  },
  equipment: {
    source: require('../../../assets/handbook/categories/h9m1vb.jpg'),
  },
  bestiary: {
    source: require('../../../assets/handbook/categories/m3q8zd.jpg'),
  },
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
  races: 'people-outline',
  classes: 'shield-outline',
  spells: 'flash-outline',
  equipment: 'hammer-outline',
  bestiary: 'paw-outline',
  rules: 'book-outline',
};
