export type MenuIconKey =
  | 'profile'
  | 'appearance'
  | 'dragon'
  | 'notifications'
  | 'settings'
  | 'master'
  | 'author'
  | 'clubs'
  | 'telegram'
  | 'support'
  | 'developer';

export type MenuItemVariant = 'default' | 'danger';

export type MenuItemSpec = {
  key: string;
  label: string;
  subtitle: string;
  icon: MenuIconKey;
  variant?: MenuItemVariant;
  badge?: string;
  externalUrl?: string;
};

export type ProfileMenuSectionSpec = {
  key: string;
  title: string;
  items: MenuItemSpec[];
};

export const MENU_SPECS: MenuItemSpec[] = [
  {
    key: 'developer',
    label: 'Поддержать разработку',
    subtitle:
      'Здесь вы можете поддержать проект денюжкой, что нам очень поможет',
    icon: 'developer',
    externalUrl: 'https://boosty.to/adventuranri',
  },
  {
    key: 'profile',
    label: 'Анкета игрока',
    subtitle: 'Здесь вы можете настроить вашу анкету',
    icon: 'profile',
  },
  {
    key: 'appearance',
    label: 'Оформление профиля',
    subtitle: 'Рамки аватара и выделение анкеты',
    icon: 'appearance',
  },
  {
    key: 'games',
    label: 'Игры, в которых я участвую',
    subtitle: 'Ваши столы и заявки на участие',
    icon: 'dragon',
  },
  {
    key: 'notifications',
    label: 'Уведомления',
    subtitle: 'Сюда вам придут все уведомления',
    icon: 'notifications',
  },
  {
    key: 'settings',
    label: 'Настройки',
    subtitle: 'Здесь вы можете настроить приложение и ваш аккаунт',
    icon: 'settings',
  },
];

export const PROFILE_MENU_SECTIONS: ProfileMenuSectionSpec[] = [
  {
    key: 'main',
    title: 'Основные',
    items: MENU_SPECS,
  },
  {
    key: 'workshop',
    title: 'Мастерская',
    items: [
      {
        key: 'master-room',
        label: 'Кабинет мастера',
        subtitle: 'Здесь вы можете создавать игры и управлять ими',
        icon: 'master',
      },
      {
        key: 'author-cabinet',
        label: 'Кабинет автора',
        subtitle: 'Свои материалы в общем разделе «Публикации»',
        icon: 'author',
      },
      {
        key: 'my-clubs',
        label: 'Мои клубы',
        subtitle: 'Площадки на карте: адрес, расписание, галерея',
        icon: 'clubs',
      },
    ],
  },
  {
    key: 'feedback',
    title: 'Обратная связь',
    items: [
      {
        key: 'social',
        label: 'Наши соцсети',
        subtitle: 'Здесь вы можете следить за новостями о нас',
        icon: 'telegram',
        externalUrl: 'https://t.me/AdventuraNRI',
      },
      {
        key: 'support',
        label: 'Поддержка',
        subtitle: 'Здесь вы можете написать нам и сообщить о проблеме или нарушении',
        icon: 'support',
        externalUrl: 'https://boosty.to/adventuranring',
      },
    ],
  },
];
