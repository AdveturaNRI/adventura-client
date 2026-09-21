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
  loginUser,
  logoutUser,
  refreshAuthTokens,
  registerUser,
} from '@/services/auth/authApi';
import type { AuthUser } from '@/services/api/types';
import { onAccessTokenRefreshed } from '@/services/auth/token-refresh';
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
  signUp: (email: string, nickname: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  clearPostSignUpRedirect: () => void;
  updateUser: (patch: Partial<AuthUser>) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [redirectToQuestionnaire, setRedirectToQuestionnaire] = useState(false);

  useEffect(() => {
    return onAccessTokenRefreshed((accessToken) => {
      setToken(accessToken);
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

  const signUp = useCallback(
    async (email: string, nickname: string, password: string) => {
      try {
        const response = await registerUser({
          email,
          nickname,
          password,
          acquisitionSource: resolveAcquisitionSource(),
        });
        await saveAuthSession(
          response.accessToken,
          response.refreshToken,
          response.user,
        );
        await markOfferPushAfterAuth();
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
      signUp,
      signOut,
      clearPostSignUpRedirect,
      updateUser,
    }),
    [
      user,
      token,
      isLoading,
      redirectToQuestionnaire,
      signIn,
      signInAsGuest,
      signUp,
      signOut,
      clearPostSignUpRedirect,
      updateUser,
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
