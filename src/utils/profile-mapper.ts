import type { UserProfile } from '@/services/api/types';
import { pickAvatarUrl } from '@/services/profile/profileApi';

export function getProfileAvatarUrl(profile: UserProfile | null): string | null {
  if (!profile) {
    return null;
  }

  return pickAvatarUrl(profile.avatar, profile.updatedAt);
}
