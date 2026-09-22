import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';

import { toast } from '@/components/ui/feedback/toast';
import {
  fetchCurrentUser,
  guestLogin,
  linkVkAccount,
  linkYandexAccount,
  loginUser,
  loginWithVk,
  loginWithYandex,
  logoutUser,
  refreshAuthTokens,
  registerUser,
  unlinkOauthAccount,
} from '@/services/auth/authApi';
import type { AuthUser, LinkedOAuthProvider } from '@/services/api/types';
import { onAccessTokenRefreshed } from '@/services/auth/token-refresh';
import {
  getVkAppId,
  getYandexClientId,
  isOauthWebAvailable,
  bootstrapOauthPublicConfig,
  requestVkAccessToken,
  requestYandexAccessToken,
} from '@/services/auth/oauth-web';
import {
  clearAuthSession,
  getStoredRefreshToken,
  getStoredToken,
  getStoredUser,
  patchStoredUser,
  saveAuthSession,
} from '@/utils/auth-storage';
import { localizeErrorMessage } from '@/utils/localizeError';
import { ensureUploadLimits } from '@/utils/upload-limits';
import { trackUserSessionStarted } from '@/services/analytics/analytics';
import {
  bootstrapYandexMetrika,
  reachYandexMetrikaGoal,
  setYandexMetrikaUserId,
} from '@/services/analytics/yandex-metrika';
import { markOfferPushAfterAuth } from '@/services/push/pushAttention';
import {
  bindMarketingTouches,
  getMarketingAnonymousId,
} from '@/services/marketing/attribution';

function resolveAcquisitionSource(): string {
  if (Platform.OS !== 'web') {
    return Platform.OS;
  }
  try {
    if (typeof document !== 'undefined' && document.referrer) {
      return `web:${new URL(document.referrer).hostname}`.slice(0, 64);
    }
  } catch {
    // ignore bad referrer
  }
  return 'web';
}

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  redirectToQuestionnaire: boolean;
  signIn: (email: string, password: string) => Promise<boolean>;
  signInAsGuest: () => Promise<boolean>;
  signInWithVk: () => Promise<boolean>;
  signInWithYandex: () => Promise<boolean>;
  linkVk: () => Promise<boolean>;
  linkYandex: () => Promise<boolean>;
  unlinkOauth: (provider: LinkedOAuthProvider) => Promise<boolean>;
  signUp: (email: string, nickname: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  clearPostSignUpRedirect: () => void;
  updateUser: (patch: Partial<AuthUser>) => Promise<void>;
  oauthWebAvailable: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [redirectToQuestionnaire, setRedirectToQuestionnaire] = useState(false);
  const [oauthIdsReady, setOauthIdsReady] = useState(
    () => Boolean(getVkAppId() || getYandexClientId()),
  );

  useEffect(() => {
    return onAccessTokenRefreshed((accessToken) => {
      setToken(accessToken);
    });
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }
    void bootstrapOauthPublicConfig().then((state) => {
      setOauthIdsReady(Boolean(state.vkAppId || state.yandexClientId));
    });
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }
    void bootstrapYandexMetrika().then(() => {
      setYandexMetrikaUserId(user?.id ?? null);
    });
  }, [user?.id]);

  useEffect(() => {
    void ensureUploadLimits().catch(() => {});

    let isMounted = true;

    async function restoreSession() {
      try {
        const [storedToken, storedRefreshToken, storedUser] = await Promise.all([
          getStoredToken(),
          getStoredRefreshToken(),
          getStoredUser(),
        ]);

        if (!storedToken || !storedRefreshToken || !storedUser) {
          return;
        }

        let accessToken = storedToken;
        let refreshToken = storedRefreshToken;
        let currentUser = storedUser;

        try {
          currentUser = await fetchCurrentUser(accessToken, {
            skipLoading: true,
            skipAuthRefresh: true,
          });
        } catch {
          const refreshed = await refreshAuthTokens();
          if (!refreshed) {
            throw new Error('Session expired');
          }

          accessToken = refreshed.accessToken;
          refreshToken = refreshed.refreshToken;
          currentUser = refreshed.user;
        }

        if (!isMounted) return;

        setToken(accessToken);
        setUser(currentUser);
        await saveAuthSession(accessToken, refreshToken, currentUser);
        trackUserSessionStarted('restore');
      } catch {
        await clearAuthSession();
        if (!isMounted) return;
        setToken(null);
        setUser(null);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const response = await loginUser({ email, password });
      await saveAuthSession(
        response.accessToken,
        response.refreshToken,
        response.user,
      );
      if (!response.user.isGuest) {
        await markOfferPushAfterAuth();
      }
      const anonymousId = await getMarketingAnonymousId().catch(() => null);
      if (anonymousId) {
        void bindMarketingTouches(response.accessToken, anonymousId);
      }
      setToken(response.accessToken);
      setUser(response.user);
      trackUserSessionStarted('password');
      toast.success('Добро пожаловать!');
      return true;
    } catch (error) {
      const message = localizeErrorMessage(error, 'Не удалось войти');
      toast.error(message);
      return false;
    }
  }, []);

  const applyOAuthSession = useCallback(
    async (
      response: Awaited<ReturnType<typeof loginWithVk>>,
      method: 'vk' | 'yandex',
    ) => {
      await saveAuthSession(
        response.accessToken,
        response.refreshToken,
        response.user,
      );
      if (!response.user.isGuest) {
        await markOfferPushAfterAuth();
      }
      const anonymousId = await getMarketingAnonymousId().catch(() => null);
      if (anonymousId) {
        void bindMarketingTouches(response.accessToken, anonymousId);
      }
      setToken(response.accessToken);
      setUser(response.user);
      trackUserSessionStarted(method);
      toast.success('Добро пожаловать!');
      return true;
    },
    [],
  );

  const signInWithVk = useCallback(async () => {
    try {
      if (!getVkAppId()) {
        toast.error('VK ID не настроен');
        return false;
      }
      const { accessToken } = await requestVkAccessToken();
      const anonymousId = await getMarketingAnonymousId().catch(() => undefined);
      const response = await loginWithVk({
        accessToken,
        acquisitionSource: 'vk',
        anonymousId,
      });
      return applyOAuthSession(response, 'vk');
    } catch (error) {
      const message = localizeErrorMessage(error, 'Не удалось войти через VK');
      toast.error(message);
      return false;
    }
  }, [applyOAuthSession]);

  const signInWithYandex = useCallback(async () => {
    try {
      if (!getYandexClientId()) {
        toast.error('Яндекс ID не настроен');
        return false;
      }
      const accessToken = await requestYandexAccessToken();
      const anonymousId = await getMarketingAnonymousId().catch(() => undefined);
      const response = await loginWithYandex({
        accessToken,
        acquisitionSource: 'yandex',
        anonymousId,
      });
      return applyOAuthSession(response, 'yandex');
    } catch (error) {
      const message = localizeErrorMessage(error, 'Не удалось войти через Яндекс');
      toast.error(message);
      return false;
    }
  }, [applyOAuthSession]);

  const linkVk = useCallback(async () => {
    try {
      if (!token) {
        toast.error('Нужно войти в аккаунт');
        return false;
      }
      const { accessToken } = await requestVkAccessToken();
      const nextUser = await linkVkAccount(token, { accessToken });
      await patchStoredUser(nextUser);
      setUser(nextUser);
      toast.success('VK привязан');
      return true;
    } catch (error) {
      const message = localizeErrorMessage(error, 'Не удалось привязать VK');
      toast.error(message);
      return false;
    }
  }, [token]);

  const linkYandex = useCallback(async () => {
    try {
      if (!token) {
        toast.error('Нужно войти в аккаунт');
        return false;
      }
      const accessToken = await requestYandexAccessToken();
      const nextUser = await linkYandexAccount(token, { accessToken });
      await patchStoredUser(nextUser);
      setUser(nextUser);
      toast.success('Яндекс привязан');
      return true;
    } catch (error) {
      const message = localizeErrorMessage(error, 'Не удалось привязать Яндекс');
      toast.error(message);
      return false;
    }
  }, [token]);

  const unlinkOauth = useCallback(
    async (provider: LinkedOAuthProvider) => {
      try {
        if (!token) {
          toast.error('Нужно войти в аккаунт');
          return false;
        }
        const nextUser = await unlinkOauthAccount(token, provider);
        await patchStoredUser(nextUser);
        setUser(nextUser);
        toast.success(provider === 'vk' ? 'VK отвязан' : 'Яндекс отвязан');
        return true;
      } catch (error) {
        const message = localizeErrorMessage(error, 'Не удалось отвязать');
        toast.error(message);
        return false;
      }
    },
    [token],
  );

  const signUp = useCallback(
    async (email: string, nickname: string, password: string) => {
      try {
        const anonymousId = await getMarketingAnonymousId().catch(() => undefined);
        const response = await registerUser({
          email,
          nickname,
          password,
          acquisitionSource: resolveAcquisitionSource(),
          anonymousId,
        });
        await saveAuthSession(
          response.accessToken,
          response.refreshToken,
          response.user,
        );
        await markOfferPushAfterAuth();
        // Бэкап: сервер тоже биндит по anonymousId в /auth/register.
        if (anonymousId) {
          void bindMarketingTouches(response.accessToken, anonymousId);
        }
        setToken(response.accessToken);
        setUser(response.user);
        setRedirectToQuestionnaire(true);
        trackUserSessionStarted('register');
        reachYandexMetrikaGoal('register');
        toast.success('Аккаунт создан — проверьте почту для подтверждения');
        return true;
      } catch (error) {
        const message = localizeErrorMessage(error, 'Не удалось зарегистрироваться');
        toast.error(message);
        return false;
      }
    },
    [],
  );

  const signInAsGuest = useCallback(async () => {
    try {
      const response = await guestLogin();
      await saveAuthSession(
        response.accessToken,
        response.refreshToken,
        response.user,
      );
      setToken(response.accessToken);
      setUser(response.user);
      setRedirectToQuestionnaire(true);
      trackUserSessionStarted('guest');
      toast.success(`Добро пожаловать, ${response.user.nickname}!`);
      return true;
    } catch (error) {
      const message = localizeErrorMessage(error, 'Не удалось войти как гость');
      toast.error(message);
      return false;
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      const { disableWebPush } = await import('@/services/push/webPush');
      await disableWebPush();
    } catch {
      // ignore push unbind errors
    }
    const refreshToken = await getStoredRefreshToken();
    await logoutUser(refreshToken);
    await clearAuthSession();
    setToken(null);
    setUser(null);
    setRedirectToQuestionnaire(false);
  }, []);

  const clearPostSignUpRedirect = useCallback(() => {
    setRedirectToQuestionnaire(false);
  }, []);

  const updateUser = useCallback(async (patch: Partial<AuthUser>) => {
    const next = await patchStoredUser(patch);
    if (next) {
      setUser(next);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      isLoading,
      isAuthenticated: Boolean(token && user),
      redirectToQuestionnaire,
      signIn,
      signInAsGuest,
      signInWithVk,
      signInWithYandex,
      linkVk,
      linkYandex,
      unlinkOauth,
      signUp,
      signOut,
      clearPostSignUpRedirect,
      updateUser,
      oauthWebAvailable: isOauthWebAvailable() && oauthIdsReady,
    }),
    [
      user,
      token,
      isLoading,
      redirectToQuestionnaire,
      signIn,
      signInAsGuest,
      signInWithVk,
      signInWithYandex,
      linkVk,
      linkYandex,
      unlinkOauth,
      signUp,
      signOut,
      clearPostSignUpRedirect,
      updateUser,
      oauthIdsReady,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
