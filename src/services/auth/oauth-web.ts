import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { apiRequest } from '@/services/api/client';

export type LinkedOAuthProvider = 'vk' | 'yandex';

function env(name: string): string {
  return (process.env[name] ?? '').trim();
}

type OauthPublicState = {
  vkAppId: string;
  yandexClientId: string;
  loaded: boolean;
};

const listeners = new Set<() => void>();

let oauthState: OauthPublicState = {
  vkAppId: env('EXPO_PUBLIC_VK_APP_ID'),
  yandexClientId: env('EXPO_PUBLIC_YANDEX_CLIENT_ID'),
  loaded: false,
};

function setOauthState(next: OauthPublicState) {
  oauthState = next;
  listeners.forEach((listener) => listener());
}

export function getVkAppId(): string {
  return oauthState.vkAppId;
}

export function getYandexClientId(): string {
  return oauthState.yandexClientId;
}

export function isOauthWebAvailable(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined';
}

/** Prefer API `/config/public` (from backend VK_APP_ID / YANDEX_CLIENT_ID). Env is optional local fallback. */
export async function bootstrapOauthPublicConfig(): Promise<OauthPublicState> {
  if (!isOauthWebAvailable()) {
    const next = { ...oauthState, loaded: true };
    setOauthState(next);
    return next;
  }

  try {
    const payload = await apiRequest<{
      oauth?: {
        vk?: { enabled?: boolean; appId?: string | null };
        yandex?: { enabled?: boolean; clientId?: string | null };
      };
    }>('/config/public', {
      skipLoading: true,
      skipAuthRefresh: true,
    });

    const vkAppId =
      (payload.oauth?.vk?.enabled && payload.oauth.vk.appId?.trim()) ||
      env('EXPO_PUBLIC_VK_APP_ID');
    const yandexClientId =
      (payload.oauth?.yandex?.enabled &&
        payload.oauth.yandex.clientId?.trim()) ||
      env('EXPO_PUBLIC_YANDEX_CLIENT_ID');

    const next = {
      vkAppId: vkAppId || '',
      yandexClientId: yandexClientId || '',
      loaded: true,
    };
    setOauthState(next);
    return next;
  } catch {
    const next = { ...oauthState, loaded: true };
    setOauthState(next);
    return next;
  }
}

export function useOauthPublicConfig() {
  const [state, setState] = useState(oauthState);

  useEffect(() => {
    const sync = () => setState(oauthState);
    listeners.add(sync);
    if (!oauthState.loaded) {
      void bootstrapOauthPublicConfig();
    }
    return () => {
      listeners.delete(sync);
    };
  }, []);

  return state;
}

type VkAuthResult = {
  code?: string;
  device_id?: string;
  token?: string;
  silent_token?: string;
  uuid?: string;
  access_token?: string;
  user_id?: string | number;
};

type VkSdkModule = {
  Config: {
    init: (options: Record<string, unknown>) => void;
  };
  ConfigResponseMode: { Callback: unknown };
  ConfigSource: { LOWCODE: unknown };
  Auth: {
    login: (params?: Record<string, unknown>) => Promise<VkAuthResult>;
    exchangeCode: (
      code: string,
      deviceId: string,
      codeVerifier?: string,
    ) => Promise<{
      access_token?: string;
      user_id?: string | number;
      email?: string;
    }>;
  };
};

declare global {
  interface Window {
    VKIDSDK?: VkSdkModule;
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === '1') {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Script load failed')), {
        once: true,
      });
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = '1';
      resolve();
    };
    script.onerror = () => reject(new Error(`Не удалось загрузить ${src}`));
    document.head.appendChild(script);
  });
}

async function loadVkSdk(): Promise<VkSdkModule> {
  if (window.VKIDSDK) {
    return window.VKIDSDK;
  }
  // 2.6+ — code+PKCE, без silent_token / One Tap overlay
  await loadScript('https://unpkg.com/@vkid/sdk@2.6.1/dist-sdk/umd/index.js');
  if (!window.VKIDSDK) {
    throw new Error('VK ID SDK не загрузился');
  }
  return window.VKIDSDK;
}

/**
 * VK ID Auth.login (popup/bridge) → exchangeCode → access_token for backend.
 * No One Tap widget (that was the huge blue bar).
 */
export async function requestVkAccessToken(): Promise<{ accessToken: string }> {
  if (!isOauthWebAvailable()) {
    throw new Error('VK ID пока доступен только в веб-версии');
  }
  const appId = Number(getVkAppId());
  if (!appId) {
    throw new Error('VK ID не настроен');
  }

  const VKID = await loadVkSdk();
  const redirectUrl = window.location.origin;

  VKID.Config.init({
    app: appId,
    redirectUrl,
    responseMode: VKID.ConfigResponseMode.Callback,
    source: VKID.ConfigSource.LOWCODE,
    scope: 'email',
  });

  const authResult = await VKID.Auth.login();

  // Rare legacy path if SDK still returns silent token
  const silent = authResult.token || authResult.silent_token;
  if (silent && authResult.uuid) {
    // Caller may still send silent — but prefer access_token when present
    if (authResult.access_token) {
      return { accessToken: authResult.access_token };
    }
  }

  if (authResult.access_token) {
    return { accessToken: authResult.access_token };
  }

  const code = authResult.code;
  const deviceId = authResult.device_id;
  if (!code || !deviceId) {
    throw new Error('VK ID не вернул код авторизации');
  }

  const tokens = await VKID.Auth.exchangeCode(code, deviceId);
  if (!tokens.access_token) {
    throw new Error('VK ID не вернул access_token');
  }

  return { accessToken: tokens.access_token };
}

/** @deprecated use requestVkAccessToken */
export async function requestVkSilentAuth(): Promise<{
  silentToken?: string;
  uuid?: string;
  accessToken: string;
}> {
  const { accessToken } = await requestVkAccessToken();
  return { accessToken };
}

const YANDEX_OAUTH_MESSAGE = 'adventura-yandex-oauth';

/**
 * Yandex OAuth implicit token via popup (web).
 * Register redirect URI: {origin}/auth/oauth/yandex/callback
 */
export async function requestYandexAccessToken(): Promise<string> {
  if (!isOauthWebAvailable()) {
    throw new Error('Яндекс ID пока доступен только в веб-версии');
  }
  const clientId = getYandexClientId();
  if (!clientId) {
    throw new Error('Яндекс ID не настроен');
  }

  const redirectUri = `${window.location.origin}/auth/oauth/yandex/callback`;
  const authUrl = new URL('https://oauth.yandex.ru/authorize');
  authUrl.searchParams.set('response_type', 'token');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('force_confirm', 'yes');
  authUrl.searchParams.set('scope', 'login:info login:email');

  return new Promise((resolve, reject) => {
    const popup = window.open(
      authUrl.toString(),
      'yandex-oauth',
      'width=560,height=700',
    );
    if (!popup) {
      reject(new Error('Браузер заблокировал окно Яндекс ID'));
      return;
    }

    const timer = window.setInterval(() => {
      if (popup.closed) {
        window.clearInterval(timer);
        window.removeEventListener('message', onMessage);
        reject(new Error('Авторизация Яндекс ID отменена'));
      }
    }, 500);

    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data as {
        type?: string;
        accessToken?: string;
        error?: string;
      };
      if (data?.type !== YANDEX_OAUTH_MESSAGE) return;
      window.clearInterval(timer);
      window.removeEventListener('message', onMessage);
      try {
        popup?.close();
      } catch {
        // ignore
      }
      if (data.error || !data.accessToken) {
        reject(new Error(data.error || 'Яндекс ID не вернул токен'));
        return;
      }
      resolve(data.accessToken);
    }

    window.addEventListener('message', onMessage);
  });
}

export { YANDEX_OAUTH_MESSAGE };
