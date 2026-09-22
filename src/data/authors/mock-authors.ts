import type {
  Author,
  AuthorPost,
  CreativityCategory,
  CreativityCategoryFilter,
} from './types';

const img = (id: string) => `https://picsum.photos/seed/${id}/800/600`;
const avatar = (seed: string) =>
  `https://api.dicebear.com/7.x/avataaars/png?seed=${encodeURIComponent(seed)}&size=128`;

/** Mock-профиль текущего пользователя для кабинета автора */
export const CURRENT_AUTHOR_ID = 'author-me';

export const MOCK_AUTHOR_POSTS: AuthorPost[] = [
  {
    id: 'post-elia-1',
    authorId: 'author-elia',
    title: 'Портрет эльфийской следопытки',
    content:
      'Скетч и финальный рендер для персонажа игрока. Работала с референсами по расе и цветовой палитре кампании.',
    category: 'arts',
    images: [img('elia-portrait-1'), img('elia-portrait-2')],
    files: [
      {
        id: 'file-elia-1',
        name: 'elia-portrait-hd.png',
        size: 4_200_000,
        type: 'image/png',
        url: img('elia-portrait-hd'),
        previewUrl: img('elia-portrait-hd'),
      },
    ],
    createdAt: '2026-09-10T12:00:00.000Z',
    views: 128,
    likes: 34,
    liked: false,
    isForSale: true,
    price: 2500,
    currency: '₽',
    purchaseDescription: 'Персональная иллюстрация персонажа в похожем стиле.',
    purchaseUrl: 'https://t.me/elia_art',
  },
  {
    id: 'post-elia-2',
    authorId: 'author-elia',
    title: 'Карта таверны «Медный дракон»',
    content: 'Топ-даун карта для сессии. Слои для Foundry прилагаются архивом.',
    category: 'maps',
    images: [img('elia-map')],
    files: [
      {
        id: 'file-elia-2',
        name: 'copper-dragon-tavern.zip',
        size: 12_800_000,
        type: 'application/zip',
        url: '#',
      },
    ],
    createdAt: '2026-08-22T09:30:00.000Z',
    views: 89,
    likes: 21,
    liked: false,
    isForSale: false,
  },
  {
    id: 'post-mira-1',
    authorId: 'author-mira',
    title: 'Сет токенов для подземелья',
    content: '16 токенов монстров в едином стиле. Подходят для виртуальных столов.',
    category: 'forGames',
    images: [img('mira-tokens-1'), img('mira-tokens-2')],
    files: [],
    createdAt: '2026-09-01T15:00:00.000Z',
    views: 210,
    likes: 56,
    liked: true,
    isForSale: true,
    price: 900,
    currency: '₽',
    purchaseDescription: 'Полный сет токенов в PNG + исходники.',
    purchaseUrl: 'https://t.me/mira_ink',
  },
  {
    id: 'post-kir-1',
    authorId: 'author-kir',
    title: 'Обложка модуля «Пепел северных дорог»',
    content: 'Ключевой арт для обложки one-shot. Холодная палитра и акцент на силуэтах.',
    category: 'arts',
    images: [img('kir-cover')],
    files: [],
    createdAt: '2026-07-18T11:00:00.000Z',
    views: 64,
    likes: 18,
    liked: false,
    isForSale: false,
  },
  {
    id: 'post-lena-1',
    authorId: 'author-lena',
    title: 'Подкаст: как готовить one-shot за вечер',
    content:
      '<h2>Структура вечера</h2><p>Разбор <strong>хука</strong>, <em>трёх локаций</em> и финального конфликта.</p><ul><li>хук на игроков за 10 минут</li><li>три локации без воды</li><li>финальный конфликт с выбором</li></ul><blockquote><p>Таймкоды — в описании на площадке.</p></blockquote>',
    category: 'other',
    images: [img('lena-podcast')],
    files: [],
    createdAt: '2026-09-14T18:00:00.000Z',
    views: 402,
    likes: 77,
    liked: false,
    isForSale: false,
  },
  {
    id: 'post-lena-2',
    authorId: 'author-lena',
    title: 'Видео: настройка Foundry для новичков',
    content: 'От установки до первой сессии. Чеклист модулей в конце ролика.',
    category: 'materials',
    images: [img('lena-foundry')],
    files: [
      {
        id: 'file-lena-1',
        name: 'foundry-checklist.pdf',
        size: 480_000,
        type: 'application/pdf',
        url: '#',
      },
    ],
    createdAt: '2026-08-05T10:00:00.000Z',
    views: 318,
    likes: 49,
    liked: false,
    isForSale: true,
    price: 490,
    currency: '₽',
    purchaseDescription: 'Расширенный чеклист + пресет сцены Foundry.',
    purchaseUrl: 'https://vk.com/lena_nri',
  },
  {
    id: 'post-igor-1',
    authorId: 'author-igor',
    title: 'Стрим: сессия Shadowrun глазами мастера',
    content: 'Запись партии с комментариями по темпу и подготовке NPC.',
    category: 'other',
    images: [img('igor-stream')],
    files: [],
    createdAt: '2026-09-08T20:00:00.000Z',
    views: 155,
    likes: 29,
    liked: false,
    isForSale: false,
  },
  {
    id: 'post-sony-1',
    authorId: 'author-sony',
    title: 'Приключение «Дом на окраине»',
    content:
      'Односессионный сценарий для 3–5 игроков. Ужас и расследование, система-агностик.',
    category: 'materials',
    images: [img('sony-adventure')],
    files: [
      {
        id: 'file-sony-1',
        name: 'house-on-the-edge.pdf',
        size: 2_100_000,
        type: 'application/pdf',
        url: '#',
      },
    ],
    createdAt: '2026-09-12T14:20:00.000Z',
    views: 276,
    likes: 61,
    liked: false,
    isForSale: true,
    price: 350,
    currency: '₽',
    purchaseDescription: 'PDF сценария + handouts для игроков.',
    purchaseUrl: 'https://t.me/sony_tables',
  },
  {
    id: 'post-sony-2',
    authorId: 'author-sony',
    title: 'Таблица случайных слухов в таверне',
    content: '30 заготовок, которые можно бросить кубиком и сразу вставить в сессию.',
    category: 'forGames',
    images: [],
    files: [
      {
        id: 'file-sony-2',
        name: 'tavern-rumors.txt',
        size: 12_000,
        type: 'text/plain',
        url: '#',
      },
    ],
    createdAt: '2026-06-30T08:00:00.000Z',
    views: 97,
    likes: 22,
    liked: true,
    isForSale: false,
  },
  {
    id: 'post-dasha-1',
    authorId: 'author-dasha',
    title: 'Гайд: как писать предысторию персонажа',
    content: 'Короткий шаблон из пяти вопросов — без простыней на десять страниц.',
    category: 'materials',
    images: [img('dasha-guide')],
    files: [],
    createdAt: '2026-09-05T16:40:00.000Z',
    views: 188,
    likes: 41,
    liked: false,
    isForSale: false,
  },
  {
    id: 'post-dasha-2',
    authorId: 'author-dasha',
    title: 'Пакет handouts для расследования',
    content: 'Письма, газетные вырезки и карта города. Можно печатать или кидать в чат.',
    category: 'forGames',
    images: [img('dasha-handouts-1'), img('dasha-handouts-2')],
    files: [
      {
        id: 'file-dasha-1',
        name: 'investigation-handouts.zip',
        size: 8_400_000,
        type: 'application/zip',
        url: '#',
      },
    ],
    createdAt: '2026-07-28T13:00:00.000Z',
    views: 143,
    likes: 38,
    liked: false,
    isForSale: true,
    price: 650,
    currency: '₽',
    purchaseDescription: 'Архив handouts + версии без водяных знаков.',
    purchaseUrl: 'mailto:dasha.content@example.com',
  },
  {
    id: 'post-me-1',
    authorId: CURRENT_AUTHOR_ID,
    title: 'Черновик карты подземного города',
    content: 'Первый слой локации для one-shot. Ещё дорисую секреты и ловушки.',
    category: 'maps',
    images: [img('me-map')],
    files: [],
    createdAt: '2026-09-18T11:00:00.000Z',
    views: 12,
    likes: 3,
    liked: false,
    isForSale: false,
  },
];

export const MOCK_AUTHORS: Author[] = [
  {
    id: CURRENT_AUTHOR_ID,
    name: 'Вы',
    avatar: avatar('author-me'),
    categories: ['arts'],
    description: 'Расскажите о себе — этот текст увидят в профиле автора.',
    contacts: [
      { type: 'telegram', label: '@adventura_you', url: 'https://t.me/adventura_you' },
    ],
    postIds: ['post-me-1'],
  },
  {
    id: 'author-elia',
    name: 'Элия Верн',
    avatar: avatar('elia-vern'),
    categories: ['arts', 'maps'],
    description:
      'Рисую персонажей и карты для столов. Люблю тёплый свет и детали костюмов.',
    contacts: [
      { type: 'telegram', label: '@elia_art', url: 'https://t.me/elia_art' },
      { type: 'website', label: 'elia.art', url: 'https://example.com/elia' },
    ],
    postIds: ['post-elia-1', 'post-elia-2'],
  },
  {
    id: 'author-mira',
    name: 'Мира Чернила',
    avatar: avatar('mira-ink'),
    categories: ['forGames', 'arts'],
    description: 'Токены, портреты и стикеры для виртуальных столов.',
    contacts: [
      { type: 'telegram', label: '@mira_ink', url: 'https://t.me/mira_ink' },
      { type: 'vk', label: 'vk.com/mira_ink', url: 'https://vk.com/mira_ink' },
    ],
    postIds: ['post-mira-1'],
  },
  {
    id: 'author-kir',
    name: 'Кир Обложка',
    avatar: avatar('kir-cover'),
    categories: ['arts'],
    description: 'Обложки модулей и ключевые арты для кампаний.',
    contacts: [
      { type: 'discord', label: 'kir#0420', url: 'https://discord.com/users/0' },
      { type: 'boosty', label: 'Boosty', url: 'https://boosty.to/example' },
    ],
    postIds: ['post-kir-1'],
  },
  {
    id: 'author-lena',
    name: 'Лена за столом',
    avatar: avatar('lena-table'),
    categories: ['materials', 'other'],
    description: 'Подкасты и ролики про подготовку партий и инструменты мастера.',
    contacts: [
      { type: 'vk', label: 'vk.com/lena_nri', url: 'https://vk.com/lena_nri' },
      { type: 'website', label: 'lena.nri', url: 'https://example.com/lena' },
    ],
    postIds: ['post-lena-1', 'post-lena-2'],
  },
  {
    id: 'author-igor',
    name: 'Игорь Стрим',
    avatar: avatar('igor-stream'),
    categories: ['other'],
    description: 'Стримы сессий и разборы мастерства. Shadowrun, D&D, Blades.',
    contacts: [
      { type: 'telegram', label: '@igor_nri', url: 'https://t.me/igor_nri' },
      { type: 'discord', label: 'IgorStream', url: 'https://discord.gg/example' },
    ],
    postIds: ['post-igor-1'],
  },
  {
    id: 'author-sony',
    name: 'Соня Столы',
    avatar: avatar('sony-tables'),
    categories: ['materials'],
    description: 'Пишу one-shot сценарии и таблицы для импровизации.',
    contacts: [
      { type: 'telegram', label: '@sony_tables', url: 'https://t.me/sony_tables' },
      { type: 'email', label: 'sony@tables.example', url: 'mailto:sony@tables.example' },
    ],
    postIds: ['post-sony-1', 'post-sony-2'],
  },
  {
    id: 'author-dasha',
    name: 'Даша Контент',
    avatar: avatar('dasha-content'),
    categories: ['forGames'],
    description: 'Гайды для игроков и handouts для расследований.',
    contacts: [
      {
        type: 'email',
        label: 'dasha.content@example.com',
        url: 'mailto:dasha.content@example.com',
      },
      { type: 'website', label: 'dasha.notes', url: 'https://example.com/dasha' },
    ],
    postIds: ['post-dasha-1', 'post-dasha-2'],
  },
];

export function filterPostsByCategory(
  posts: AuthorPost[],
  filter: CreativityCategoryFilter,
): AuthorPost[] {
  if (filter === 'all') {
    return posts;
  }
  return posts.filter((post) => post.category === filter);
}

export function getAuthorPosts(author: Author, posts: AuthorPost[]): AuthorPost[] {
  const byId = new Map(posts.map((post) => [post.id, post]));
  return author.postIds
    .map((id) => byId.get(id))
    .filter((post): post is AuthorPost => Boolean(post))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function isCreativityCategory(value: string): value is CreativityCategory {
  return (
    value === 'arts' ||
    value === 'maps' ||
    value === 'materials' ||
    value === 'forGames' ||
    value === 'memes' ||
    value === 'other'
  );
}
