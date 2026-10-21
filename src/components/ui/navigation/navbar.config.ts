import type { NavbarIconKey } from './navbar-icon-assets';

export type NavbarItem = {
  key: NavbarIconKey;
  label: string;
  icon: NavbarIconKey;
};

export type NavbarSpec = {
  key: NavbarIconKey;
  label: string;
  icon: NavbarIconKey;
};

/**
 * Flat leaf list for UiLib / legacy demos.
 * Primary chrome uses `nav.sections.ts` (5 sections).
 */
const HIDDEN_NAV_KEYS = new Set<NavbarIconKey>(['characters', 'handbook']);

export const NAVBAR_ITEMS: NavbarItem[] = [
  { key: 'wanderers', label: 'Странники', icon: 'wanderers' },
  { key: 'games', label: 'Игры', icon: 'games' },
  { key: 'characters', label: 'Персонажи', icon: 'characters' },
  { key: 'authors', label: 'Публикации', icon: 'authors' },
  { key: 'news', label: 'Новости', icon: 'news' },
  { key: 'handbook', label: 'Справочник', icon: 'handbook' },
  { key: 'clubs', label: 'Клубы', icon: 'clubs' },
  { key: 'dice', label: 'Дайсы', icon: 'dice' },
  { key: 'generators', label: 'Генераторы', icon: 'generators' },
  { key: 'chats', label: 'Чаты', icon: 'chats' },
  { key: 'profile', label: 'Профиль', icon: 'profile' },
].filter((item) => !HIDDEN_NAV_KEYS.has(item.key));

export const NAVBAR_SPECS: NavbarSpec[] = NAVBAR_ITEMS.map(({ key, label, icon }) => ({
  key,
  label,
  icon,
}));

export const MAIN_NAVBAR_ITEMS: NavbarItem[] = NAVBAR_ITEMS;

export type MobileAppMenuItem = NavbarItem & {
  subtitle: string;
};

/** @deprecated Flat list — primary chrome uses `nav.sections.ts`. Kept for UiLib demos. */
export const MOBILE_APP_MENU_ITEMS: MobileAppMenuItem[] = NAVBAR_ITEMS.map((item) => ({
  ...item,
  subtitle: item.label,
}));

export const MAIN_APP_ENTRY = '/games' as const;
