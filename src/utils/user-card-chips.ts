import type { ComponentProps } from 'react';

import type { Ionicons } from '@expo/vector-icons';

import { isOfficialGameSystemName } from '@/utils/official-game-systems-cache';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export type UserCardChipTone =
  | 'default'
  | 'online'
  | 'official'
  | 'learn'
  | 'agreement'
  | 'muted';

export type UserCardChip = {
  key: string;
  label: string;
  tone: UserCardChipTone;
  icon?: IoniconName;
};

export type UserCardPlayInfoInput = {
  playsOnline: boolean;
  /** @deprecated use locations */
  location?: string | null;
  locations?: string[];
  systems: string[];
  readyToLearnNew: boolean;
  openToAnySystem: boolean;
  experience: string;
  schedule: string;
  /** IANA timezone, e.g. Europe/Moscow */
  timezone?: string | null;
};

const READY_TO_LEARN_LABEL = 'Готов пробовать новое';
const OPEN_TO_ANY_SYSTEM_LABEL = 'Любая система';
const ONLINE_LABEL = 'Онлайн';
const NOT_SPECIFIED_LABEL = 'Не указано';

function isAgreementSchedule(schedule: string): boolean {
  return /^по договор/i.test(schedule.trim());
}

function resolveLocationNames(
  locations: string[] | undefined,
  location: string | null | undefined,
): string[] {
  if (locations && locations.length > 0) {
    return locations.map((item) => item.trim()).filter(Boolean);
  }

  const legacy = location?.trim();
  if (!legacy) {
    return [];
  }

  return legacy
    .split(/\s*[·|,]\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function buildLocationChips(
  playsOnline: boolean,
  locationOrLocations: string | string[] | null | undefined,
  maybeLocations?: string[],
): UserCardChip[] {
  const locations = Array.isArray(locationOrLocations)
    ? resolveLocationNames(locationOrLocations, null)
    : resolveLocationNames(maybeLocations, locationOrLocations);

  const chips: UserCardChip[] = [];

  if (playsOnline) {
    chips.push({
      key: 'online',
      label: ONLINE_LABEL,
      tone: 'online',
      icon: 'wifi-outline',
    });
  }

  for (const city of locations) {
    chips.push({
      key: `city-${city}`,
      label: city,
      tone: 'default',
      icon: 'location-outline',
    });
  }

  if (chips.length === 0) {
    chips.push({
      key: 'location-empty',
      label: NOT_SPECIFIED_LABEL,
      tone: 'muted',
      icon: 'help-circle-outline',
    });
  }

  return chips;
}

export function buildSystemChips(
  systems: string[],
  readyToLearnNew: boolean,
  openToAnySystem: boolean,
  officialNames: Set<string>,
): UserCardChip[] {
  const chips: UserCardChip[] = systems.map((system) => ({
    key: `system-${system}`,
    label: system,
    tone: isOfficialGameSystemName(system, officialNames) ? 'official' : 'default',
    icon: 'dice-outline',
  }));

  if (openToAnySystem) {
    chips.push({
      key: 'open-to-any',
      label: OPEN_TO_ANY_SYSTEM_LABEL,
      tone: 'agreement',
      icon: 'apps-outline',
    });
  }

  if (readyToLearnNew) {
    chips.push({
      key: 'ready-to-learn',
      label: READY_TO_LEARN_LABEL,
      tone: 'learn',
      icon: 'sparkles-outline',
    });
  }

  if (chips.length === 0) {
    chips.push({
      key: 'systems-empty',
      label: NOT_SPECIFIED_LABEL,
      tone: 'muted',
      icon: 'help-circle-outline',
    });
  }

  return chips;
}

export function buildExperienceChips(experience: string): UserCardChip[] {
  const trimmed = experience.trim();

  if (!trimmed || trimmed === NOT_SPECIFIED_LABEL) {
    return [
      {
        key: 'experience-empty',
        label: NOT_SPECIFIED_LABEL,
        tone: 'muted',
        icon: 'ribbon-outline',
      },
    ];
  }

  return [
    {
      key: `experience-${trimmed}`,
      label: trimmed,
      tone: 'default',
      icon: 'ribbon-outline',
    },
  ];
}

export function buildScheduleChips(
  schedule: string,
  timezoneLabel?: string | null,
): UserCardChip[] {
  const trimmed = schedule.trim();
  const chips: UserCardChip[] = [];

  if (!trimmed || trimmed === NOT_SPECIFIED_LABEL) {
    chips.push({
      key: 'schedule-empty',
      label: NOT_SPECIFIED_LABEL,
      tone: 'muted',
      icon: 'calendar-outline',
    });
  } else {
    chips.push({
      key: `schedule-${trimmed}`,
      label: trimmed,
      tone: isAgreementSchedule(trimmed) ? 'agreement' : 'default',
      icon: isAgreementSchedule(trimmed) ? 'chatbubbles-outline' : 'calendar-outline',
    });
  }

  const tz = timezoneLabel?.trim();
  if (tz) {
    chips.push({
      key: `timezone-${tz}`,
      label: tz,
      tone: 'official',
      icon: 'time-outline',
    });
  }

  return chips;
}
