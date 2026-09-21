import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, Platform } from 'react-native';

import { PushOptInDialog } from '@/components/push/PushOptInDialog';
import { toast } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import {
  clearPushAttentionDismissed,
  clearPushUserDisabled,
  clearSoftPromptDismissed,
  consumeOfferPushAfterAuth,
  deviceNeedsPushOptIn,
  dismissPushAttention,
  isPushUserDisabled,
  isSoftPromptDismissed,
  markFcmV1Offered,
  markPushUserDisabled,
  markSoftPromptDismissed,
  peekOfferPushAfterAuth,
  resolvePushOptInVariant,
  shouldForceLegacyFcmOffer,
  shouldShowPushAttention,
  type PushOptInVariant,
} from '@/services/push/pushAttention';
import {
  enableWebPush,
  getNotificationPermission,
  isWebPushSupported,
  syncWebPushToUser,
  WEB_PUSH_OPT_IN_ENABLED,
} from '@/services/push/webPush';
import { localizeErrorMessage } from '@/utils/localizeError';

const FIRST_MESSAGE_KEY = '@adventura/push-prompt-first-message';
const SHOW_DELAY_MS = 700;

type PushPromptContextValue = {
  requestAfterCreateGame: () => void;
  requestAfterFirstMessage: () => void;
  showSettingsAlert: boolean;
  refreshPushAttention: () => void;
  dismissSettingsAlert: () => void;
  notifyPushEnabled: () => void;
  notifyPushDisabled: () => void;
};

const PushPromptContext = createContext<PushPromptContextValue | null>(null);

export function PushPromptProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [variant, setVariant] = useState<PushOptInVariant>('opt-in');
  const [showSettingsAlert, setShowSettingsAlert] = useState(false);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const authPassRef = useRef(0);

  const refreshPushAttention = useCallback(() => {
    if (!WEB_PUSH_OPT_IN_ENABLED || Platform.OS !== 'web' || !isAuthenticated) {
      setShowSettingsAlert(false);
      return;
    }
    if (user?.isGuest) {
      setShowSettingsAlert(false);
      return;
    }
    void shouldShowPushAttention().then(setShowSettingsAlert);
  }, [isAuthenticated, user?.isGuest]);

  useEffect(() => {
    refreshPushAttention();
  }, [refreshPushAttention]);

  useEffect(() => {
    if (!WEB_PUSH_OPT_IN_ENABLED || Platform.OS !== 'web') {
      return;
    }
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refreshPushAttention();
      }
    });
    return () => sub.remove();
  }, [refreshPushAttention]);

  useEffect(() => {
    return () => {
      if (showTimerRef.current) {
        clearTimeout(showTimerRef.current);
      }
    };
  }, []);

  const tryShow = useCallback(
    async (options?: { force?: boolean; variant?: PushOptInVariant }) => {
      if (!WEB_PUSH_OPT_IN_ENABLED || Platform.OS !== 'web') {
        return;
      }
      if (user?.isGuest) {
        return;
      }
      if (!isWebPushSupported()) {
        return;
      }
      if (!(await deviceNeedsPushOptIn())) {
        return;
      }
      if (!options?.force && (await isSoftPromptDismissed())) {
        return;
      }

      const nextVariant =
        options?.variant ?? (await resolvePushOptInVariant());

      if (showTimerRef.current) {
        clearTimeout(showTimerRef.current);
      }
      showTimerRef.current = setTimeout(() => {
        showTimerRef.current = null;
        void deviceNeedsPushOptIn().then((needs) => {
          if (!needs) {
            return;
          }
          setVariant(nextVariant);
          setVisible(true);
          void markFcmV1Offered();
        });
      }, SHOW_DELAY_MS);
    },
    [user?.isGuest],
  );

  const notifyPushEnabled = useCallback(() => {
    void (async () => {
      await clearPushAttentionDismissed();
      await clearPushUserDisabled();
      await clearSoftPromptDismissed();
      await markFcmV1Offered();
      setShowSettingsAlert(false);
    })();
  }, []);

  const notifyPushDisabled = useCallback(() => {
    void (async () => {
      await markPushUserDisabled();
      refreshPushAttention();
    })();
  }, [refreshPushAttention]);

  useEffect(() => {
    if (!WEB_PUSH_OPT_IN_ENABLED || !isAuthenticated || Platform.OS !== 'web') {
      return;
    }
    if (user?.isGuest) {
      return;
    }

    const passId = ++authPassRef.current;

    void (async () => {
      const authOffer = await peekOfferPushAfterAuth();
      const legacyForce = await shouldForceLegacyFcmOffer();
      const userDisabled = await isPushUserDisabled();
      refreshPushAttention();

      if (passId !== authPassRef.current) {
        return;
      }

      if (!(await deviceNeedsPushOptIn())) {
        await markFcmV1Offered();
        if (authOffer) {
          await consumeOfferPushAfterAuth();
        }
        return;
      }

      const permission = getNotificationPermission();
      const force = authOffer || legacyForce || userDisabled;

      // Silent FCM bind only on session restore — not after login/register.
      // Otherwise «выключил → вышел → зашёл» тихо включает пуш обратно.
      if (permission === 'granted' && !userDisabled && !authOffer) {
        const synced = await syncWebPushToUser();
        if (passId !== authPassRef.current) {
          return;
        }
        if (synced) {
          notifyPushEnabled();
          toast.success('Уведомления подключены на этом устройстве');
          return;
        }
        await tryShow({
          force,
          variant: 'reconnect',
        });
        return;
      }

      if (authOffer) {
        await consumeOfferPushAfterAuth();
      }
      await tryShow({
        force,
        variant: permission === 'granted' ? 'reconnect' : 'opt-in',
      });
    })();
  }, [
    isAuthenticated,
    user?.isGuest,
    notifyPushEnabled,
    refreshPushAttention,
    tryShow,
  ]);

  const requestAfterCreateGame = useCallback(() => {
    void tryShow();
  }, [tryShow]);

  const requestAfterFirstMessage = useCallback(() => {
    void (async () => {
      try {
        const seen = await AsyncStorage.getItem(FIRST_MESSAGE_KEY);
        if (seen === '1') {
          return;
        }
        await AsyncStorage.setItem(FIRST_MESSAGE_KEY, '1');
      } catch {
        // still try
      }
      await tryShow();
    })();
  }, [tryShow]);

  const dismissSettingsAlert = useCallback(() => {
    void (async () => {
      await dismissPushAttention();
      setShowSettingsAlert(false);
    })();
  }, []);

  const handleLater = useCallback(() => {
    setVisible(false);
    void markSoftPromptDismissed();
    void markFcmV1Offered();
    refreshPushAttention();
  }, [refreshPushAttention]);

  const handleEnable = useCallback(() => {
    void (async () => {
      setBusy(true);
      try {
        const result = await enableWebPush();
        setVisible(false);
        if (result.ok) {
          toast.success(
            variant === 'reconnect'
              ? 'Доставка уведомлений подключена'
              : 'Уведомления включены',
          );
          notifyPushEnabled();
          return;
        }
        refreshPushAttention();
        if (result.reason === 'denied') {
          toast.info('Разрешите уведомления в настройках браузера');
          return;
        }
        if (result.reason === 'ios_pwa') {
          toast.info('На iPhone пуши работают, если сайт добавлен на домашний экран.');
          return;
        }
        if (result.reason === 'missing_vapid' || result.reason === 'server_disabled') {
          toast.error(
            'Не задан Firebase Web Push VAPID key. Задай его в админке: Web Push / FCM.',
          );
          return;
        }
        if (result.reason === 'subscribe_failed') {
          toast.error('Браузер не смог оформить подписку на уведомления');
          return;
        }
        toast.error('Не удалось включить уведомления');
      } catch (error) {
        toast.error(localizeErrorMessage(error, 'Не удалось включить уведомления'));
        refreshPushAttention();
      } finally {
        setBusy(false);
      }
    })();
  }, [notifyPushEnabled, refreshPushAttention, variant]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; url?: string } | null;
      if (!data || data.type !== 'PUSH_NAVIGATE' || typeof data.url !== 'string') {
        return;
      }
      const path = data.url.startsWith('http')
        ? (() => {
            try {
              return new URL(data.url).pathname + new URL(data.url).search;
            } catch {
              return data.url;
            }
          })()
        : data.url;
      router.push(path as never);
    };

    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [router]);

  const value = useMemo(
    () => ({
      requestAfterCreateGame,
      requestAfterFirstMessage,
      showSettingsAlert,
      refreshPushAttention,
      dismissSettingsAlert,
      notifyPushEnabled,
      notifyPushDisabled,
    }),
    [
      requestAfterCreateGame,
      requestAfterFirstMessage,
      showSettingsAlert,
      refreshPushAttention,
      dismissSettingsAlert,
      notifyPushEnabled,
      notifyPushDisabled,
    ],
  );

  return (
    <PushPromptContext.Provider value={value}>
      {children}
      {WEB_PUSH_OPT_IN_ENABLED ? (
        <PushOptInDialog
          visible={visible}
          busy={busy}
          variant={variant}
          onEnable={handleEnable}
          onLater={handleLater}
        />
      ) : null}
    </PushPromptContext.Provider>
  );
}

export function usePushPrompt() {
  const ctx = useContext(PushPromptContext);
  if (!ctx) {
    return {
      requestAfterCreateGame: () => undefined,
      requestAfterFirstMessage: () => undefined,
      showSettingsAlert: false,
      refreshPushAttention: () => undefined,
      dismissSettingsAlert: () => undefined,
      notifyPushEnabled: () => undefined,
      notifyPushDisabled: () => undefined,
    };
  }
  return ctx;
}
