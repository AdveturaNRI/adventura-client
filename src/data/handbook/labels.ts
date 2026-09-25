import type { Ionicons } from '@expo/vector-icons';

import type { HandbookCategory, HandbookCategoryFilter } from './types';

export const HANDBOOK_CATEGORY_LABELS: Record<HandbookCategory, string> = {
  races: 'Расы',
  classes: 'Классы',
  spells: 'Заклинания',
  equipment: 'Оружие',
  bestiary: 'Бестиарий',
  rules: 'Правила',
};

export const HANDBOOK_CATEGORY_HINTS: Record<HandbookCategory, string> = {
  races: 'Народы и происхождения',
  classes: 'Архетипы и роли',
  spells: 'Магия и эффекты',
  equipment: 'Оружие и снаряжение',
  bestiary: 'Монстры и враги',
  rules: 'Механики за столом',
};

export const HANDBOOK_CATEGORY_ORDER: HandbookCategory[] = [
  'races',
  'classes',
  'spells',
  'equipment',
  'bestiary',
  'rules',
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
