const RECENT_LIMIT_DEFAULT = 16;
const RECENT_LIMIT_MAX = 64;

const recentByPool = new Map<string, unknown[]>();

function recentLimitFor(size: number): number {
  if (size <= 2) return 1;
  // держим в «недавних» до половины пула — меньше точных повторов подряд
  return Math.min(RECENT_LIMIT_MAX, Math.max(RECENT_LIMIT_DEFAULT, Math.floor(size * 0.5)));
}

function remember(poolKey: string, value: unknown, limit: number) {
  const list = recentByPool.get(poolKey) ?? [];
  list.unshift(value);
  if (list.length > limit) list.length = limit;
  recentByPool.set(poolKey, list);
}

/** Слова из фразы — чтобы «Серебряный Шаг» и «Серебряный Лист» не шли подряд. */
function tokensOf(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  return value
    .toLowerCase()
    .split(/[\s«»"'`‘’“”.,;:!?()[\]{}|/\\+]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
}

export function pickOne<T>(items: readonly T[], rng: () => number = Math.random): T {
  if (items.length === 0) {
    throw new Error('Нельзя выбрать из пустого списка');
  }
  const index = Math.floor(rng() * items.length);
  return items[Math.min(index, items.length - 1)]!;
}

/**
 * Случайный элемент без недавних повторов.
 * Для составных фраз также избегает общих слов («Серебряный …»).
 */
export function pickFresh<T>(
  poolKey: string,
  items: readonly T[],
  rng: () => number = Math.random,
): T {
  if (items.length === 0) {
    throw new Error(`Пул «${poolKey}» пуст`);
  }
  if (items.length === 1) {
    const only = items[0]!;
    remember(poolKey, only, 1);
    return only;
  }

  const limit = recentLimitFor(items.length);
  const recent = recentByPool.get(poolKey) ?? [];
  const avoidExact = new Set(recent.slice(0, Math.min(limit, items.length - 1)));

  // токены — только для имён/фамилий/кланов; во внешности «шрам» должен встречаться
  const tokenAware = /(?:^|\.)(name|surname|clan)(?:\.|$)/i.test(poolKey);
  const avoidTokens = tokenAware
    ? new Set(recent.slice(0, limit).flatMap((v) => tokensOf(v)))
    : new Set<string>();

  const noExact = items.filter((item) => !avoidExact.has(item));
  const noToken =
    avoidTokens.size === 0
      ? noExact
      : noExact.filter((item) => {
          const toks = tokensOf(item);
          if (toks.length === 0) return true;
          return !toks.some((t) => avoidTokens.has(t));
        });

  const pool =
    noToken.length > 0 ? noToken : noExact.length > 0 ? noExact : items;
  const value = pickOne(pool, rng);
  remember(poolKey, value, limit);
  return value;
}

export function pickUniquePair<T>(
  items: readonly T[],
  rng: () => number = Math.random,
): [T, T] {
  if (items.length < 2) {
    const only = pickOne(items, rng);
    return [only, only];
  }
  const first = pickOne(items, rng);
  let second = pickOne(items, rng);
  let guard = 0;
  while (second === first && guard < 12) {
    second = pickOne(items, rng);
    guard += 1;
  }
  return [first, second];
}

export function clearPickHistory(poolKey?: string) {
  if (poolKey) recentByPool.delete(poolKey);
  else recentByPool.clear();
}
