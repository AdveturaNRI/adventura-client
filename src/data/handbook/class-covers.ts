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

export function getHandbookClassCoverSource(title: string): number | undefined {
  const key = TITLE_TO_COVER_KEY[title.trim()];
  if (!key) return undefined;
  return HANDBOOK_CLASS_COVERS[key];
}
