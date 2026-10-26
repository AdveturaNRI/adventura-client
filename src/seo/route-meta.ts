import { isPublicAppPath } from '@/constants/auth-routes';
import {
  SITE_DEFAULT_DESCRIPTION,
  SITE_DEFAULT_TITLE,
  SITE_NAME,
  absoluteUrl,
} from '@/seo/site';

export type RouteSeo = {
  title: string;
  description: string;
  /** Absent for routes whose real URL isn't known at render time. */
  canonical?: string;
  noindex?: boolean;
};

type IndexedRoute = { title: string; description: string };

/** Public app sections worth ranking. Titles carry the search phrase first. */
const INDEXED_ROUTES: Record<string, IndexedRoute> = {
  '/games': {
    title: 'Игры по D&D и НРИ: набор игроков онлайн и вживую',
    description:
      'Найди свою следующую НРИ! Выбирай игры по системе, формату, расписанию и стоимости, знакомься с мастерами и присоединяйся к приключениям.',
  },
  '/dice': {
    title: 'Кубики для D&D онлайн: бросить d20, d6, d100',
    description:
      'Бросайте d4, d6, d8, d10, d12, d20 и d100 с 3D-анимацией. Модификатор, преимущество и помеха, история бросков. Без регистрации.',
  },
  '/generators': {
    title: 'Генератор NPC, таверн и подземелий для D&D',
    description:
      'NPC с именем и секретом, таверны, королевства, поселения и подземелья для мастера D&D. 32 расы, копирование в чат. Без регистрации.',
  },
  '/clubs': {
    title: 'Клубы НРИ на карте: где играть в D&D вживую',
    description:
      'Клубы для настольных ролевых игр с адресами, часами работы, числом столов и фото. Найдите место для игры в своём городе.',
  },
  '/authors': {
    title: 'Карты, арты и материалы для НРИ от авторов',
    description:
      'Публикации авторов для настольных ролевых игр: арты, карты, игровые материалы и ассеты.',
  },
  '/news': {
    title: 'Новости НРИ и Adventura',
    description: 'Новости Adventura и партнёров из мира настольных ролевых игр.',
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

function withBrand(title: string): string {
  return `${title} — ${SITE_NAME}`;
}

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
    };
  }

  const indexed = INDEXED_ROUTES[path];
  if (indexed) {
    return {
      title: withBrand(indexed.title),
      description: indexed.description,
      canonical: absoluteUrl(path),
    };
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
    };
  }

  return {
    title: privateTitle ? withBrand(privateTitle) : SITE_NAME,
    description: SITE_DEFAULT_DESCRIPTION,
    noindex: true,
  };
}
