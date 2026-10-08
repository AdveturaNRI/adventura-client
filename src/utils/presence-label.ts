/** Labels for last-seen / online status (chats, wanderer cards). */

const LOCALE = 'ru-RU';

type FormatPresenceOptions = {
  /** IANA zone; default — локальная зона устройства. */
  timeZone?: string;
  /** Не показывать статус, если lastSeen старше N суток (для ленты). */
  hideAfterDays?: number;
};

function withZone(timeZone?: string): { timeZone?: string } {
  return timeZone ? { timeZone } : {};
}

function formatClock(date: Date, timeZone?: string): string {
  return date.toLocaleTimeString(LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...withZone(timeZone),
  });
}

/** «28 сент.» без хвостовой запятой от Intl. */
function formatDayMonth(date: Date, timeZone?: string): string {
  return date
    .toLocaleDateString(LOCALE, {
      day: 'numeric',
      month: 'short',
      ...withZone(timeZone),
    })
    .replace(/\u00a0/g, ' ')
    .replace(/,/g, '')
    .trim();
}

function calendarDayKey(date: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...withZone(timeZone),
  }).format(date);
}

/** Сколько календарных суток между двумя моментами в одной зоне (0 = тот же день). */
function calendarDaysBetween(earlier: Date, later: Date, timeZone?: string): number {
  const [ey, em, ed] = calendarDayKey(earlier, timeZone).split('-').map(Number);
  const [ly, lm, ld] = calendarDayKey(later, timeZone).split('-').map(Number);
  const earlierUtc = Date.UTC(ey, em - 1, ed);
  const laterUtc = Date.UTC(ly, lm - 1, ld);
  return Math.round((laterUtc - earlierUtc) / 86_400_000);
}

export function formatPresenceLabel(
  online: boolean,
  lastSeenAt: string | null | undefined,
  options?: FormatPresenceOptions,
): string | null {
  if (online) {
    return 'в сети';
  }

  const hideAfterDays = options?.hideAfterDays;

  if (!lastSeenAt) {
    return hideAfterDays != null ? null : 'давно не в сети';
  }

  const date = new Date(lastSeenAt);
  if (Number.isNaN(date.getTime())) {
    return hideAfterDays != null ? null : 'давно не в сети';
  }

  const timeZone = options?.timeZone;
  const now = Date.now();
  const nowDate = new Date(now);
  const diffMs = Math.max(0, now - date.getTime());
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = diffMs / 86_400_000;

  if (hideAfterDays != null && diffDays > hideAfterDays) {
    return null;
  }

  if (diffMin < 1) {
    return 'был только что';
  }

  if (diffMin < 60) {
    return `был ${diffMin} мин. назад`;
  }

  const time = formatClock(date, timeZone);
  const dayDiff = calendarDaysBetween(date, nowDate, timeZone);

  if (dayDiff === 0) {
    if (diffHours < 4) {
      return `был ${diffHours} ч. назад`;
    }
    return `был сегодня в ${time}`;
  }

  if (dayDiff === 1) {
    return `был вчера в ${time}`;
  }

  if (dayDiff < 7) {
    const weekday = date
      .toLocaleDateString(LOCALE, {
        weekday: 'short',
        ...withZone(timeZone),
      })
      .replace(/\./g, '')
      .trim();
    return `был ${weekday} в ${time}`;
  }

  const sameYear =
    calendarDayKey(date, timeZone).slice(0, 4) === calendarDayKey(nowDate, timeZone).slice(0, 4);

  if (sameYear) {
    return `был ${formatDayMonth(date, timeZone)} в ${time}`;
  }

  const fullDate = date
    .toLocaleDateString(LOCALE, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      ...withZone(timeZone),
    })
    .replace(/\u00a0/g, ' ')
    .replace(/,/g, '')
    .trim();

  return `был ${fullDate}`;
}
