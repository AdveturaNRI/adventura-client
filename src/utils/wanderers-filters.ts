import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  EMPTY_QUESTIONNAIRE_AVAILABILITY,
  formatAvailability,
  getAvailabilityDays,
  parseAvailability,
  stripAvailabilityTimes,
  type QuestionnaireAvailability,
} from '@/screens/questionnaire/availability';
import type { WandererCardItem } from '@/services/profile/wanderersApi';

export type WanderersPlayMode = 'online' | 'offline';

export const WANDERERS_ANY_SYSTEM = 'Любая система';
export const WANDERERS_READY_TO_LEARN = 'Готов пробовать новое';

export type WanderersFilters = {
  roles: string[];
  playModes: WanderersPlayMode[];
  locations: string[];
  systems: string[];
  experiences: string[];
  availability: QuestionnaireAvailability;
  ageMin: number | null;
  ageMax: number | null;
};

export type WanderersFilterOptions = {
  roles: string[];
  playModes: Array<{ value: WanderersPlayMode; label: string }>;
  locations: string[];
  officialSystems: string[];
  experiences: string[];
};

export const EMPTY_WANDERERS_FILTERS: WanderersFilters = {
  roles: [],
  playModes: [],
  locations: [],
  systems: [],
  experiences: [],
  availability: { ...EMPTY_QUESTIONNAIRE_AVAILABILITY, slots: [] },
  ageMin: null,
  ageMax: null,
};

const WANDERERS_FILTERS_KEY = '@adventura/wanderers-filters';

const ROLE_OPTIONS = ['Игрок', 'Мастер'] as const;

const PLAY_MODE_OPTIONS: Array<{ value: WanderersPlayMode; label: string }> = [
  { value: 'online', label: 'Онлайн' },
  { value: 'offline', label: 'Офлайн' },
];

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isPlayModeArray(value: unknown): value is WanderersPlayMode[] {
  return (
    Array.isArray(value) &&
    value.every((item) => item === 'online' || item === 'offline')
  );
}

function isAvailabilitySlot(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.day === 'number' &&
    typeof candidate.timeFrom === 'string' &&
    typeof candidate.timeTo === 'string'
  );
}

function isAvailability(value: unknown): value is QuestionnaireAvailability {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.byAgreement === 'boolean' &&
    Array.isArray(candidate.slots) &&
    candidate.slots.every(isAvailabilitySlot)
  );
}

export function hasActiveAvailability(availability: QuestionnaireAvailability): boolean {
  return availability.byAgreement || availability.slots.length > 0;
}

function isNullableInt(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

export function hasActiveAgeFilter(filters: Pick<WanderersFilters, 'ageMin' | 'ageMax'>): boolean {
  return filters.ageMin != null || filters.ageMax != null;
}

export function formatWanderersAgeFilter(
  filters: Pick<WanderersFilters, 'ageMin' | 'ageMax'>,
): string {
  const { ageMin, ageMax } = filters;

  if (ageMin != null && ageMax != null) {
    return ageMin === ageMax ? `${ageMin} лет` : `${ageMin}–${ageMax} лет`;
  }

  if (ageMin != null) {
    return `от ${ageMin}`;
  }

  if (ageMax != null) {
    return `до ${ageMax}`;
  }

  return '';
}

export function isWanderersFilters(value: unknown): value is WanderersFilters {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    isStringArray(candidate.roles) &&
    isPlayModeArray(candidate.playModes) &&
    isStringArray(candidate.locations) &&
    isStringArray(candidate.systems) &&
    isStringArray(candidate.experiences) &&
    isAvailability(candidate.availability) &&
    isNullableInt(candidate.ageMin ?? null) &&
    isNullableInt(candidate.ageMax ?? null)
  );
}

export function countActiveWanderersFilters(filters: WanderersFilters): number {
  return (
    filters.roles.length +
    filters.playModes.length +
    filters.locations.length +
    filters.systems.length +
    filters.experiences.length +
    (hasActiveAvailability(filters.availability) ? 1 : 0) +
    (hasActiveAgeFilter(filters) ? 1 : 0)
  );
}

export function hasActiveWanderersFilters(filters: WanderersFilters): boolean {
  return countActiveWanderersFilters(filters) > 0;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'ru'),
  );
}

export function buildWanderersFilterOptions(input: {
  items: WandererCardItem[];
  officialSystems: string[];
  experiences: string[];
}): WanderersFilterOptions {
  return {
    roles: [...ROLE_OPTIONS],
    playModes: PLAY_MODE_OPTIONS,
    locations: uniqueSorted(
      input.items.flatMap((item) => (item.location?.trim() ? [item.location.trim()] : [])),
    ),
    officialSystems: uniqueSorted(input.officialSystems),
    experiences: uniqueSorted(input.experiences),
  };
}

function matchesPlayFilters(item: WandererCardItem, filters: WanderersFilters): boolean {
  const hasPlayModeFilter = filters.playModes.length > 0;
  const hasLocationFilter = filters.locations.length > 0;

  if (!hasPlayModeFilter && !hasLocationFilter) {
    return true;
  }

  const matchesOnline = filters.playModes.includes('online') && item.playsOnline;
  const matchesOffline =
    filters.playModes.includes('offline') && Boolean(item.location?.trim());
  const matchesLocation =
    hasLocationFilter &&
    Boolean(item.location?.trim()) &&
    filters.locations.includes(item.location!.trim());

  if (hasPlayModeFilter && hasLocationFilter) {
    return matchesOnline || matchesOffline || matchesLocation;
  }

  if (hasPlayModeFilter) {
    return matchesOnline || matchesOffline;
  }

  return matchesLocation;
}

function matchesSystemFilters(item: WandererCardItem, selected: string[]): boolean {
  if (selected.length === 0) {
    return true;
  }

  const itemSystems = new Set(item.systems.map((system) => system.trim()).filter(Boolean));

  return selected.some((value) => {
    if (value === WANDERERS_ANY_SYSTEM) {
      return item.openToAnySystem;
    }

    if (value === WANDERERS_READY_TO_LEARN) {
      return item.readyToLearnNew;
    }

    return itemSystems.has(value) || item.openToAnySystem;
  });
}

function matchesAvailabilityFilter(
  item: WandererCardItem,
  filter: QuestionnaireAvailability,
): boolean {
  if (!hasActiveAvailability(filter)) {
    return true;
  }

  const itemAvailability = parseAvailability(item.availability);

  if (filter.byAgreement) {
    return itemAvailability.byAgreement;
  }

  // Flexible players match any concrete schedule request.
  if (itemAvailability.byAgreement) {
    return true;
  }

  const filterDays = getAvailabilityDays(filter);
  const itemDays = getAvailabilityDays(itemAvailability);

  if (filterDays.length > 0) {
    if (itemDays.length === 0) {
      return false;
    }

    if (!filterDays.some((day) => itemDays.includes(day))) {
      return false;
    }
  }

  return true;
}

function matchesAgeFilter(
  item: WandererCardItem,
  filters: Pick<WanderersFilters, 'ageMin' | 'ageMax'>,
): boolean {
  if (!hasActiveAgeFilter(filters)) {
    return true;
  }

  if (item.age == null || !Number.isFinite(item.age)) {
    return false;
  }

  if (filters.ageMin != null && item.age < filters.ageMin) {
    return false;
  }

  if (filters.ageMax != null && item.age > filters.ageMax) {
    return false;
  }

  return true;
}

export function applyWanderersFilters(
  items: WandererCardItem[],
  filters: WanderersFilters,
): WandererCardItem[] {
  if (!hasActiveWanderersFilters(filters)) {
    return items;
  }

  return items.filter((item) => {
    if (item.blockedByMe) {
      return true;
    }

    if (
      filters.roles.length > 0 &&
      !filters.roles.some((role) => item.roles.includes(role))
    ) {
      return false;
    }

    if (!matchesPlayFilters(item, filters)) {
      return false;
    }

    if (!matchesSystemFilters(item, filters.systems)) {
      return false;
    }

    if (
      filters.experiences.length > 0 &&
      (!item.experienceLabel?.trim() ||
        !filters.experiences.includes(item.experienceLabel.trim()))
    ) {
      return false;
    }

    if (!matchesAvailabilityFilter(item, filters.availability)) {
      return false;
    }

    if (!matchesAgeFilter(item, filters)) {
      return false;
    }

    return true;
  });
}

export function formatWanderersAvailabilityFilter(
  availability: QuestionnaireAvailability,
): string {
  return formatAvailability(availability, { includeTime: false });
}

export async function loadWanderersFilters(): Promise<WanderersFilters> {
  try {
    const raw = await AsyncStorage.getItem(WANDERERS_FILTERS_KEY);

    if (!raw) {
      return EMPTY_WANDERERS_FILTERS;
    }

    const parsed: unknown = JSON.parse(raw);

    if (!isWanderersFilters(parsed)) {
      return EMPTY_WANDERERS_FILTERS;
    }

    return {
      ...EMPTY_WANDERERS_FILTERS,
      ...parsed,
      ageMin: typeof parsed.ageMin === 'number' ? parsed.ageMin : null,
      ageMax: typeof parsed.ageMax === 'number' ? parsed.ageMax : null,
      availability: stripAvailabilityTimes(parsed.availability),
    };
  } catch {
    return EMPTY_WANDERERS_FILTERS;
  }
}

export async function saveWanderersFilters(filters: WanderersFilters): Promise<void> {
  await AsyncStorage.setItem(WANDERERS_FILTERS_KEY, JSON.stringify(filters));
}
