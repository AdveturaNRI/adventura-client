export const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL?.trim() || 'https://adventu.ru').replace(
  /\/+$/,
  '',
);

export const SITE_NAME = 'Adventura';

export const SITE_DEFAULT_TITLE = 'Adventura — поиск игроков и мастера для D&D и НРИ';

export const SITE_DEFAULT_DESCRIPTION =
  'Найдите игроков или мастера для D&D, Pathfinder и других НРИ. Игры онлайн и вживую, чат и звонки для партии, кубики d20 в браузере. Бесплатно.';

/** 1200×630, built by scripts/generate-og-image.mjs. */
export const SITE_OG_IMAGE = `${SITE_URL}/og-image.png`;

export const SITE_SUPPORT_EMAIL = 'support@adventu.ru';

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
