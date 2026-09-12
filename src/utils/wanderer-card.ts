import type { UserCardProps } from '@/components/ui/cards/UserCard';
import { pickProfileCardUrl } from '@/services/profile/profileApi';
import type { WandererCardItem } from '@/services/profile/wanderersApi';
import { DEFAULT_TIMEZONE } from '@/utils/timezones';
import { formatUserCardVisibility } from '@/utils/user-card-format';

export function wandererCardToUserCardProps(item: WandererCardItem): UserCardProps {
  const visibility = formatUserCardVisibility(true);
  const city = item.location?.trim() || null;
  const tagline = item.tagline?.trim() || '—';
  const description = item.description?.trim() ?? '';
  const about = item.about?.trim() ?? '';
  const bio = description || (about && about !== tagline ? about : '') || '—';

  return {
    name: item.nickname,
    age: item.age,
    tagline,
    roles: item.roles.length > 0 ? item.roles : ['Игрок'],
    avatarUrl: pickProfileCardUrl(item.profileCard) ?? undefined,
    playInfo: {
      playsOnline: item.playsOnline,
      location: city,
      systems: [...item.systems],
      readyToLearnNew: item.readyToLearnNew,
      openToAnySystem: item.openToAnySystem ?? false,
      experience: item.experienceLabel?.trim() || 'Не указано',
      schedule: item.availability?.trim() || 'Не указано',
      timezone: item.timezone?.trim() || DEFAULT_TIMEZONE,
    },
    bio,
    visibility: visibility.label,
    visibilityVariant: visibility.variant,
    blockedByMe: Boolean(item.blockedByMe),
  };
}
