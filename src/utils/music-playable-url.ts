import { Platform } from 'react-native';

import { API_BASE_URL } from '@/constants/api.config';
import { refreshAuthTokens } from '@/services/auth/token-refresh';
import { getStoredToken } from '@/utils/auth-storage';

/** Original playUrl → blob: URL (same-origin for Safari GainNode). */
const blobCache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

function canUseBlobPlayback() {
  return Platform.OS === 'web' && typeof window !== 'undefined' && typeof fetch === 'function';
}

async function fetchDirectBlob(playUrl: string): Promise<Blob> {
  const response = await fetch(playUrl, {
    mode: 'cors',
    credentials: 'omit',
    cache: 'force-cache',
  });
  if (!response.ok) {
    throw new Error(`direct ${response.status}`);
  }
  return response.blob();
}

async function fetchProxiedBlob(playUrl: string): Promise<Blob> {
  const token = await getStoredToken();
  if (!token) {
    throw new Error('no auth');
  }
  const url = `${API_BASE_URL}/music/playback?u=${encodeURIComponent(playUrl)}`;
  const headers: Record<string, string> = {
    Accept: 'audio/*,*/*',
    Authorization: `Bearer ${token}`,
  };
  let response = await fetch(url, { headers, credentials: 'include' });
  if (response.status === 401) {
    const refreshed = await refreshAuthTokens();
    if (!refreshed) {
      throw new Error('auth');
    }
    const nextToken = await getStoredToken();
    if (!nextToken) {
      throw new Error('auth');
    }
    headers.Authorization = `Bearer ${nextToken}`;
    response = await fetch(url, { headers, credentials: 'include' });
  }
  if (!response.ok) {
    throw new Error(`proxy ${response.status}`);
  }
  return response.blob();
}

/**
 * Resolve a remote music URL to a same-origin blob: URL so Safari can use
 * WebAudio GainNode for volume (HTMLMediaElement.volume is ignored on iOS).
 * Falls back to the original URL if both direct CORS fetch and API proxy fail.
 */
export async function resolvePlayableMusicUrl(playUrl: string): Promise<string> {
  const trimmed = playUrl.trim();
  if (!trimmed || !canUseBlobPlayback()) {
    return trimmed;
  }
  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) {
    return trimmed;
  }

  const cached = blobCache.get(trimmed);
  if (cached) {
    return cached;
  }

  const pending = inflight.get(trimmed);
  if (pending) {
    return pending;
  }

  const task = (async () => {
    let blob: Blob | null = null;
    try {
      blob = await fetchDirectBlob(trimmed);
    } catch {
      try {
        blob = await fetchProxiedBlob(trimmed);
      } catch {
        blob = null;
      }
    }
    if (!blob || blob.size < 64) {
      return trimmed;
    }
    const objectUrl = URL.createObjectURL(blob);
    blobCache.set(trimmed, objectUrl);
    return objectUrl;
  })();

  inflight.set(trimmed, task);
  try {
    return await task;
  } finally {
    inflight.delete(trimmed);
  }
}

export function revokePlayableMusicUrl(playUrl: string | null | undefined) {
  const key = playUrl?.trim();
  if (!key) {
    return;
  }
  const blobUrl = blobCache.get(key);
  if (!blobUrl) {
    return;
  }
  blobCache.delete(key);
  try {
    URL.revokeObjectURL(blobUrl);
  } catch {
    // ignore
  }
}

export function clearPlayableMusicUrlCache() {
  for (const blobUrl of blobCache.values()) {
    try {
      URL.revokeObjectURL(blobUrl);
    } catch {
      // ignore
    }
  }
  blobCache.clear();
  inflight.clear();
}
