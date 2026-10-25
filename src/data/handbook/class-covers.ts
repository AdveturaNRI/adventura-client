/**
 * Локальные обложки классов (`assets/handbook/classes`).
 * Ключ — англ. имя класса (стабильный id из дампа).
 */
export const HANDBOOK_CLASS_COVERS: Record<string, number> = {
  bard: require('../../../assets/handbook/classes/c1xq4p.jpg'),
  barbarian: require('../../../assets/handbook/classes/d7m2kw.jpg'),
  warlock: require('../../../assets/handbook/classes/e9n5tr.jpg'),
  monk: require('../../../assets/handbook/classes/f3h8vb.jpg'),
  sorcerer: require('../../../assets/handbook/classes/g6p1yc.jpg'),
  wizard: require('../../../assets/handbook/classes/j2s4lm.jpg'),
  cleric: require('../../../assets/handbook/classes/k8w0nq.jpg'),
  fighter: require('../../../assets/handbook/classes/m4r7zt.jpg'),
  druid: require('../../../assets/handbook/classes/n1b5xf.jpg'),
  artificer: require('../../../assets/handbook/classes/p9c3vh.jpg'),
  paladin: require('../../../assets/handbook/classes/q2v8yk.jpg'),
  rogue: require('../../../assets/handbook/classes/s5n1wp.jpg'),
  ranger: require('../../../assets/handbook/classes/t8c4jm.jpg'),
};

/**
 * Обложки по id записи Laaru (`laaru-class-<id>`) — точное соответствие,
 * поэтому «Бард (альт.)» не пересекается с «Бард».
 */
export const HANDBOOK_CLASS_COVERS_BY_ID: Record<string, number> = {
  'laaru-class-5kByKfwsJlxjGx1J': require('../../../assets/handbook/classes/z4g9gy.jpg'), // Алхимик (UA)
  'laaru-class-W5y7pMFqHwLlveEU': require('../../../assets/handbook/classes/0ili8t.jpg'), // Вместилище духа
  'laaru-class-K92vt5VwbhYzSHql': require('../../../assets/handbook/classes/ds85k2.jpg'), // Военачальник
  'laaru-class-pMoxhu81Vuk4NAFt': require('../../../assets/handbook/classes/x2394j.jpg'), // Дебошир
  'laaru-class-Rqkk3wiVHVRiz4VX': require('../../../assets/handbook/classes/7iwu7n.jpg'), // Звездочёт
  'laaru-class-LubVbsvOTVEjmt4H': require('../../../assets/handbook/classes/cemhn0.jpg'), // Иллриггер
  'laaru-class-xpLji2GjFYGY2Ocp': require('../../../assets/handbook/classes/4flktn.jpg'), // Кровавый охотник
  'laaru-class-VdV6RoNEbklkeaRl': require('../../../assets/handbook/classes/67l6cd.jpg'), // Кровавый охотник (альт.)
  'laaru-class-tu8UOqN78iw6dw4w': require('../../../assets/handbook/classes/ncqlq1.jpg'), // Магус
  'laaru-class-9uYvLMtCsF6KqT04': require('../../../assets/handbook/classes/62xajt.jpg'), // Мистик (UA)
  'laaru-class-qzq9xtGJUccOeCSv': require('../../../assets/handbook/classes/zjxqxo.jpg'), // Неупокоённая душа
  'laaru-class-JNL1zbT4Io6xKLyv': require('../../../assets/handbook/classes/ypw6jn.jpg'), // Оккультист
  'laaru-class-Z9Y704fYEdK9OTD9': require('../../../assets/handbook/classes/oohkkm.jpg'), // Охотник на монстров
  'laaru-class-wZHSZpg5BtllDXMo': require('../../../assets/handbook/classes/jgup5i.jpg'), // Предводитель
  'laaru-class-8NgwwaUfDSKSKFde': require('../../../assets/handbook/classes/c24t6h.jpg'), // Претор
  'laaru-class-zY9bi9vmv2kwooe7': require('../../../assets/handbook/classes/07drff.jpg'), // Простолюдин
  'laaru-class-2B9z1Zfr065um1xJ': require('../../../assets/handbook/classes/qgb3b7.jpg'), // Псион
  'laaru-class-U5pfjrXl28OKGdtR': require('../../../assets/handbook/classes/uzb62d.jpg'), // Псионик (UA:HB)
  'laaru-class-1szIo4lf5QXko64f': require('../../../assets/handbook/classes/il0v8i.jpg'), // Савант
  'laaru-class-yVmchtxxOyaNIIEr': require('../../../assets/handbook/classes/30iily.jpg'), // Спеллблейд
  'laaru-class-4CiatHkfjsP5JveY': require('../../../assets/handbook/classes/v8pbu0.jpg'), // Страж
  'laaru-class-cClrhDFdhk1ztjmD': require('../../../assets/handbook/classes/e8k5iw.jpg'), // Хранитель рун
  'laaru-class-s1d25ZrQPycJhcjo': require('../../../assets/handbook/classes/jch9ur.jpg'), // Шаман
  'laaru-class-vrPvEIDrd72klJBL': require('../../../assets/handbook/classes/0pk8d1.jpg'), // Бард (альт.)
  'laaru-class-Gg82NbnKG9O14MPh': require('../../../assets/handbook/classes/p59es8.jpg'), // Варвар (альт.)
  'laaru-class-kaJc6neZqk2uhLoB': require('../../../assets/handbook/classes/1tiwjx.jpg'), // Воин (альт.)
  'laaru-class-2ysvIFUlkWPBKiWw': require('../../../assets/handbook/classes/3umhzy.jpg'), // Волшебник (альт.)
  'laaru-class-o7VL5EMyhaBWA112': require('../../../assets/handbook/classes/ry9es9.jpg'), // Друид (альт.)
  'laaru-class-nKksmWECiP7hsbtP': require('../../../assets/handbook/classes/d1fz01.jpg'), // Изобретатель (альт.)
  'laaru-class-1vaUJu1z2OBCDZut': require('../../../assets/handbook/classes/p7mqui.jpg'), // Колдун (альт.)
  'laaru-class-veIZ06SFWpekWbDX': require('../../../assets/handbook/classes/i22cuc.jpg'), // Монах (альт.)
  'laaru-class-vpIQlrX9RUa0r9VN': require('../../../assets/handbook/classes/efi81a.jpg'), // Паладин (альт.)
  'laaru-class-33aFSlhbPcCCf8ye': require('../../../assets/handbook/classes/oumt68.jpg'), // Плут (альт.)
  'laaru-class-Krrfy5d5xo0TFy0P': require('../../../assets/handbook/classes/gfsc2r.jpg'), // Следопыт (альт.)
  'laaru-class-KiHyhnNeuELJfbDh': require('../../../assets/handbook/classes/m1yfbg.jpg'), // Чародей (альт.)
};

/** RU-заголовок → ключ обложки (для записей без en в JSON). */
const TITLE_TO_COVER_KEY: Record<string, string> = {
  Бард: 'bard',
  Варвар: 'barbarian',
  Воин: 'fighter',
  Волшебник: 'wizard',
  Жрец: 'cleric',
  Колдун: 'warlock',
  Монах: 'monk',
  Паладин: 'paladin',
  Плут: 'rogue',
  Следопыт: 'ranger',
  Чародей: 'sorcerer',
  Друид: 'druid',
  Изобретатель: 'artificer',
  Артефактор: 'artificer',
};

export function getHandbookClassCoverSource(
  title: string,
  entryId?: string,
): number | undefined {
  if (entryId) {
    const byId = HANDBOOK_CLASS_COVERS_BY_ID[entryId];
    if (byId) return byId;
  }
  const key = TITLE_TO_COVER_KEY[title.trim()];
  if (!key) return undefined;
  return HANDBOOK_CLASS_COVERS[key];
}
