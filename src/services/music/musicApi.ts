import { Platform } from 'react-native';

import { API_BASE_URL } from '@/constants/api.config';
import { ApiError } from '@/services/api/api-error';
import { apiRequest } from '@/services/api/client';
import { refreshAuthTokens } from '@/services/auth/token-refresh';
import { getStoredToken } from '@/utils/auth-storage';
import { localizeErrorMessage } from '@/utils/localizeError';

export type MusicTrack = {
  id: string;
  title: string;
  originalName: string | null;
  mimeType: string;
  sizeBytes: number;
  durationSec: number | null;
  source?: 'upload' | 'external';
  url: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MusicPlaylistSummary = {
  id: string;
  title: string;
  sortOrder: number;
  trackCount: number;
  createdAt: string;
  updatedAt: string;
};

export type MusicPlaylistDetail = MusicPlaylistSummary & {
  tracks: MusicTrack[];
};

export type MusicQuota = {
  usedBytes: number;
  limitBytes: number;
  remainingBytes: number;
  trackCount: number;
};

export function listMusicTracks() {
  return apiRequest<MusicTrack[] | { tracks: MusicTrack[]; quota: MusicQuota }>(
    '/music/tracks',
  ).then((payload) => {
    if (Array.isArray(payload)) {
      return { tracks: payload, quota: null as MusicQuota | null };
    }
    return { tracks: payload.tracks, quota: payload.quota };
  });
}

export function getMusicTrack(trackId: string) {
  return apiRequest<MusicTrack>(`/music/tracks/${trackId}`);
}

/** Свежие signed URL для очереди — перед длинной сессией / сменой трека. */
export function refreshMusicTrackUrls(trackIds: string[]) {
  return apiRequest<{ id: string; url: string | null }[]>('/music/tracks/urls', {
    method: 'POST',
    body: { trackIds },
  });
}

export function fetchMusicQuota() {
  return apiRequest<MusicQuota>('/music/quota');
}

export function quotaFromTracks(tracks: MusicTrack[]): MusicQuota {
  const usedBytes = tracks.reduce((sum, track) => {
    if (track.source === 'external') return sum;
    return sum + track.sizeBytes;
  }, 0);
  return {
    usedBytes,
    limitBytes: 300 * 1024 * 1024,
    remainingBytes: Math.max(0, 300 * 1024 * 1024 - usedBytes),
    trackCount: tracks.length,
  };
}

async function buildMusicFormData(
  localUri: string,
  options?: { fileName?: string; mimeType?: string; title?: string },
) {
  const formData = new FormData();
  const fileName = options?.fileName ?? 'track.mp3';
  const mimeType = options?.mimeType ?? 'audio/mpeg';

  if (Platform.OS === 'web') {
    const response = await fetch(localUri);
    const blob = await response.blob();
    formData.append('file', blob, fileName);
  } else {
    formData.append('file', {
      uri: localUri,
      name: fileName,
      type: mimeType,
    } as unknown as Blob);
  }

  if (options?.title?.trim()) {
    formData.append('title', options.title.trim());
  }

  return formData;
}

function parseUploadError(status: number, text: string): ApiError {
  let message = 'Не удалось загрузить трек';
  if (text) {
    try {
      const body = JSON.parse(text) as { message?: string | string[] };
      if (Array.isArray(body.message) && body.message[0]) {
        message = body.message[0];
      } else if (typeof body.message === 'string' && body.message) {
        message = body.message;
      }
    } catch {
      // keep fallback
    }
  }
  return new ApiError(message, status);
}

function uploadFormDataWithProgress<T>(
  path: string,
  formData: FormData,
  options: {
    token: string | null;
    onProgress?: (percent: number) => void;
  },
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}${path}`);
    xhr.responseType = 'text';
    xhr.setRequestHeader('Accept', 'application/json');
    if (options.token) {
      xhr.setRequestHeader('Authorization', `Bearer ${options.token}`);
    }

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total <= 0) return;
      const percent = Math.max(
        0,
        Math.min(100, Math.round((event.loaded / event.total) * 100)),
      );
      options.onProgress?.(percent);
    };

    xhr.onload = () => {
      const text = xhr.responseText ?? '';
      if (xhr.status >= 200 && xhr.status < 300) {
        options.onProgress?.(100);
        if (!text) {
          reject(new ApiError('Сервер вернул пустой ответ', xhr.status));
          return;
        }
        try {
          resolve(JSON.parse(text) as T);
        } catch {
          reject(new ApiError('Сервер вернул некорректный ответ', xhr.status));
        }
        return;
      }
      reject(parseUploadError(xhr.status, text));
    };

    xhr.onerror = () => {
      reject(
        new ApiError(
          localizeErrorMessage(
            null,
            'Не удалось подключиться к серверу. Проверьте, что API запущен.',
          ),
          0,
        ),
      );
    };

    xhr.onabort = () => {
      reject(new ApiError('Загрузка отменена', 0));
    };

    xhr.send(formData);
  });
}

export async function uploadMusicTrack(
  localUri: string,
  options?: {
    fileName?: string;
    mimeType?: string;
    title?: string;
    onProgress?: (percent: number) => void;
  },
) {
  const formData = await buildMusicFormData(localUri, options);
  const token = await getStoredToken();

  try {
    return await uploadFormDataWithProgress<MusicTrack>(
      '/music/tracks',
      formData,
      {
        token,
        onProgress: options?.onProgress,
      },
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      const refreshed = await refreshAuthTokens();
      if (refreshed) {
        const retryForm = await buildMusicFormData(localUri, options);
        return uploadFormDataWithProgress<MusicTrack>('/music/tracks', retryForm, {
          token: refreshed.accessToken,
          onProgress: options?.onProgress,
        });
      }
    }
    throw error;
  }
}

export function createMusicTrackFromUrl(url: string, title?: string) {
  return apiRequest<MusicTrack>('/music/tracks/external', {
    method: 'POST',
    body: {
      url,
      ...(title?.trim() ? { title: title.trim() } : {}),
    },
  });
}

export function updateMusicTrack(trackId: string, title: string) {
  return apiRequest<MusicTrack>(`/music/tracks/${trackId}`, {
    method: 'PATCH',
    body: { title },
  });
}

export function deleteMusicTrack(trackId: string) {
  return apiRequest<{ ok: true }>(`/music/tracks/${trackId}`, {
    method: 'DELETE',
  });
}

export function listMusicPlaylists() {
  return apiRequest<MusicPlaylistSummary[]>('/music/playlists');
}

export function createMusicPlaylist(title: string) {
  return apiRequest<MusicPlaylistDetail>('/music/playlists', {
    method: 'POST',
    body: { title },
  });
}

export function getMusicPlaylist(playlistId: string) {
  return apiRequest<MusicPlaylistDetail>(`/music/playlists/${playlistId}`);
}

export function updateMusicPlaylist(playlistId: string, title: string) {
  return apiRequest<MusicPlaylistDetail>(`/music/playlists/${playlistId}`, {
    method: 'PATCH',
    body: { title },
  });
}

export function deleteMusicPlaylist(playlistId: string) {
  return apiRequest<{ ok: true }>(`/music/playlists/${playlistId}`, {
    method: 'DELETE',
  });
}

export function addTrackToPlaylist(playlistId: string, trackId: string) {
  return apiRequest<MusicPlaylistDetail>(
    `/music/playlists/${playlistId}/tracks`,
    {
      method: 'POST',
      body: { trackId },
    },
  );
}

export function removeTrackFromPlaylist(playlistId: string, trackId: string) {
  return apiRequest<MusicPlaylistDetail>(
    `/music/playlists/${playlistId}/tracks/${trackId}`,
    {
      method: 'DELETE',
    },
  );
}

export function reorderPlaylistTracks(playlistId: string, trackIds: string[]) {
  return apiRequest<MusicPlaylistDetail>(
    `/music/playlists/${playlistId}/tracks`,
    {
      method: 'PUT',
      body: { trackIds },
    },
  );
}
