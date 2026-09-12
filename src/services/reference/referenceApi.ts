import { apiRequest } from '@/services/api/client';
import type { CityReferenceItem } from '@/utils/city-label';
import type { GameSystemReferenceItem, ProfileCatalogItem } from '@/services/api/types';

export type UploadLimits = {
  maxUploadBytes: number;
  maxUploadSizeMb: number;
  fileTooLargeMessage: string;
};

export function fetchUploadLimits() {
  return apiRequest<UploadLimits>('/reference/upload-limits', {
    skipAuthRefresh: true,
    skipLoading: true,
  });
}

export function fetchExperienceTypes() {
  return apiRequest<ProfileCatalogItem[]>('/reference/experience-types', {
    skipLoading: true,
  });
}

export function fetchGameSystems() {
  return apiRequest<GameSystemReferenceItem[]>('/reference/game-systems', {
    skipLoading: true,
  });
}

type FetchCitiesParams = {
  q?: string;
  country?: string;
  limit?: number;
};

export function fetchCities({ q, country = 'RU,BY', limit = 20 }: FetchCitiesParams = {}) {
  const params = new URLSearchParams();

  if (q?.trim()) {
    params.set('q', q.trim());
  }

  if (country) {
    params.set('country', country);
  }

  if (limit) {
    params.set('limit', String(limit));
  }

  const query = params.toString();

  return apiRequest<CityReferenceItem[]>(`/reference/cities${query ? `?${query}` : ''}`, {
    skipLoading: true,
  });
}
