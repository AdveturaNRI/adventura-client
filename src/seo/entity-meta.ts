import type { ClubListItem } from '@/services/clubs/clubsApi';
import type { GameListItem } from '@/services/games/gamesApi';
import { withBrand } from '@/seo/site';

const DESCRIPTION_MAX = 200;

/** Covers are not used as og:image: storage links are signed and expire in an hour. */
type EntitySeo = { title: string; description: string };

const HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  laquo: '«',
  raquo: '»',
  mdash: '—',
  ndash: '–',
  hellip: '…',
};

/** User text may contain markup or entities; Helmet escapes the result itself. */
export function plainText(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
      if (code[0] === '#') {
        const point = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
        return Number.isFinite(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : ' ';
      }
      return HTML_ENTITIES[code.toLowerCase()] ?? entity;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

/** Cuts at the last word boundary that fits, never inside a word. */
export function clipWords(text: string, max = DESCRIPTION_MAX): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const boundary = cut.lastIndexOf(' ');
  if (boundary <= 0) return '';
  return `${cut.slice(0, boundary).replace(/[\s,.;:!?—–-]+$/, '')}…`;
}

function sentence(text: string): string {
  return /[.!?…]$/.test(text) ? text : `${text}.`;
}

/** Facts first, then as much of the free text as fits. */
function composeDescription(facts: string[], freeText: string): string {
  const head = facts.map(sentence).join(' ');
  const room = DESCRIPTION_MAX - head.length - 1;
  const tail = freeText && room > 20 ? clipWords(freeText, room) : '';
  return [head, tail].filter(Boolean).join(' ');
}

function filled(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Prepositional case for single-word city names ("в Екатеринбурге").
 * Null when the rule is not reliable (several words, fleeting vowels, plurals).
 */
export function cityPrepositional(name: string): string | null {
  if (!/^[А-ЯЁ][а-яё]+(-[А-ЯЁ][а-яё]+)*$/.test(name)) return null;
  if (/(ец|ок|ёл|ел|ий|ый|ой|ая|ое|ые|ы|и|о|е|у|ю|э)$/.test(name)) return null;
  if (/ия$/.test(name)) return `${name.slice(0, -1)}и`;
  if (/[ая]$/.test(name)) return `${name.slice(0, -1)}е`;
  if (/ль$/.test(name)) return `${name.slice(0, -1)}е`;
  if (/ь$/.test(name)) return `${name.slice(0, -1)}и`;
  if (/[бвгдзклмнпрстфхцчшщж]$/.test(name)) return `${name}е`;
  return null;
}

/** "в Екатеринбурге" or ", Екатеринбург" when the city can't be declined safely. */
function inCity(city: string, prefix: string): string {
  const declined = cityPrepositional(city);
  return declined ? `${prefix} в ${declined}` : `${prefix}, ${city}`;
}

/**
 * Removes the city already named in the text: a trailing ", Москва"
 * or a leading "Россия, область, Город," prefix.
 */
export function addressWithoutCity(address: string, city: string): string {
  if (!city) return address;
  const parts = address.split(',').map((part) => part.trim());
  const escaped = city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const cityPattern = new RegExp(`^(г\\.?\\s*|город\\s+)?${escaped}$`, 'i');
  const index = parts.findIndex((part) => cityPattern.test(part));
  if (index < 0) return address;
  const rest = index === parts.length - 1 ? parts.slice(0, index) : parts.slice(index + 1);
  return rest.filter(Boolean).join(', ');
}

export function gameSeo(game: GameListItem): EntitySeo | null {
  const title = filled(game.title);
  const system = filled(game.systemName);
  const city = filled(game.city?.name);
  const kind = game.kind === 'CAMPAIGN' ? 'Кампания' : game.kind === 'ONESHOT' ? 'Ваншот' : '';
  const format = [kind, system ? (kind ? `по ${system}` : system) : ''].filter(Boolean).join(' ');
  if (!title && !format) return null;

  const placeShort = game.isOnline ? 'онлайн' : city;
  const placeFact = game.isOnline ? 'Онлайн' : city ? `Вживую, ${city}` : 'Вживую';

  const price =
    game.isFree === true
      ? 'Бесплатно'
      : typeof game.priceRub === 'number' && game.priceRub > 0
        ? `Стоимость: ${game.priceRub.toLocaleString('ru-RU')} ₽`
        : '';

  const seatsLeft =
    game.status === 'RECRUITING' &&
    Number.isFinite(game.maxPlayers) &&
    Number.isFinite(game.playersCount)
      ? game.maxPlayers - game.playersCount
      : null;
  const seats = seatsLeft != null && seatsLeft > 0 ? `Свободных мест: ${seatsLeft}` : '';

  const facts = [
    format,
    placeFact,
    price,
    seats,
    game.beginnersWelcome === true ? 'Новичков берут' : '',
  ].filter(Boolean);

  const headline = title || format;
  const systemInHeadline = system && headline.toLowerCase().includes(system.toLowerCase());
  const titleTail = [systemInHeadline ? '' : system, placeShort].filter(Boolean).join(', ');

  return {
    title: withBrand(titleTail ? `${headline} — ${titleTail}` : headline),
    description: composeDescription(facts, plainText(game.description)),
  };
}

export function clubSeo(club: ClubListItem): EntitySeo | null {
  const name = filled(club.name);
  const city = filled(club.city?.name);
  if (!name) return null;

  const address = addressWithoutCity(filled(club.address), city);
  const tables =
    typeof club.tablesCount === 'number' && club.tablesCount > 0 ? club.tablesCount : null;

  const facts = [
    city ? inCity(city, 'Клуб настольно-ролевых игр') : 'Клуб настольно-ролевых игр',
    address ? `Адрес: ${address}` : '',
    tables ? `Игровых столов: ${tables}` : '',
  ].filter(Boolean);

  return {
    title: withBrand(city ? inCity(city, `${name} — клуб НРИ`) : `${name} — клуб НРИ`),
    description: composeDescription(facts, plainText(club.description)),
  };
}
