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

const HIDDEN_NAV_KEYS = new Set<NavbarIconKey>(['characters']);

export const NAVBAR_ITEMS: NavbarItem[] = [
  { key: 'wanderers', label: 'Странники', icon: 'wanderers' },
  { key: 'games', label: 'Игры', icon: 'games' },
  { key: 'characters', label: 'Персонажи', icon: 'characters' },
  { key: 'authors', label: 'Публикации', icon: 'authors' },
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

export const MOBILE_APP_MENU_ITEMS: MobileAppMenuItem[] = [
  {
    key: 'wanderers',
    label: 'Странники',
    icon: 'wanderers',
    subtitle: 'Лента, избранные и скрытые игроки',
  },
  {
    key: 'games',
    label: 'Игры',
    icon: 'games',
    subtitle: 'Ваши кампании и сессии',
  },
  {
    key: 'characters',
    label: 'Персонажи',
    icon: 'characters',
    subtitle: 'Листы персонажей по системам',
  },
  {
    key: 'authors',
    label: 'Публикации',
    icon: 'authors',
    subtitle: 'Работы художников, медиа и авторов',
  },
  {
    key: 'handbook',
    label: 'Справочник',
    icon: 'handbook',
    subtitle: 'Расы, классы и правила по системам',
  },
  {
    key: 'clubs',
    label: 'Клубы',
    icon: 'clubs',
    subtitle: 'Игровые клубы на карте',
  },
  {
    key: 'dice',
    label: 'Дайсы',
    icon: 'dice',
    subtitle: 'Бросок кубиков для партии',
  },
  {
    key: 'generators',
    label: 'Генераторы',
    icon: 'generators',
    subtitle: 'NPC, таверны, королевства и подземелья',
  },
  {
    key: 'chats',
    label: 'Чаты',
    icon: 'chats',
    subtitle: 'Переписка с игроками и мастерами',
  },
  {
    key: 'profile',
    label: 'Профиль',
    icon: 'profile',
    subtitle: 'Анкета, настройки и аккаунт',
  },
].filter((item) => !HIDDEN_NAV_KEYS.has(item.key));

export const MAIN_APP_ENTRY = '/games' as const;
