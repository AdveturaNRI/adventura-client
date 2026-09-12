import { Platform } from 'react-native';

import { apiMultipart, apiRequest, apiUpload } from '@/services/api/client';

export type ClubScheduleDay = {
  day: number;
  closed: boolean;
  open: string | null;
  close: string | null;
};

export type ClubListItem = {
  id: string;
  name: string;
  description: string | null;
  address: string;
  lat: number;
  lng: number;
  city: { id: string; name: string; region: string | null } | null;
  schedule: ClubScheduleDay[];
  isPublished: boolean;
  coverUrl: string | null;
  /** Своя иконка на карте — появится с кастомизацией клуба */
  mapIconUrl?: string | null;
  /** Акцент метки — появится с кастомизацией клуба */
  mapAccentColor?: string | null;
  galleryUrls: string[];
  isOwner: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateClubPayload = {
  name: string;
  description?: string | null;
  address: string;
  lat: number;
  lng: number;
  cityId?: string | null;
  schedule: ClubScheduleDay[];
  isPublished?: boolean;
};

export type GeocodeResult = {
  lat: number;
  lng: number;
  displayName: string;
  shortName?: string;
};

export const DAY_LABELS: Record<number, string> = {
  1: 'Пн',
  2: 'Вт',
  3: 'Ср',
  4: 'Чт',
  5: 'Пт',
  6: 'Сб',
  7: 'Вс',
};

export function defaultClubSchedule(): ClubScheduleDay[] {
  return [1, 2, 3, 4, 5, 6, 7].map((day) => ({
    day,
    closed: day >= 6,
    open: day >= 6 ? null : '12:00',
    close: day >= 6 ? null : '22:00',
  }));
}

export async function listClubsMap() {
  return apiRequest<ClubListItem[]>('/clubs');
}

export async function listMyClubs() {
  return apiRequest<ClubListItem[]>('/clubs/me');
}

export async function getClub(id: string) {
  return apiRequest<ClubListItem>(`/clubs/${encodeURIComponent(id)}`);
}

export async function createClub(payload: CreateClubPayload) {
  return apiRequest<ClubListItem>('/clubs', {
    method: 'POST',
    body: payload,
  });
}

export async function updateClub(id: string, payload: CreateClubPayload) {
  return apiRequest<ClubListItem>(`/clubs/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: payload,
  });
}

export async function deleteClub(id: string) {
  return apiRequest<{ ok: true }>(`/clubs/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function geocodeAddress(q: string) {
  const params = new URLSearchParams({ q });
  return apiRequest<GeocodeResult>(`/clubs/geocode?${params.toString()}`, {
    skipLoading: true,
  });
}

export async function reverseGeocode(lat: number, lng: number) {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
  });
  return apiRequest<GeocodeResult>(`/clubs/geocode/reverse?${params.toString()}`, {
    skipLoading: true,
  });
}

export async function suggestAddresses(
  q: string,
  city?: string,
  kind: 'address' | 'city' = 'address',
) {
  const params = new URLSearchParams({ q, kind });
  if (city?.trim()) {
    params.set('city', city.trim());
  }
  return apiRequest<GeocodeResult[]>(`/clubs/geocode/suggest?${params.toString()}`, {
    skipLoading: true,
  });
}

export async function suggestCities(q: string) {
  return suggestAddresses(q, undefined, 'city');
}

/** Координаты для города из справочника (камера карты) — через DaData. */
export async function geocodeCityLabel(label: string): Promise<GeocodeResult> {
  const name = label.split(',')[0]?.trim() || label.trim();
  if (!name) {
    throw new Error('Пустое название города');
  }

  const needle = name.toLowerCase().replace(/ё/g, 'е');

  const suggestions = await suggestCities(name);
  const match =
    suggestions.find((item) => {
      const short = (item.shortName || item.displayName).split(',')[0]?.trim() ?? '';
      const bare = short
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/^(г\.?|город|пгт\.?|пос[её]лок|село)\s+/i, '')
        .trim();
      return bare === needle || bare.startsWith(needle) || needle.startsWith(bare);
    }) ?? null;

  if (match && isValidLatLng(Number(match.lat), Number(match.lng))) {
    return {
      lat: Number(match.lat),
      lng: Number(match.lng),
      displayName: label,
      shortName: label,
    };
  }

  // Фоллбек: DaData clean на бэке
  const hit = await geocodeAddress(label);
  const lat = Number(hit.lat);
  const lng = Number(hit.lng);
  if (!isValidLatLng(lat, lng)) {
    throw new Error('Некорректные координаты города');
  }

  return {
    lat,
    lng,
    displayName: label,
    shortName: label,
  };
}

export function isValidLatLng(lat: number, lng: number): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

export async function uploadClubCover(clubId: string, localUri: string) {
  return apiUpload<ClubListItem>(
    `/clubs/${encodeURIComponent(clubId)}/cover`,
    'cover',
    localUri,
  );
}

export async function uploadClubGallery(clubId: string, localUris: string[]) {
  const formData = new FormData();

  for (const [index, uri] of localUris.entries()) {
    const fileName = uri.split('/').pop() || `gallery-${index}.jpg`;
    const lower = fileName.toLowerCase();
    const mimeType = lower.endsWith('.png')
      ? 'image/png'
      : lower.endsWith('.webp')
        ? 'image/webp'
        : 'image/jpeg';

    if (Platform.OS === 'web') {
      const response = await fetch(uri);
      const blob = await response.blob();
      formData.append('gallery', blob, fileName);
    } else {
      formData.append(
        'gallery',
        {
          uri,
          name: fileName,
          type: mimeType,
        } as unknown as Blob,
      );
    }
  }

  return apiMultipart<ClubListItem>(
    `/clubs/${encodeURIComponent(clubId)}/gallery`,
    formData,
  );
}
