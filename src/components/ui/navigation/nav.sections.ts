import type { ComponentProps } from 'react';
import type { MaterialCommunityIcons } from '@expo/vector-icons';

import type { NavbarIconKey } from './navbar-icon-assets';

/** Top-level IA sections — primary chrome only. */
export type NavSectionId = 'play' | 'community' | 'tools' | 'news' | 'profile';

export type NavSectionIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export type NavLeafId =
  | 'games'
  | 'clubs'
  | 'wanderers'
  | 'authors'
  | 'chats'
  | 'dice'
  | 'generators'
  | 'handbook'
  | 'news'
  | 'profile';

export type NavLeaf = {
  id: NavLeafId;
  /** Existing route key / URL segment used by navigateMainTab. */
  routeKey: NavbarIconKey;
  label: string;
  href: `/${string}`;
  subtitle?: string;
  /** When false, leaf requires auth (same as isPublicTabKey). */
  public?: boolean;
};

export type NavSection = {
  id: NavSectionId;
  label: string;
  /** Short label for cramped bottom bars. */
  shortLabel: string;
  /**
   * Distinct section header icon (MCI) — must not duplicate leaf NavbarIcons.
   * Приключения → swords, Сообщество → people, Инструменты → toolbox.
   */
  icon: NavSectionIconName;
  /** Default destination when opening the section. */
  rootHref: `/${string}`;
  items: NavLeaf[];
};

const PROFILE_PATH_PREFIXES = [
  '/profile',
  '/settings',
  '/notifications',
  '/questionnaire',
  '/profile-appearance',
  '/master-room',
  '/author-cabinet',
  '/my-games',
  '/my-clubs',
  '/music-library',
  '/rewards-lab',
] as const;

function startsWithPath(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function matchesGamesFamily(pathname: string): boolean {
  return (
    startsWithPath(pathname, '/games') ||
    pathname.startsWith('/games-') ||
    pathname === '/my-games'
  );
}

function matchesClubsFamily(pathname: string): boolean {
  return (
    startsWithPath(pathname, '/clubs') ||
    pathname.startsWith('/clubs-') ||
    pathname === '/my-clubs'
  );
}

function matchesProfileFamily(pathname: string): boolean {
  return PROFILE_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Pathname → leaf id for secondary highlight. */
export function matchNavLeafId(pathname: string): NavLeafId | null {
  if (matchesGamesFamily(pathname) && pathname !== '/my-games') return 'games';
  if (matchesClubsFamily(pathname) && pathname !== '/my-clubs') return 'clubs';
  if (startsWithPath(pathname, '/wanderers') || startsWithPath(pathname, '/users')) {
    return 'wanderers';
  }
  if (startsWithPath(pathname, '/authors')) return 'authors';
  if (startsWithPath(pathname, '/chats')) return 'chats';
  if (startsWithPath(pathname, '/dice')) return 'dice';
  if (startsWithPath(pathname, '/generators')) return 'generators';
  if (startsWithPath(pathname, '/handbook')) return 'handbook';
  if (startsWithPath(pathname, '/news')) return 'news';
  if (matchesProfileFamily(pathname)) return 'profile';
  return null;
}

export function matchNavSectionId(pathname: string): NavSectionId | null {
  const leaf = matchNavLeafId(pathname);
  if (!leaf) return null;
  const section = NAV_SECTIONS.find((item) => item.items.some((entry) => entry.id === leaf));
  return section?.id ?? null;
}

export function getNavSection(id: NavSectionId): NavSection {
  const section = NAV_SECTIONS.find((item) => item.id === id);
  if (!section) {
    throw new Error(`Unknown nav section: ${id}`);
  }
  return section;
}

export function getNavSectionByPathname(pathname: string): NavSection | null {
  const id = matchNavSectionId(pathname);
  return id ? getNavSection(id) : null;
}

export function getNavLeafByPathname(pathname: string): NavLeaf | null {
  const leafId = matchNavLeafId(pathname);
  if (!leafId) return null;
  for (const section of NAV_SECTIONS) {
    const leaf = section.items.find((item) => item.id === leafId);
    if (leaf) return leaf;
  }
  return null;
}

/**
 * Five top-level sections. Leaf hrefs keep existing deep links.
 * «Поиск партии» = /games (no separate route).
 * Порядок: Новости и Профиль сверху, затем группы.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    id: 'news',
    label: 'Новости',
    shortLabel: 'Новости',
    icon: 'newspaper-variant-outline',
    rootHref: '/news',
    items: [
      {
        id: 'news',
        routeKey: 'news',
        label: 'Новости',
        href: '/news',
        subtitle: 'Релизы и объявления',
        public: true,
      },
    ],
  },
  {
    id: 'profile',
    label: 'Профиль',
    shortLabel: 'Профиль',
    icon: 'account-outline',
    rootHref: '/profile',
    items: [
      {
        id: 'profile',
        routeKey: 'profile',
        label: 'Профиль',
        href: '/profile',
        subtitle: 'Анкета, настройки, кабинеты',
      },
    ],
  },
  {
    id: 'play',
    label: 'Приключения',
    shortLabel: 'Приключения',
    icon: 'sword-cross',
    rootHref: '/games',
    items: [
      {
        id: 'games',
        routeKey: 'games',
        label: 'Игры',
        href: '/games',
        subtitle: 'Лента и набор в партии',
        public: true,
      },
      {
        id: 'clubs',
        routeKey: 'clubs',
        label: 'Клубы',
        href: '/clubs',
        subtitle: 'Игровые клубы на карте',
        public: true,
      },
    ],
  },
  {
    id: 'community',
    label: 'Сообщество',
    shortLabel: 'Сообщество',
    icon: 'account-group-outline',
    rootHref: '/wanderers',
    items: [
      {
        id: 'wanderers',
        routeKey: 'wanderers',
        label: 'Странники',
        href: '/wanderers',
        subtitle: 'Лента игроков',
      },
      {
        id: 'authors',
        routeKey: 'authors',
        label: 'Публикации',
        href: '/authors',
        subtitle: 'Работы авторов и художников',
        public: true,
      },
      {
        id: 'chats',
        routeKey: 'chats',
        label: 'Чаты',
        href: '/chats',
        subtitle: 'Переписка',
      },
    ],
  },
  {
    id: 'tools',
    label: 'Инструменты',
    shortLabel: 'Инструменты',
    icon: 'toolbox-outline',
    rootHref: '/dice',
    items: [
      {
        id: 'dice',
        routeKey: 'dice',
        label: 'Дайсы',
        href: '/dice',
        subtitle: 'Бросок кубиков',
        public: true,
      },
      {
        id: 'generators',
        routeKey: 'generators',
        label: 'Генераторы',
        href: '/generators',
        subtitle: 'NPC, таверны, подземелья',
        public: true,
      },
      {
        id: 'handbook',
        routeKey: 'handbook',
        label: 'Библиотека',
        href: '/handbook',
        subtitle: 'Расы, классы и правила по системам',
        public: true,
      },
    ],
  },
];

/** Bottom bar / primary chrome — only section roots. */
export const PRIMARY_NAV_SECTIONS = NAV_SECTIONS;
