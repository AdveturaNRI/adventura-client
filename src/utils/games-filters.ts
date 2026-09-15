import type { GameKind, GameListItem, GamesFeedStatus } from '@/services/games/gamesApi';
import { formatCityLabel } from '@/utils/city-label';
import { formatDateRu, isSameCalendarDay } from '@/utils/date-format';

export type GamesPlayMode = 'online' | 'offline';
export type GamesAgeFilter = 'any' | '12' | '16' | '18';
export type GamesSchedulePreset = 'upcoming' | 'past';

export type GamesFeedFilters = {
  status: GamesFeedStatus;
  q: string;
  kind: GameKind | null;
  playMode: GamesPlayMode | null;
  cityId: string | null;
  cityLabel: string;
  system: string | null;
  /** null = любой, true = бесплатно, false = платно */
  isFree: boolean | null;
  hasSeats: boolean;
  beginnersWelcome: boolean;
  age: GamesAgeFilter | null;
  /** Quick date filter; clears custom range when set */
  schedulePreset: GamesSchedulePreset | null;
  /** Inclusive YYYY-MM-DD */
  scheduledFrom: string | null;
  /** Inclusive YYYY-MM-DD */
  scheduledTo: string | null;
};

export const EMPTY_GAMES_FEED_FILTERS: GamesFeedFilters = {
  status: 'RECRUITING',
  q: '',
  kind: null,
  playMode: null,
  cityId: null,
  cityLabel: '',
  system: null,
  isFree: null,
  hasSeats: false,
  beginnersWelcome: false,
  age: null,
  schedulePreset: 'upcoming',
  scheduledFrom: null,
  scheduledTo: null,
};

function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value?.trim()) {
    return null;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function toIsoDateLocal(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function getTodayLocal(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function getYesterdayLocal(): Date {
  const today = getTodayLocal();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
}

export function formatGamesDateRangeLabel(
  from: string | null,
  to: string | null,
): string | null {
  const fromDate = parseIsoDate(from);
  const toDate = parseIsoDate(to);
  if (!fromDate || !toDate) {
    return null;
  }
  if (isSameCalendarDay(fromDate, toDate)) {
    return formatDateRu(fromDate);
  }
  return `${formatDateRu(fromDate)} – ${formatDateRu(toDate)}`;
}

export function formatGamesScheduleLabel(filters: GamesFeedFilters): string | null {
  if (filters.schedulePreset === 'upcoming') {
    return 'Текущие';
  }
  if (filters.schedulePreset === 'past') {
    return 'Прошедшие';
  }
  return formatGamesDateRangeLabel(filters.scheduledFrom, filters.scheduledTo);
}

export function hasGamesScheduleFilter(filters: GamesFeedFilters): boolean {
  if (filters.schedulePreset) {
    return true;
  }
  return Boolean(filters.scheduledFrom && filters.scheduledTo);
}

export function clearGamesScheduleFilter(filters: GamesFeedFilters): GamesFeedFilters {
  return {
    ...filters,
    schedulePreset: null,
    scheduledFrom: null,
    scheduledTo: null,
  };
}

export function countActiveGamesFilters(filters: GamesFeedFilters): number {
  let count = 0;
  if (filters.q.trim()) count += 1;
  if (filters.kind) count += 1;
  if (filters.playMode) count += 1;
  if (filters.cityId) count += 1;
  if (filters.system) count += 1;
  if (filters.isFree !== null) count += 1;
  if (filters.hasSeats) count += 1;
  if (filters.beginnersWelcome) count += 1;
  if (filters.age) count += 1;
  if (hasGamesScheduleFilter(filters)) count += 1;
  return count;
}

export function gamesFiltersSignature(filters: GamesFeedFilters): string {
  return [
    filters.status,
    filters.q.trim().toLowerCase(),
    filters.kind ?? '',
    filters.playMode ?? '',
    filters.cityId ?? '',
    filters.system ?? '',
    filters.isFree === null ? '' : filters.isFree ? '1' : '0',
    filters.hasSeats ? '1' : '0',
    filters.beginnersWelcome ? '1' : '0',
    filters.age ?? '',
    filters.schedulePreset ?? '',
    filters.scheduledFrom ?? '',
    filters.scheduledTo ?? '',
  ].join('|');
}

export type GamesFilterChip = {
  key: string;
  label: string;
  icon: string;
};

export function buildActiveGamesFilterChips(filters: GamesFeedFilters): GamesFilterChip[] {
  const chips: GamesFilterChip[] = [];

  if (filters.q.trim()) {
    chips.push({ key: 'q', label: `«${filters.q.trim()}»`, icon: 'search-outline' });
  }
  if (filters.kind === 'ONESHOT') {
    chips.push({ key: 'kind', label: 'Ваншот', icon: 'flash-outline' });
  } else if (filters.kind === 'CAMPAIGN') {
    chips.push({ key: 'kind', label: 'Кампания', icon: 'library-outline' });
  }
  if (filters.playMode === 'online') {
    chips.push({ key: 'playMode', label: 'Онлайн', icon: 'wifi-outline' });
  } else if (filters.playMode === 'offline') {
    chips.push({
      key: 'playMode',
      label: filters.cityLabel.trim() || 'Офлайн · мои города',
      icon: 'map-outline',
    });
  }
  if (filters.system) {
    chips.push({ key: 'system', label: filters.system, icon: 'extension-puzzle-outline' });
  }
  if (filters.isFree === true) {
    chips.push({ key: 'isFree', label: 'Бесплатно', icon: 'pricetag-outline' });
  } else if (filters.isFree === false) {
    chips.push({ key: 'isFree', label: 'Платно', icon: 'cash-outline' });
  }
  if (filters.hasSeats) {
    chips.push({ key: 'hasSeats', label: 'Есть места', icon: 'people-outline' });
  }
  if (filters.beginnersWelcome) {
    chips.push({
      key: 'beginnersWelcome',
      label: 'Опыт не важен',
      icon: 'school-outline',
    });
  }
  if (filters.age === 'any') {
    chips.push({ key: 'age', label: 'Любой возраст', icon: 'id-card-outline' });
  } else if (filters.age) {
    chips.push({ key: 'age', label: `${filters.age}+`, icon: 'id-card-outline' });
  }
  const dateLabel = formatGamesScheduleLabel(filters);
  if (dateLabel) {
    chips.push({
      key: 'schedule',
      label: dateLabel,
      icon: filters.schedulePreset === 'past' ? 'time-outline' : 'today-outline',
    });
  }

  return chips;
}

export function clearGamesFilterChip(
  filters: GamesFeedFilters,
  key: string,
): GamesFeedFilters {
  switch (key) {
    case 'q':
      return { ...filters, q: '' };
    case 'kind':
      return { ...filters, kind: null };
    case 'playMode':
      return { ...filters, playMode: null, cityId: null, cityLabel: '' };
    case 'system':
      return { ...filters, system: null };
    case 'isFree':
      return { ...filters, isFree: null };
    case 'hasSeats':
      return { ...filters, hasSeats: false };
    case 'beginnersWelcome':
      return { ...filters, beginnersWelcome: false };
    case 'age':
      return { ...filters, age: null };
    case 'schedule':
      return clearGamesScheduleFilter(filters);
    default:
      return filters;
  }
}

/** Бейджи карточки, по которым можно сразу включить фильтр каталога. */
export type GameFeedFilterBadge =
  | 'kind'
  | 'playMode'
  | 'system'
  | 'age'
  | 'isFree'
  | 'beginnersWelcome';

export function ageFilterFromGame(item: Pick<GameListItem, 'anyAge' | 'minAge'>): GamesAgeFilter {
  if (item.anyAge || item.minAge == null || item.minAge <= 0) {
    return 'any';
  }
  if (item.minAge >= 18) {
    return '18';
  }
  if (item.minAge >= 16) {
    return '16';
  }
  return '12';
}

export function patchGamesFiltersFromBadge(
  item: Pick<
    GameListItem,
    | 'kind'
    | 'isOnline'
    | 'city'
    | 'systemName'
    | 'anyAge'
    | 'minAge'
    | 'isFree'
    | 'beginnersWelcome'
  >,
  badge: GameFeedFilterBadge,
): Partial<GamesFeedFilters> {
  switch (badge) {
    case 'kind':
      return { kind: item.kind };
    case 'playMode':
      if (item.isOnline) {
        return { playMode: 'online', cityId: null, cityLabel: '' };
      }
      return {
        playMode: 'offline',
        cityId: item.city?.id ?? null,
        cityLabel: item.city
          ? formatCityLabel({
              name: item.city.name,
              region: item.city.region,
              countryCode: 'RU',
            })
          : '',
      };
    case 'system':
      return { system: item.systemName.trim() || null };
    case 'age':
      return { age: ageFilterFromGame(item) };
    case 'isFree':
      return { isFree: item.isFree };
    case 'beginnersWelcome':
      return { beginnersWelcome: true };
    default:
      return {};
  }
}

export function applyGamesFilterPatch(
  filters: GamesFeedFilters,
  patch: Partial<GamesFeedFilters>,
): GamesFeedFilters {
  return { ...filters, ...patch };
}

function firstParam(
  value: string | string[] | undefined | null,
): string | null {
  if (value == null) {
    return null;
  }
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
}

function parseKindParam(value: string | null): GameKind | null {
  if (!value) {
    return null;
  }
  const normalized = value.toLowerCase().replace(/[_-]/g, '');
  if (normalized === 'oneshot' || normalized === 'typeoneshot') {
    return 'ONESHOT';
  }
  if (normalized === 'campaign' || normalized === 'typecampaign') {
    return 'CAMPAIGN';
  }
  if (value === 'ONESHOT' || value === 'CAMPAIGN') {
    return value;
  }
  return null;
}

function parseAgeParam(value: string | null): GamesAgeFilter | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toLowerCase().replace(/\+/g, '');
  if (normalized === 'any' || normalized === 'любой') {
    return 'any';
  }
  if (normalized === '12' || normalized === '16' || normalized === '18') {
    return normalized;
  }
  return null;
}

function parsePlayModeParam(value: string | null): GamesPlayMode | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'online' || normalized === 'онлайн') {
    return 'online';
  }
  if (normalized === 'offline' || normalized === 'офлайн') {
    return 'offline';
  }
  return null;
}

function parseBoolParam(value: string | null): boolean | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'free') {
    return true;
  }
  if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'paid') {
    return false;
  }
  return null;
}

export type GamesFeedSearchParams = Record<string, string | string[] | undefined>;

export function hasGamesFilterSearchParams(params: GamesFeedSearchParams): boolean {
  return Boolean(
    firstParam(params.kind) ||
      firstParam(params.type) ||
      firstParam(params.playMode) ||
      firstParam(params.format) ||
      firstParam(params.age) ||
      firstParam(params.system) ||
      firstParam(params.isFree) ||
      firstParam(params.free) ||
      firstParam(params.beginnersWelcome) ||
      firstParam(params.cityId) ||
      firstParam(params.q),
  );
}

/** Читает query каталога (`/games?kind=oneshot&age=18+`). */
export function gamesFeedFiltersFromSearchParams(
  params: GamesFeedSearchParams,
  base: GamesFeedFilters = EMPTY_GAMES_FEED_FILTERS,
): GamesFeedFilters {
  const kind =
    parseKindParam(firstParam(params.kind)) ??
    parseKindParam(firstParam(params.type));
  const playMode =
    parsePlayModeParam(firstParam(params.playMode)) ??
    parsePlayModeParam(firstParam(params.format));
  const age = parseAgeParam(firstParam(params.age));
  const system = firstParam(params.system);
  const isFree =
    parseBoolParam(firstParam(params.isFree)) ??
    parseBoolParam(firstParam(params.free));
  const beginnersWelcome = parseBoolParam(firstParam(params.beginnersWelcome));
  const cityId = firstParam(params.cityId);
  const cityLabel = firstParam(params.cityLabel) ?? '';
  const q = firstParam(params.q) ?? base.q;

  let next: GamesFeedFilters = {
    ...base,
    ...(kind ? { kind } : {}),
    ...(playMode ? { playMode } : {}),
    ...(age ? { age } : {}),
    ...(system ? { system } : {}),
    ...(isFree !== null ? { isFree } : {}),
    ...(beginnersWelcome === true ? { beginnersWelcome: true } : {}),
    ...(q ? { q } : {}),
  };

  if (playMode === 'offline' && cityId) {
    next = { ...next, cityId, cityLabel };
  }

  return next;
}

/** Сериализует активные фильтры в query для шаринга и перехода с деталки. */
export function gamesFeedSearchParamsFromFilters(
  filters: GamesFeedFilters,
): Record<string, string> {
  const params: Record<string, string> = {};

  if (filters.kind === 'ONESHOT') {
    params.kind = 'oneshot';
  } else if (filters.kind === 'CAMPAIGN') {
    params.kind = 'campaign';
  }
  if (filters.playMode) {
    params.playMode = filters.playMode;
  }
  if (filters.cityId) {
    params.cityId = filters.cityId;
  }
  if (filters.cityLabel.trim()) {
    params.cityLabel = filters.cityLabel.trim();
  }
  if (filters.system) {
    params.system = filters.system;
  }
  if (filters.isFree === true) {
    params.isFree = 'true';
  } else if (filters.isFree === false) {
    params.isFree = 'false';
  }
  if (filters.beginnersWelcome) {
    params.beginnersWelcome = 'true';
  }
  if (filters.age === 'any') {
    params.age = 'any';
  } else if (filters.age) {
    params.age = `${filters.age}+`;
  }
  if (filters.q.trim()) {
    params.q = filters.q.trim();
  }

  return params;
}

export function gamesCatalogHrefFromFilterPatch(
  patch: Partial<GamesFeedFilters>,
): { pathname: '/games'; params: Record<string, string> } {
  const filters = applyGamesFilterPatch(EMPTY_GAMES_FEED_FILTERS, patch);
  return {
    pathname: '/games',
    params: gamesFeedSearchParamsFromFilters(filters),
  };
}
