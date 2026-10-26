import type { ClubListItem } from '@/services/clubs/clubsApi';
import type { GameListItem } from '@/services/games/gamesApi';
import { SITE_NAME } from '@/seo/site';

const DESCRIPTION_MAX = 200;

/** Descriptions may come from the rich-text editor. */
function plainText(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function clip(text: string, max = DESCRIPTION_MAX): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max / 2))}…`;
}

export function gameSeo(game: GameListItem): { title: string; description: string } {
  const place = game.isOnline ? 'онлайн' : game.city?.name ?? 'вживую';
  const kind = game.kind === 'ONESHOT' ? 'Ваншот' : 'Кампания';
  const price = game.isFree ? 'бесплатно' : game.priceRub ? `${game.priceRub} ₽ за сессию` : null;
  const seatsLeft = Math.max(game.maxPlayers - game.playersCount, 0);
  const facts = [
    `${kind} по ${game.systemName}, ${place}`,
    price,
    game.status === 'RECRUITING' && seatsLeft > 0 ? `свободных мест: ${seatsLeft}` : null,
    game.beginnersWelcome ? 'новичков берут' : null,
  ].filter(Boolean);

  return {
    title: `${game.title} — ${game.systemName}, ${place} — ${SITE_NAME}`,
    description: clip([`${facts.join(', ')}.`, plainText(game.description)].join(' ').trim()),
  };
}

export function clubSeo(club: ClubListItem): { title: string; description: string } {
  const where = club.city?.name ? `, ${club.city.name}` : '';
  const facts = [
    `Клуб настольных ролевых игр${where}: ${club.address}`,
    club.tablesCount ? `столов: ${club.tablesCount}` : null,
  ].filter(Boolean);

  return {
    title: `${club.name} — клуб НРИ${where} — ${SITE_NAME}`,
    description: clip([`${facts.join(', ')}.`, plainText(club.description)].join(' ').trim()),
  };
}
