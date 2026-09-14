import type { UserCardProps } from '@/components/ui/cards/UserCard';
import { formatAvailability } from '@/screens/questionnaire/availability';
import type { QuestionnaireDraft } from '@/screens/questionnaire/types';
import { roleChoiceToRoles } from '@/screens/questionnaire/types';
import { DEFAULT_TIMEZONE } from '@/utils/timezones';
import { formatUserCardVisibility } from '@/utils/user-card-format';

function parseAge(age: string): number | null {
  const trimmed = age.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);

  return Number.isFinite(parsed) ? parsed : null;
}

export function questionnaireDraftToUserCardProps(draft: QuestionnaireDraft): UserCardProps {
  const parsedAge = parseAge(draft.age);
  const visibility = formatUserCardVisibility(draft.isPublic);
  const roles = draft.role ? roleChoiceToRoles(draft.role) : ['Игрок'];
  const schedule = formatAvailability(draft.availability);
  const bio = draft.description.trim() || '—';
  const cities = draft.cities
    .map((city) => city.label.trim())
    .filter(Boolean);

  return {
    name: draft.nickname.trim() || 'Без имени',
    age: parsedAge,
    tagline: draft.status.trim() || '—',
    roles,
    avatarUrl: draft.profileCardUri ?? undefined,
    playInfo: {
      playsOnline: draft.playsOnline,
      locations: cities,
      systems: [...draft.systems],
      readyToLearnNew: draft.readyToLearnNew,
      openToAnySystem: draft.openToAnySystem,
      experience: draft.experienceTypeLabel.trim() || 'Не указано',
      schedule: schedule || 'Не указано',
      timezone: draft.timezone?.trim() || DEFAULT_TIMEZONE,
    },
    bio,
    visibility: visibility.label,
    visibilityVariant: visibility.variant,
  };
}
