export const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL?.trim() || 'https://adventu.ru').replace(
  /\/+$/,
  '',
);

export const SITE_NAME = 'Adventura';

export const SITE_DEFAULT_TITLE = 'Adventura — социальная сеть для НРИ: игроки и мастера';

export const SITE_DEFAULT_DESCRIPTION =
  'Adventura — социальная сеть для настольно-ролевых игр. Находи игроков и мастеров, собирай группы, общайся и отправляйся в новые приключения!';

/** Link preview text for pages without their own (home, generic fallbacks). */
export const SITE_OG_TITLE = 'Всё для настольно-ролевых игр';
export const SITE_OG_DESCRIPTION = 'Найди свою группу. Начни своё приключение.';

/** 1200×630, built by scripts/generate-og-image.mjs. */
export const SITE_OG_IMAGE = `${SITE_URL}/og-image.png`;

export const SITE_SUPPORT_EMAIL = 'support@adventu.ru';

export function withBrand(title: string): string {
  return `${title} | ${SITE_NAME}`;
}

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
