import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

import type { CreativityCategory, AuthorContactType } from './types';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export const CREATIVITY_CATEGORY_LABELS: Record<CreativityCategory, string> = {
  arts: 'Арты',
  maps: 'Карты',
  materials: 'Материалы',
  forGames: 'Для игр',
  memes: 'Мемы',
  other: 'Другое',
};

export const CREATIVITY_CATEGORY_ICONS: Record<CreativityCategory, IoniconName> = {
  arts: 'color-palette-outline',
  maps: 'map-outline',
  materials: 'library-outline',
  forGames: 'dice-outline',
  memes: 'happy-outline',
  other: 'sparkles-outline',
};

export const CREATIVITY_CATEGORY_HINTS: Record<CreativityCategory, string> = {
  arts: 'Иллюстрации, персонажи, монстры, сцены',
  maps: 'Карты подземелий, городов, миров, локаций',
  materials: 'Приключения, хоумбрю, PDF, гайды, журналы',
  forGames: 'Токены, ассеты, таблицы, handouts',
  memes: 'Шутки, комиксы, мемы со стола и про НРИ',
  other: 'Всё, что не подходит под остальные',
};

export const CREATIVITY_FILTER_OPTIONS: {
  key: 'all' | CreativityCategory;
  label: string;
  icon?: IoniconName;
  hint?: string;
}[] = [
  { key: 'all', label: 'Все', icon: 'grid-outline' },
  {
    key: 'arts',
    label: CREATIVITY_CATEGORY_LABELS.arts,
    icon: CREATIVITY_CATEGORY_ICONS.arts,
    hint: CREATIVITY_CATEGORY_HINTS.arts,
  },
  {
    key: 'maps',
    label: CREATIVITY_CATEGORY_LABELS.maps,
    icon: CREATIVITY_CATEGORY_ICONS.maps,
    hint: CREATIVITY_CATEGORY_HINTS.maps,
  },
  {
    key: 'materials',
    label: CREATIVITY_CATEGORY_LABELS.materials,
    icon: CREATIVITY_CATEGORY_ICONS.materials,
    hint: CREATIVITY_CATEGORY_HINTS.materials,
  },
  {
    key: 'forGames',
    label: CREATIVITY_CATEGORY_LABELS.forGames,
    icon: CREATIVITY_CATEGORY_ICONS.forGames,
    hint: CREATIVITY_CATEGORY_HINTS.forGames,
  },
  {
    key: 'memes',
    label: CREATIVITY_CATEGORY_LABELS.memes,
    icon: CREATIVITY_CATEGORY_ICONS.memes,
    hint: CREATIVITY_CATEGORY_HINTS.memes,
  },
  {
    key: 'other',
    label: CREATIVITY_CATEGORY_LABELS.other,
    icon: CREATIVITY_CATEGORY_ICONS.other,
    hint: CREATIVITY_CATEGORY_HINTS.other,
  },
];

/** Короткая метка без иконки — для текста; иконку берите из CREATIVITY_CATEGORY_ICONS */
export const AUTHOR_CATEGORY_LABELS: Record<CreativityCategory, string> = {
  ...CREATIVITY_CATEGORY_LABELS,
};

export const AUTHOR_CONTACT_LABELS: Record<AuthorContactType, string> = {
  telegram: 'Telegram',
  vk: 'VK',
  discord: 'Discord',
  youtube: 'YouTube',
  twitch: 'Twitch',
  boosty: 'Boosty',
  email: 'Email',
  website: 'Сайт',
  other: 'Другое',
};

export const AUTHOR_CONTACT_ICONS: Record<AuthorContactType, IoniconName> = {
  telegram: 'paper-plane-outline',
  vk: 'logo-vk',
  discord: 'logo-discord',
  youtube: 'logo-youtube',
  twitch: 'logo-twitch',
  boosty: 'heart-outline',
  email: 'mail-outline',
  website: 'globe-outline',
  other: 'link-outline',
};

export const AUTHOR_CONTACT_PLACEHOLDERS: Record<
  AuthorContactType,
  { label: string; url: string }
> = {
  telegram: { label: '@username', url: 'https://t.me/username' },
  vk: { label: 'Страница ВК', url: 'https://vk.com/...' },
  discord: { label: 'Сервер или ник', url: 'https://discord.gg/...' },
  youtube: { label: 'Канал', url: 'https://youtube.com/@...' },
  twitch: { label: 'Канал', url: 'https://twitch.tv/...' },
  boosty: { label: 'Boosty', url: 'https://boosty.to/...' },
  email: { label: 'Почта', url: 'mailto:you@mail.com' },
  website: { label: 'Сайт', url: 'https://...' },
  other: { label: 'Название', url: 'https://...' },
};

export const AUTHOR_CONTACT_OPTIONS: {
  key: AuthorContactType;
  label: string;
  icon: IoniconName;
}[] = (
  Object.keys(AUTHOR_CONTACT_LABELS) as AuthorContactType[]
).map((key) => ({
  key,
  label: AUTHOR_CONTACT_LABELS[key],
  icon: AUTHOR_CONTACT_ICONS[key],
}));

export function isAuthorContactType(value: string): value is AuthorContactType {
  return value in AUTHOR_CONTACT_LABELS;
}
