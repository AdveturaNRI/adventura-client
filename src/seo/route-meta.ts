import { isPublicAppPath } from '@/constants/auth-routes';
import {
  SITE_DEFAULT_DESCRIPTION,
  SITE_DEFAULT_TITLE,
  SITE_NAME,
  SITE_OG_DESCRIPTION,
  SITE_OG_TITLE,
  absoluteUrl,
  withBrand,
} from '@/seo/site';

export type RouteSeo = {
  title: string;
  description: string;
  /** Absent for routes whose real URL isn't known at render time. */
  canonical?: string;
  noindex?: boolean;
  /** Link preview text; falls back to title / description. */
  ogTitle?: string;
  ogDescription?: string;
};

type IndexedRoute = { title: string; description: string };

/** Public app sections worth ranking. Titles are final, brand included. */
const INDEXED_ROUTES: Record<string, IndexedRoute> = {
  '/games': {
    title: 'Игры по D&D и другим НРИ — найти игру | Adventura',
    description:
      'Ищи игры по D&D, Pathfinder и другим НРИ. Выбирай систему, формат, время и стоимость, знакомься с мастерами и записывайся в подходящую группу.',
  },
  '/dice': {
    title: 'Онлайн-кубики для D&D и НРИ — 3D d20, d6, d100 | Adventura',
    description:
      'Бросай виртуальные кубики d4, d6, d8, d10, d12, d20 и d100 с 3D-анимацией. Используй модификаторы, преимущество и помеху, просматривай историю бросков.',
  },
  '/generators': {
    title: 'Генераторы для мастера D&D и НРИ: NPC, таверны, подземелья | Adventura',
    description:
      'Создавай NPC с именами и секретами, генерируй таверны, королевства, поселения и подземелья для своих приключений. Инструменты для мастеров НРИ с быстрым копированием результатов.',
  },
  '/clubs': {
    title: 'Клубы настольных ролевых игр — найти клуб НРИ | Adventura',
    description:
      'Ищи клубы настольно-ролевых игр в своём городе. Изучай адреса, часы работы, фотографии и информацию об игровых столах, чтобы найти место для партии в D&D и других НРИ.',
  },
  '/authors': {
    title: 'Материалы для НРИ: арты, карты и ассеты авторов | Adventura',
    description:
      'Открывай публикации авторов для настольно-ролевых игр: иллюстрации, игровые карты, токены и другие материалы для подготовки и проведения приключений.',
  },
  '/news': {
    title: 'Новости НРИ: обновления Adventura и события сообщества',
    description:
      'Читайте новости Adventura, узнавайте об обновлениях платформы, новых возможностях, событиях и проектах партнёров из мира настольно-ролевых игр.',
  },
};

/** Tab titles for pages that stay out of the index. */
const PRIVATE_TITLES: Record<string, string> = {
  '/wanderers': 'Странники',
  '/chats': 'Чаты',
  '/profile': 'Профиль',
  '/settings': 'Настройки',
  '/notifications': 'Уведомления',
  '/questionnaire': 'Анкета',
  '/my-games': 'Мои игры',
  '/my-clubs': 'Мои клубы',
  '/master-room': 'Кабинет мастера',
  '/music-library': 'Музыка',
  '/characters': 'Персонажи',
  '/handbook': 'Справочник',
  '/games-create': 'Новая игра',
  '/clubs-create': 'Новый клуб',
  '/auth/login': 'Вход',
  '/auth/register': 'Регистрация',
  '/auth/forgot-password': 'Восстановление пароля',
};

/** Sections with placeholder data: indexing them now would only add thin pages. */
const NOINDEX_PUBLIC_PREFIXES = ['/handbook', '/ui-lib'];

const GENERIC_PREVIEW = { ogTitle: SITE_OG_TITLE, ogDescription: SITE_OG_DESCRIPTION };

function normalizePath(pathname: string): string {
  const path = (pathname.split(/[?#]/)[0] ?? '/').replace(/\/+$/, '');
  return path || '/';
}

/** `/games/[id]` during static export: the real id only exists in the browser. */
function isUnresolvedDynamicPath(path: string): boolean {
  return path.includes('[');
}

/**
 * Head data for the current route, or null for ad landings (`/l/*`),
 * which manage their own SEO from the admin.
 */
export function resolveRouteSeo(pathname: string): RouteSeo | null {
  const path = normalizePath(pathname);

  if (path === '/l' || path.startsWith('/l/')) return null;

  if (path === '/') {
    return {
      title: SITE_DEFAULT_TITLE,
      description: SITE_DEFAULT_DESCRIPTION,
      canonical: absoluteUrl('/'),
      ...GENERIC_PREVIEW,
    };
  }

  const indexed = INDEXED_ROUTES[path];
  if (indexed) {
    return { ...indexed, canonical: absoluteUrl(path) };
  }

  const privateTitle = PRIVATE_TITLES[path];
  const isNoindexPublic = NOINDEX_PUBLIC_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );

  if (isPublicAppPath(path) && !isNoindexPublic && !path.startsWith('/auth')) {
    // Detail pages (game, club, post): the screen refines title/description once data loads.
    return {
      title: SITE_NAME,
      description: SITE_DEFAULT_DESCRIPTION,
      canonical: isUnresolvedDynamicPath(path) ? undefined : absoluteUrl(path),
      ...GENERIC_PREVIEW,
    };
  }

  return {
    title: privateTitle ? withBrand(privateTitle) : SITE_NAME,
    description: SITE_DEFAULT_DESCRIPTION,
    noindex: true,
    ...GENERIC_PREVIEW,
  };
}
