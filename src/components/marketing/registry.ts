import type { MarketingLandingBlock } from '@/components/marketing/types';

export type BlockMeta = {
  type: MarketingLandingBlock['type'];
  label: string;
  hint: string;
  category: 'hero' | 'content' | 'social' | 'dynamic' | 'convert' | 'chrome';
  hasItems?: boolean;
  itemKind?: 'feature' | 'step' | 'testimonial' | 'faq' | 'stat' | 'link';
};

export const BLOCK_REGISTRY: BlockMeta[] = [
  {
    type: 'hero',
    label: 'Главный экран',
    hint: 'Широкий hero с заголовком, CTA и изображением.',
    category: 'hero',
  },
  {
    type: 'features',
    label: 'Преимущества',
    hint: 'Сетка карточек с иконками.',
    category: 'content',
    hasItems: true,
    itemKind: 'feature',
  },
  {
    type: 'appShowcase',
    label: 'Демо приложения',
    hint: 'Текст + скриншоты интерфейса.',
    category: 'content',
  },
  {
    type: 'steps',
    label: 'Как это работает',
    hint: 'Нумерованные шаги.',
    category: 'content',
    hasItems: true,
    itemKind: 'step',
  },
  {
    type: 'gameFeed',
    label: 'Лента игр',
    hint: 'Живые игры с API.',
    category: 'dynamic',
  },
  {
    type: 'testimonials',
    label: 'Отзывы',
    hint: 'Цитаты пользователей.',
    category: 'social',
    hasItems: true,
    itemKind: 'testimonial',
  },
  {
    type: 'clubFeed',
    label: 'Лента клубов',
    hint: 'Живые клубы с API.',
    category: 'dynamic',
  },
  {
    type: 'cta',
    label: 'Призыв к действию',
    hint: 'Широкий баннер с кнопкой.',
    category: 'convert',
  },
  {
    type: 'faq',
    label: 'Вопросы и ответы',
    hint: 'Аккордеон FAQ.',
    category: 'content',
    hasItems: true,
    itemKind: 'faq',
  },
  {
    type: 'stats',
    label: 'Цифры',
    hint: 'Крупные показатели.',
    category: 'social',
    hasItems: true,
    itemKind: 'stat',
  },
  {
    type: 'contact',
    label: 'Контакты',
    hint: 'Telegram / email / FAQ.',
    category: 'convert',
  },
  {
    type: 'footer',
    label: 'Подвал',
    hint: 'Логотип, ссылки, юр.инфо.',
    category: 'chrome',
  },
];

function id() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `b_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createDefaultBlock(type: MarketingLandingBlock['type']): MarketingLandingBlock {
  switch (type) {
    case 'hero':
      return {
        id: id(),
        type: 'hero',
        title: 'Настоящие люди. Реальные приключения.',
        description:
          'Находи единомышленников, собирайся на игры и создавай свои истории вместе с Adventura.',
        ctaLabel: 'Найти игру',
        ctaUrl: '/games',
        secondaryCtaLabel: 'Стать мастером',
        secondaryCtaUrl: '/register',
        imagePosition: 'right',
        trustText: 'Сообщество мастеров и игроков Adventura',
      };
    case 'features':
      return {
        id: id(),
        type: 'features',
        title: 'Почему выбирают Adventura',
        description: 'Всё для живых игр — в одном месте.',
        columns: 4,
        items: [
          { id: id(), title: 'Найди свою партию', description: 'Открытые наборы рядом и онлайн.', meta: 'people', accentColor: '#9562F5' },
          { id: id(), title: 'Собери команду', description: 'Создай игру и набери игроков.', meta: 'dice', accentColor: '#FFB866' },
          { id: id(), title: 'Общайся', description: 'Чаты с мастером и партией.', meta: 'chat', accentColor: '#157AFE' },
          { id: id(), title: 'Открывай миры', description: 'Клубы, системы и новые знакомства.', meta: 'planet', accentColor: '#34C759' },
        ],
      };
    case 'appShowcase':
      return {
        id: id(),
        type: 'appShowcase',
        title: 'Всё, что ты любишь — в одном месте',
        description: 'Игры, клубы, анкеты и чаты. Ищи, подавай заявки и собирай столы без лишней суеты.',
        ctaLabel: 'Открыть каталог',
        ctaUrl: '/games',
        imageSide: 'right',
      };
    case 'steps':
      return {
        id: id(),
        type: 'steps',
        title: 'Начни своё приключение',
        items: [
          { id: id(), title: 'Создай профиль', description: 'Расскажи, во что любишь играть.', meta: 'person' },
          { id: id(), title: 'Найди игру', description: 'Фильтры по городу, системе и формату.', meta: 'search' },
          { id: id(), title: 'Присоединяйся', description: 'Отправь заявку мастеру.', meta: 'hand' },
          { id: id(), title: 'Играй и общайся', description: 'Собирайтесь и продолжайте в чате.', meta: 'game' },
        ],
      };
    case 'gameFeed':
      return {
        id: id(),
        type: 'gameFeed',
        title: 'Популярные игры рядом с тобой',
        description: 'Актуальные наборы из Adventura.',
        limit: 4,
        ctaLabel: 'Смотреть все',
        ctaUrl: '/games',
      };
    case 'testimonials':
      return {
        id: id(),
        type: 'testimonials',
        title: 'Что говорят наши пользователи',
        items: [
          { id: id(), title: 'Игрок', description: 'Добавьте реальный отзыв в редакторе.', meta: 'Игрок' },
        ],
      };
    case 'clubFeed':
      return {
        id: id(),
        type: 'clubFeed',
        title: 'Найди клуб рядом с собой',
        limit: 4,
        ctaLabel: 'Смотреть все',
        ctaUrl: '/clubs',
      };
    case 'cta':
      return {
        id: id(),
        type: 'cta',
        title: 'Готов к новым приключениям?',
        description: 'Присоединяйся к Adventura и найди свою следующую историю.',
        ctaLabel: 'Начать приключение',
        ctaUrl: '/register',
      };
    case 'faq':
      return {
        id: id(),
        type: 'faq',
        title: 'Частые вопросы',
        items: [
          { id: id(), title: 'Adventura бесплатна?', description: 'Регистрация и поиск игр бесплатны. Отдельные наборы могут быть платными — это указывает мастер.' },
          { id: id(), title: 'Какие игры можно найти?', description: 'Настольные ролевые и другие форматы от сообщества: онлайн и офлайн.' },
          { id: id(), title: 'Можно ли создать свою игру?', description: 'Да — опубликуй набор и принимай заявки игроков.' },
        ],
      };
    case 'stats':
      return {
        id: id(),
        type: 'stats',
        title: 'Adventura в цифрах',
        source: 'manual',
        items: [
          { id: id(), title: '—', description: 'укажите реальную цифру', meta: 'people', accentColor: '#9562F5' },
          { id: id(), title: '—', description: 'игр в каталоге', meta: 'game', accentColor: '#E85D9A' },
          { id: id(), title: '—', description: 'клубов', meta: 'home', accentColor: '#157AFE' },
          { id: id(), title: '—', description: 'активных мастеров', meta: 'star', accentColor: '#FFB866' },
        ],
      };
    case 'contact':
      return {
        id: id(),
        type: 'contact',
        title: 'Остались вопросы?',
        description: 'Напишите нам — ответим и подскажем, с чего начать.',
        telegramUrl: '',
        email: '',
      };
    case 'footer':
      return {
        id: id(),
        type: 'footer',
        title: 'Adventura',
        description: 'Больше чем игры. Настоящие люди.',
        groups: [
          {
            id: id(),
            title: 'Продукт',
            links: [
              { label: 'Игры', url: '/games' },
              { label: 'Клубы', url: '/clubs' },
            ],
          },
        ],
        socials: [],
        legalText: '© Adventura',
      };
    case 'quote':
      return {
        id: id(),
        type: 'quote',
        description: 'Играй с людьми рядом.',
        author: 'Adventura',
      };
    case 'media':
      return {
        id: id(),
        type: 'media',
        title: '',
        imageUrl: '',
      };
    default:
      return { id: id(), type: 'hero', title: 'Adventura' };
  }
}
