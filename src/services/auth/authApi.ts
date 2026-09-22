import { apiRequest } from '@/services/api/client';
import type { AuthResponse, AuthUser, NicknameResponse } from '@/services/api/types';

type RegisterPayload = {
  email: string;
  nickname: string;
  password: string;
  acquisitionSource?: string;
  anonymousId?: string;
};

type LoginPayload = {
  email: string;
  password: string;
};

type VkOAuthPayload = {
  accessToken?: string;
  silentToken?: string;
  uuid?: string;
  acquisitionSource?: string;
  anonymousId?: string;
};

type YandexOAuthPayload = {
  accessToken: string;
  acquisitionSource?: string;
  anonymousId?: string;
};

export function registerUser(payload: RegisterPayload) {
  return apiRequest<AuthResponse>('/auth/register', {
    method: 'POST',
    body: payload,
    skipAuthRefresh: true,
  });
}

export function loginUser(payload: LoginPayload) {
  return apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: payload,
    skipAuthRefresh: true,
  });
}

export function loginWithVk(payload: VkOAuthPayload) {
  return apiRequest<AuthResponse>('/auth/oauth/vk', {
    method: 'POST',
    body: payload,
    skipAuthRefresh: true,
  });
}

export function loginWithYandex(payload: YandexOAuthPayload) {
  return apiRequest<AuthResponse>('/auth/oauth/yandex', {
    method: 'POST',
    body: payload,
    skipAuthRefresh: true,
  });
}

export function linkVkAccount(token: string, payload: VkOAuthPayload) {
  return apiRequest<AuthUser>('/auth/oauth/vk/link', {
    method: 'POST',
    body: payload,
    token,
  });
}

export function linkYandexAccount(token: string, payload: YandexOAuthPayload) {
  return apiRequest<AuthUser>('/auth/oauth/yandex/link', {
    method: 'POST',
    body: payload,
    token,
  });
}

export function unlinkOauthAccount(token: string, provider: 'vk' | 'yandex') {
  return apiRequest<AuthUser>(`/auth/oauth/${provider}`, {
    method: 'DELETE',
    token,
  });
}

export function fetchCurrentUser(
  token: string,
  options?: { skipLoading?: boolean; skipAuthRefresh?: boolean },
) {
  return apiRequest<AuthResponse['user']>('/auth/me', {
    token,
    skipLoading: options?.skipLoading,
    skipAuthRefresh: options?.skipAuthRefresh,
  });
}

export function fetchNicknameSuggestion() {
  return apiRequest<NicknameResponse>('/auth/nickname', {
    skipAuthRefresh: true,
  });
}

export function guestLogin() {
  return apiRequest<AuthResponse>('/auth/guest', {
    method: 'POST',
    skipAuthRefresh: true,
  });
}

export function requestEmailVerification(token: string) {
  return apiRequest<{ ok: boolean; alreadyVerified?: boolean }>(
    '/auth/verify-email/request',
    {
      method: 'POST',
      token,
    },
  );
}

export function verifyEmail(tokenValue: string) {
  return apiRequest<{ ok: boolean }>('/auth/verify-email', {
    method: 'POST',
    body: { token: tokenValue },
    skipAuthRefresh: true,
  });
}

export function forgotPassword(email: string) {
  return apiRequest<{ ok: boolean }>('/auth/forgot-password', {
    method: 'POST',
    body: { email },
    skipAuthRefresh: true,
  });
}

export function resetPassword(tokenValue: string, password: string) {
  return apiRequest<{ ok: boolean }>('/auth/reset-password', {
    method: 'POST',
    body: { token: tokenValue, password },
    skipAuthRefresh: true,
  });
}

export { logoutUser, refreshAuthTokens } from '@/services/auth/token-refresh';
