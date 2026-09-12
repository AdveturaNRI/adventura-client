export const DEFAULT_TIMEZONE = 'Europe/Moscow';

export type TimezoneOption = {
  id: string;
  /** Общее название пояса, например «Московское время». */
  name: string;
  region: string;
  searchText: string;
};

type TimezoneEntry = {
  id: string;
  name: string;
  region: string;
  /** Доп. слова для поиска: города, сокращения. */
  aliases?: string[];
};

/** IANA id + общее название пояса. Offset считается в рантайме. */
const TIMEZONE_ENTRIES: TimezoneEntry[] = [
  // Россия
  {
    id: 'Europe/Kaliningrad',
    name: 'Калининградское время',
    region: 'Россия',
    aliases: ['Калининград', 'MSK-1'],
  },
  {
    id: 'Europe/Moscow',
    name: 'Московское время',
    region: 'Россия',
    aliases: ['Москва', 'МСК', 'MSK', 'Санкт-Петербург', 'Питер'],
  },
  {
    id: 'Europe/Simferopol',
    name: 'Крымское время',
    region: 'Россия',
    aliases: ['Симферополь', 'Крым', 'Севастополь'],
  },
  {
    id: 'Europe/Volgograd',
    name: 'Волгоградское время',
    region: 'Россия',
    aliases: ['Волгоград'],
  },
  {
    id: 'Europe/Samara',
    name: 'Самарское время',
    region: 'Россия',
    aliases: ['Самара', 'Ижевск'],
  },
  {
    id: 'Europe/Saratov',
    name: 'Саратовское время',
    region: 'Россия',
    aliases: ['Саратов'],
  },
  {
    id: 'Europe/Astrakhan',
    name: 'Астраханское время',
    region: 'Россия',
    aliases: ['Астрахань'],
  },
  {
    id: 'Europe/Ulyanovsk',
    name: 'Ульяновское время',
    region: 'Россия',
    aliases: ['Ульяновск'],
  },
  {
    id: 'Europe/Kirov',
    name: 'Кировское время',
    region: 'Россия',
    aliases: ['Киров'],
  },
  {
    id: 'Asia/Yekaterinburg',
    name: 'Екатеринбургское время',
    region: 'Россия',
    aliases: ['Екатеринбург', 'Урал', 'Пермь', 'Челябинск', 'Тюмень'],
  },
  {
    id: 'Asia/Omsk',
    name: 'Омское время',
    region: 'Россия',
    aliases: ['Омск'],
  },
  {
    id: 'Asia/Novosibirsk',
    name: 'Новосибирское время',
    region: 'Россия',
    aliases: ['Новосибирск'],
  },
  {
    id: 'Asia/Barnaul',
    name: 'Барнаульское время',
    region: 'Россия',
    aliases: ['Барнаул', 'Алтай'],
  },
  {
    id: 'Asia/Tomsk',
    name: 'Томское время',
    region: 'Россия',
    aliases: ['Томск'],
  },
  {
    id: 'Asia/Novokuznetsk',
    name: 'Кузбасское время',
    region: 'Россия',
    aliases: ['Новокузнецк', 'Кемерово', 'Кузбасс'],
  },
  {
    id: 'Asia/Krasnoyarsk',
    name: 'Красноярское время',
    region: 'Россия',
    aliases: ['Красноярск'],
  },
  {
    id: 'Asia/Irkutsk',
    name: 'Иркутское время',
    region: 'Россия',
    aliases: ['Иркутск', 'Байкал', 'Улан-Удэ'],
  },
  {
    id: 'Asia/Chita',
    name: 'Забайкальское время',
    region: 'Россия',
    aliases: ['Чита', 'Забайкалье'],
  },
  {
    id: 'Asia/Yakutsk',
    name: 'Якутское время',
    region: 'Россия',
    aliases: ['Якутск', 'Якутия'],
  },
  {
    id: 'Asia/Khandyga',
    name: 'Якутское время (Хандыга)',
    region: 'Россия',
    aliases: ['Хандыга'],
  },
  {
    id: 'Asia/Vladivostok',
    name: 'Владивостокское время',
    region: 'Россия',
    aliases: ['Владивосток', 'Хабаровск', 'Приморье'],
  },
  {
    id: 'Asia/Sakhalin',
    name: 'Сахалинское время',
    region: 'Россия',
    aliases: ['Сахалин', 'Южно-Сахалинск'],
  },
  {
    id: 'Asia/Ust-Nera',
    name: 'Якутское время (Усть-Нера)',
    region: 'Россия',
    aliases: ['Усть-Нера'],
  },
  {
    id: 'Asia/Magadan',
    name: 'Магаданское время',
    region: 'Россия',
    aliases: ['Магадан'],
  },
  {
    id: 'Asia/Srednekolymsk',
    name: 'Среднеколымское время',
    region: 'Россия',
    aliases: ['Среднеколымск'],
  },
  {
    id: 'Asia/Kamchatka',
    name: 'Камчатское время',
    region: 'Россия',
    aliases: ['Камчатка', 'Петропавловск-Камчатский'],
  },
  {
    id: 'Asia/Anadyr',
    name: 'Анадырское время',
    region: 'Россия',
    aliases: ['Анадырь', 'Чукотка'],
  },
  // Беларусь
  {
    id: 'Europe/Minsk',
    name: 'Минское время',
    region: 'Беларусь',
    aliases: ['Минск'],
  },
];

function formatUtcOffset(timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'shortOffset',
    }).formatToParts(new Date());
    const raw = parts.find((part) => part.type === 'timeZoneName')?.value ?? 'UTC';
    return raw.replace('GMT', 'UTC');
  } catch {
    return 'UTC';
  }
}

function offsetMinutes(timeZone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'longOffset',
    });
    const raw =
      formatter.formatToParts(new Date()).find((part) => part.type === 'timeZoneName')
        ?.value ?? '';
    const match = raw.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    if (!match) {
      return 0;
    }
    const sign = match[1] === '-' ? -1 : 1;
    const hours = Number(match[2]);
    const minutes = Number(match[3] ?? '0');
    return sign * (hours * 60 + minutes);
  } catch {
    return 0;
  }
}

let cachedOptions: TimezoneOption[] | null = null;

export function getTimezoneOptions(): TimezoneOption[] {
  if (cachedOptions) {
    return cachedOptions;
  }

  cachedOptions = TIMEZONE_ENTRIES.map((entry) => {
    const offset = formatUtcOffset(entry.id);
    const aliases = entry.aliases?.join(' ') ?? '';
    return {
      id: entry.id,
      name: entry.name,
      region: entry.region,
      searchText: `${entry.name} ${entry.region} ${aliases} ${entry.id} ${offset}`.toLowerCase(),
    };
  }).sort((a, b) => {
    const diff = offsetMinutes(a.id) - offsetMinutes(b.id);
    if (diff !== 0) {
      return diff;
    }
    return a.name.localeCompare(b.name, 'ru');
  });

  return cachedOptions;
}

export function formatTimezoneOffset(timeZone: string | null | undefined): string {
  return formatUtcOffset(timeZone?.trim() || DEFAULT_TIMEZONE);
}

export function formatTimezoneLabel(timeZone: string | null | undefined): string {
  const id = timeZone?.trim() || DEFAULT_TIMEZONE;
  const option = getTimezoneOptions().find((item) => item.id === id);
  const offset = formatUtcOffset(id);

  if (option) {
    return `${option.name} (${offset})`;
  }

  return `${id} (${offset})`;
}

export function formatTimezoneSubtitle(timeZone: string | null | undefined): string {
  const id = timeZone?.trim() || DEFAULT_TIMEZONE;
  const option = getTimezoneOptions().find((item) => item.id === id);
  if (option) {
    return option.region;
  }
  return id;
}

export function isKnownTimezone(timeZone: string | null | undefined): boolean {
  if (!timeZone?.trim()) {
    return false;
  }
  return getTimezoneOptions().some((item) => item.id === timeZone.trim());
}

export function searchTimezones(query: string): TimezoneOption[] {
  const options = getTimezoneOptions();
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return options;
  }
  return options.filter((item) => item.searchText.includes(normalized));
}

export type ZonedDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

export function getZonedDateTimeParts(
  isoOrDate: string | Date,
  timeZone: string = DEFAULT_TIMEZONE,
): ZonedDateTimeParts | null {
  const date = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timeZone.trim() || DEFAULT_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);

    const read = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value);

    return {
      year: read('year'),
      month: read('month'),
      day: read('day'),
      hour: read('hour'),
      minute: read('minute'),
    };
  } catch {
    return null;
  }
}

/** Интерпретирует «настенные» дату и время в указанном поясе как UTC ISO. */
export function wallTimeToUtcIso(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  const zone = timeZone.trim() || DEFAULT_TIMEZONE;
  let utcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const local = getZonedDateTimeParts(new Date(utcMs), zone);
    if (!local) {
      break;
    }
    const wanted = Date.UTC(year, month - 1, day, hour, minute);
    const got = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
    utcMs += wanted - got;
  }

  return new Date(utcMs).toISOString();
}

export function formatDateTimeInTimezone(
  iso: string | null | undefined,
  timeZone: string | null | undefined,
  options?: Intl.DateTimeFormatOptions,
): string | null {
  if (!iso) {
    return null;
  }

  try {
    return new Date(iso).toLocaleString('ru-RU', {
      timeZone: timeZone?.trim() || DEFAULT_TIMEZONE,
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      ...options,
    });
  } catch {
    return null;
  }
}
