import { API_BASE_URL } from '@/constants/api.config';
import { ApiError } from '@/services/api/api-error';
import type { ApiErrorBody, AuthResponse } from '@/services/api/types';
import {
  clearAuthSession,
  getStoredRefreshToken,
  saveAuthSession,
} from '@/utils/auth-storage';
import { localizeErrorMessage } from '@/utils/localizeError';

function getErrorMessage(body: ApiErrorBody, fallback: string): string {
  if (Array.isArray(body.message)) {
    return body.message[0] ?? fallback;
  }

  if (typeof body.message === 'string' && body.message.length > 0) {
    return body.message;
  }

  return fallback;
}

async function refreshSession(refreshToken: string): Promise<AuthResponse> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });
  } catch (error) {
    throw new ApiError(
      localizeErrorMessage(error, 'Не удалось подключиться к серверу'),
      0,
    );
  }

  const text = await response.text();

  let payload: AuthResponse | ApiErrorBody | null = null;

  if (text) {
    try {
      payload = JSON.parse(text) as AuthResponse | ApiErrorBody;
    } catch {
      throw new ApiError('Сервер вернул некорректный ответ', response.status);
    }
  }

  if (!response.ok) {
    const errorBody = (payload ?? {}) as ApiErrorBody;
    throw new ApiError(
      getErrorMessage(errorBody, 'Не удалось обновить сессию'),
      response.status,
    );
  }

  return payload as AuthResponse;
}

let refreshPromise: Promise<AuthResponse | null> | null = null;

type AccessTokenListener = (accessToken: string) => void;
const accessTokenListeners = new Set<AccessTokenListener>();

/** Keep AuthContext / realtime socket in sync when HTTP refresh rotates the JWT. */
export function onAccessTokenRefreshed(listener: AccessTokenListener): () => void {
  accessTokenListeners.add(listener);
  return () => {
    accessTokenListeners.delete(listener);
  };
}

function notifyAccessTokenRefreshed(accessToken: string) {
  for (const listener of accessTokenListeners) {
    try {
      listener(accessToken);
    } catch {
      // listener errors must not break refresh
    }
  }
}

export async function refreshAuthTokens(): Promise<AuthResponse | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const refreshToken = await getStoredRefreshToken();
    if (!refreshToken) {
      return null;
    }

    try {
      const response = await refreshSession(refreshToken);
      await saveAuthSession(
        response.accessToken,
        response.refreshToken,
        response.user,
      );
      notifyAccessTokenRefreshed(response.accessToken);
      return response;
    } catch (error) {
      // Only a confirmed authentication rejection means the saved refresh
      // token is unusable. Connection resets, timeouts and 5xx responses are
      // common while a device changes network/VPN and must not log it out.
      if (error instanceof ApiError && error.status === 401) {
        await clearAuthSession();
        return null;
      }
      throw error;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function logoutUser(refreshToken: string | null) {
  if (!refreshToken) return;

  try {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    // Ignore network errors during logout.
  }
}
