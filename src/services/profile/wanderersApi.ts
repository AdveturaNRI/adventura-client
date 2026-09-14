import { apiRequest } from '@/services/api/client';
import type { ImageUrls } from '@/services/api/types';

export type WandererCardItem = {
  id: string;
  nickname: string;
  age: number | null;
  tagline: string | null;
  roles: string[];
  availability: string | null;
  /** IANA timezone; older API responses may omit it. */
  timezone?: string;
  systems: string[];
  readyToLearnNew: boolean;
  openToAnySystem: boolean;
  about: string | null;
  description: string | null;
  location: string | null;
  cities?: string[];
  playsOnline: boolean;
  experienceLabel: string | null;
  profileCard: ImageUrls | null;
  blockedByMe?: boolean;
  isFavorite?: boolean;
};

export type WandererBucket = 'feed' | 'favorites' | 'skipped';
export type WandererReactionType = 'favorite' | 'skipped';

export type WandererBucketCounts = {
  favorites: number;
  skipped: number;
};

export function fetchWanderers(bucket: WandererBucket = 'feed') {
  const query = bucket === 'feed' ? '' : `?bucket=${bucket}`;
  return apiRequest<WandererCardItem[]>(`/users/wanderers${query}`);
}

export function fetchUserCard(userId: string) {
  return apiRequest<WandererCardItem>(
    `/users/${encodeURIComponent(userId)}/card`,
  );
}

export function fetchWandererBucketCounts() {
  return apiRequest<WandererBucketCounts>('/users/wanderers/counts');
}

export function upsertWandererReaction(targetUserId: string, type: WandererReactionType) {
  return apiRequest<{ targetUserId: string; type: WandererReactionType }>(
    `/users/wanderers/${encodeURIComponent(targetUserId)}/reaction`,
    {
      method: 'PUT',
      body: { type },
      skipLoading: true,
    },
  );
}

export function clearWandererReaction(targetUserId: string) {
  return apiRequest<void>(`/users/wanderers/${encodeURIComponent(targetUserId)}/reaction`, {
    method: 'DELETE',
    skipLoading: true,
  });
}
