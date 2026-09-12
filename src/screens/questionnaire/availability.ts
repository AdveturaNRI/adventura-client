export type AvailabilityDaySlot = {
  day: number;
  timeFrom: string;
  timeTo: string;
};

export type QuestionnaireAvailability = {
  byAgreement: boolean;
  slots: AvailabilityDaySlot[];
};

export const WEEKDAY_OPTIONS = [
  { index: 0, short: 'ПН' },
  { index: 1, short: 'ВТ' },
  { index: 2, short: 'СР' },
  { index: 3, short: 'ЧТ' },
  { index: 4, short: 'ПТ' },
  { index: 5, short: 'СБ' },
  { index: 6, short: 'ВС' },
] as const;

export const EMPTY_QUESTIONNAIRE_AVAILABILITY: QuestionnaireAvailability = {
  byAgreement: false,
  slots: [],
};

const DAY_SHORT_TO_INDEX = Object.fromEntries(
  WEEKDAY_OPTIONS.map((day) => [day.short, day.index]),
) as Record<string, number>;

function normalizeTime(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);

  if (digits.length <= 2) {
    return digits;
  }

  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export function formatAvailabilityTimeInput(value: string): string {
  return normalizeTime(value);
}

/** Turns partial hour input like "22" or "9" into "22:00" / "09:00". */
export function completeAvailabilityTime(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);

  if (!digits) {
    return '';
  }

  if (digits.length <= 2) {
    const hours = Number(digits);

    if (Number.isNaN(hours) || hours > 23) {
      return '';
    }

    return `${String(hours).padStart(2, '0')}:00`;
  }

  const hours = Number(digits.slice(0, 2));
  const minutesRaw = digits.slice(2).padEnd(2, '0');
  const minutes = Number(minutesRaw);

  if (Number.isNaN(hours) || Number.isNaN(minutes) || hours > 23 || minutes > 59) {
    return '';
  }

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function isValidTime(value: string): boolean {
  const completed = completeAvailabilityTime(value);

  if (!/^\d{2}:\d{2}$/.test(completed)) {
    return false;
  }

  const [hours, minutes] = completed.split(':').map(Number);

  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function formatTimePart(timeFrom: string, timeTo: string): string {
  const from = completeAvailabilityTime(timeFrom);
  const to = completeAvailabilityTime(timeTo);
  const hasFrom = isValidTime(from);
  const hasTo = isValidTime(to);

  if (hasFrom && hasTo) {
    return `${from}–${to}`;
  }

  if (hasFrom) {
    return `с ${from}`;
  }

  if (hasTo) {
    return `до ${to}`;
  }

  return '';
}

function timeKey(slot: Pick<AvailabilityDaySlot, 'timeFrom' | 'timeTo'>): string {
  return `${completeAvailabilityTime(slot.timeFrom)}|${completeAvailabilityTime(slot.timeTo)}`;
}

function formatDayRangeLabel(startDay: number, endDay: number): string {
  const startLabel = WEEKDAY_OPTIONS[startDay]?.short ?? '';
  const endLabel = WEEKDAY_OPTIONS[endDay]?.short ?? '';

  return startDay === endDay ? startLabel : `${startLabel}–${endLabel}`;
}

/** Group consecutive days that share the same time into ranges. */
function formatSlotGroups(slots: AvailabilityDaySlot[]): string {
  const sorted = [...slots].sort((left, right) => left.day - right.day);

  if (sorted.length === 0) {
    return '';
  }

  const groups: string[] = [];
  let rangeStart = sorted[0];
  let previous = sorted[0];

  const flush = () => {
    const dayLabel = formatDayRangeLabel(rangeStart.day, previous.day);
    const timePart = formatTimePart(rangeStart.timeFrom, rangeStart.timeTo);
    groups.push([dayLabel, timePart].filter(Boolean).join(' ').trim());
  };

  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index];
    const sameTime = timeKey(current) === timeKey(rangeStart);
    const consecutive = current.day === previous.day + 1;

    if (sameTime && consecutive) {
      previous = current;
      continue;
    }

    flush();
    rangeStart = current;
    previous = current;
  }

  flush();

  return groups.join(', ');
}

export function getAvailabilityDays(schedule: QuestionnaireAvailability): number[] {
  return schedule.slots.map((slot) => slot.day).sort((left, right) => left - right);
}

export function formatAvailability(
  schedule: QuestionnaireAvailability,
  options?: { includeTime?: boolean },
): string {
  if (schedule.byAgreement) {
    return 'По договорённости';
  }

  const includeTime = options?.includeTime ?? true;
  const slots = includeTime
    ? schedule.slots.map((slot) => ({
        ...slot,
        timeFrom: completeAvailabilityTime(slot.timeFrom),
        timeTo: completeAvailabilityTime(slot.timeTo),
      }))
    : schedule.slots.map((slot) => ({ ...slot, timeFrom: '', timeTo: '' }));

  return formatSlotGroups(slots);
}

function expandDayToken(token: string): number[] {
  const normalized = token.trim().toUpperCase().replace(/-/g, '–');

  if (!normalized.includes('–')) {
    const dayIndex = DAY_SHORT_TO_INDEX[normalized];

    return dayIndex === undefined ? [] : [dayIndex];
  }

  const [startToken, endToken] = normalized.split('–');
  const startIndex = DAY_SHORT_TO_INDEX[startToken.trim()];
  const endIndex = DAY_SHORT_TO_INDEX[endToken.trim()];

  if (startIndex === undefined || endIndex === undefined || endIndex < startIndex) {
    return [];
  }

  return Array.from({ length: endIndex - startIndex + 1 }, (_, offset) => startIndex + offset);
}

function parseTimeSuffix(segment: string): {
  dayPart: string;
  timeFrom: string;
  timeTo: string;
} {
  const trimmed = segment.trim();
  let dayPart = trimmed;
  let timeFrom = '';
  let timeTo = '';

  const rangeTimeMatch = trimmed.match(/(\d{1,2}:\d{2})[–-](\d{1,2}:\d{2})$/);
  if (rangeTimeMatch) {
    timeFrom = normalizeTime(rangeTimeMatch[1]);
    timeTo = normalizeTime(rangeTimeMatch[2]);
    dayPart = trimmed.slice(0, rangeTimeMatch.index).trim();
    return { dayPart, timeFrom, timeTo };
  }

  const fromTimeMatch = trimmed.match(/(?:^|\s)с\s*(\d{1,2}:\d{2})$/i);
  if (fromTimeMatch) {
    timeFrom = normalizeTime(fromTimeMatch[1]);
    dayPart = trimmed.slice(0, fromTimeMatch.index).trim();
    return { dayPart, timeFrom, timeTo };
  }

  const toTimeMatch = trimmed.match(/(?:^|\s)до\s*(\d{1,2}:\d{2})$/i);
  if (toTimeMatch) {
    timeTo = normalizeTime(toTimeMatch[1]);
    dayPart = trimmed.slice(0, toTimeMatch.index).trim();
  }

  return { dayPart, timeFrom, timeTo };
}

export function parseAvailability(value: string | null | undefined): QuestionnaireAvailability {
  const trimmed = value?.trim() ?? '';

  if (!trimmed) {
    return { ...EMPTY_QUESTIONNAIRE_AVAILABILITY, slots: [] };
  }

  if (/^по договор/i.test(trimmed)) {
    return {
      byAgreement: true,
      slots: [],
    };
  }

  // Supports:
  // - legacy: "ПН–СР 20:00–23:00"
  // - per-day: "ПН 19:00–22:00, СР 20:00–23:00, ПТ–ВС 18:00–00:00"
  const segments = trimmed.split(',').map((part) => part.trim()).filter(Boolean);
  const slotsByDay = new Map<number, AvailabilityDaySlot>();

  for (const segment of segments) {
    const { dayPart, timeFrom, timeTo } = parseTimeSuffix(segment);
    const days = dayPart
      .split(/\s+/)
      .flatMap((token) => expandDayToken(token))
      .filter((day, index, array) => array.indexOf(day) === index);

    for (const day of days) {
      slotsByDay.set(day, { day, timeFrom, timeTo });
    }
  }

  return {
    byAgreement: false,
    slots: [...slotsByDay.values()].sort((left, right) => left.day - right.day),
  };
}

export function areAvailabilitiesEqual(
  left: QuestionnaireAvailability,
  right: QuestionnaireAvailability,
): boolean {
  if (left.byAgreement !== right.byAgreement) {
    return false;
  }

  if (left.slots.length !== right.slots.length) {
    return false;
  }

  const leftSorted = [...left.slots].sort((a, b) => a.day - b.day);
  const rightSorted = [...right.slots].sort((a, b) => a.day - b.day);

  return leftSorted.every((slot, index) => {
    const other = rightSorted[index];
    return (
      slot.day === other.day &&
      slot.timeFrom === other.timeFrom &&
      slot.timeTo === other.timeTo
    );
  });
}

export function toggleAvailabilityDay(
  schedule: QuestionnaireAvailability,
  dayIndex: number,
): QuestionnaireAvailability {
  const hasDay = schedule.slots.some((slot) => slot.day === dayIndex);
  const slots = hasDay
    ? schedule.slots.filter((slot) => slot.day !== dayIndex)
    : [...schedule.slots, { day: dayIndex, timeFrom: '', timeTo: '' }].sort(
        (left, right) => left.day - right.day,
      );

  return {
    ...schedule,
    byAgreement: false,
    slots,
  };
}

export function updateAvailabilityDayTime(
  schedule: QuestionnaireAvailability,
  dayIndex: number,
  patch: Partial<Pick<AvailabilityDaySlot, 'timeFrom' | 'timeTo'>>,
): QuestionnaireAvailability {
  return {
    ...schedule,
    byAgreement: false,
    slots: schedule.slots.map((slot) =>
      slot.day === dayIndex
        ? {
            ...slot,
            ...patch,
          }
        : slot,
    ),
  };
}

export function applyAvailabilityTimeToAll(
  schedule: QuestionnaireAvailability,
): QuestionnaireAvailability {
  const source = schedule.slots.find(
    (slot) => slot.timeFrom.trim() !== '' || slot.timeTo.trim() !== '',
  );

  if (!source) {
    return schedule;
  }

  const timeFrom = completeAvailabilityTime(source.timeFrom) || source.timeFrom;
  const timeTo = completeAvailabilityTime(source.timeTo) || source.timeTo;

  return {
    ...schedule,
    byAgreement: false,
    slots: schedule.slots.map((slot) => ({
      ...slot,
      timeFrom,
      timeTo,
    })),
  };
}

export function stripAvailabilityTimes(
  schedule: QuestionnaireAvailability,
): QuestionnaireAvailability {
  return {
    ...schedule,
    slots: schedule.slots.map((slot) => ({
      ...slot,
      timeFrom: '',
      timeTo: '',
    })),
  };
}
