import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AppState, Platform } from 'react-native';

import { PushOptInDialog } from '@/components/push/PushOptInDialog';
import { toast } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import {
  clearPushAttentionDismissed,
  consumeOfferPushAfterRegister,
  dismissPushAttention,
  shouldShowPushAttention,
} from '@/services/push/pushAttention';
import {
  enableWebPush,
  getNotificationPermission,
  isIosSafariNeedPwaHint,
  isWebPushSupported,
} from '@/services/push/webPush';
import { localizeErrorMessage } from '@/utils/localizeError';

const DISMISS_KEY = '@adventura/push-prompt-dismiss-until';
const FIRST_MESSAGE_KEY = '@adventura/push-prompt-first-message';
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

type PushPromptContextValue = {
  requestAfterCreateGame: () => void;
  requestAfterFirstMessage: () => void;
  /** Red ! on settings + banner in settings while push is off and not dismissed. */
  showSettingsAlert: boolean;
  refreshPushAttention: () => void;
  dismissSettingsAlert: () => void;
  notifyPushEnabled: () => void;
};

const PushPromptContext = createContext<PushPromptContextValue | null>(null);

async function isSoftPromptDismissed(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(DISMISS_KEY);
    if (!raw) {
      return false;
    }
    const until = Number(raw);
    if (!Number.isFinite(until)) {
      return false;
    }
    return Date.now() < until;
  } catch {
    return false;
  }
}

async function markSoftPromptDismissed() {
  await AsyncStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_MS));
}

function shouldOfferSoftPrompt(): boolean {
  if (!isWebPushSupported()) {
    return false;
  }
  if (isIosSafariNeedPwaHint()) {
    return false;
  }
  return getNotificationPermission() === 'default';
}

export function PushPromptProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showSettingsAlert, setShowSettingsAlert] = useState(false);

  const refreshPushAttention = useCallback(() => {
    if (Platform.OS !== 'web' || !isAuthenticated) {
      setShowSettingsAlert(false);
      return;
    }
    void shouldShowPushAttention().then(setShowSettingsAlert);
  }, [isAuthenticated]);

  useEffect(() => {
    refreshPushAttention();
  }, [refreshPushAttention]);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refreshPushAttention();
      }
    });
    return () => sub.remove();
  }, [refreshPushAttention]);

  const tryShow = useCallback(async () => {
    if (Platform.OS !== 'web') {
      return;
    }
    if (!shouldOfferSoftPrompt()) {
      return;
    }
    if (await isSoftPromptDismissed()) {
      return;
    }
    setVisible(true);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || Platform.OS !== 'web') {
      return;
    }
    void (async () => {
      const offer = await consumeOfferPushAfterRegister();
      if (!offer) {
        return;
      }
      refreshPushAttention();
      await tryShow();
    })();
  }, [isAuthenticated, refreshPushAttention, tryShow]);

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
        // still try to show once this session
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

  const notifyPushEnabled = useCallback(() => {
    void (async () => {
      await clearPushAttentionDismissed();
      setShowSettingsAlert(false);
    })();
  }, []);

  const handleLater = useCallback(() => {
    setVisible(false);
    void markSoftPromptDismissed();
    refreshPushAttention();
  }, [refreshPushAttention]);

  const handleEnable = useCallback(() => {
    void (async () => {
      setBusy(true);
      try {
        const result = await enableWebPush();
        setVisible(false);
        if (result.ok) {
          toast.success('Уведомления включены');
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
        toast.error('Не удалось включить уведомления');
      } catch (error) {
        toast.error(localizeErrorMessage(error, 'Не удалось включить уведомления'));
        refreshPushAttention();
      } finally {
        setBusy(false);
      }
    })();
  }, [notifyPushEnabled, refreshPushAttention]);

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
    }),
    [
      requestAfterCreateGame,
      requestAfterFirstMessage,
      showSettingsAlert,
      refreshPushAttention,
      dismissSettingsAlert,
      notifyPushEnabled,
    ],
  );

  return (
    <PushPromptContext.Provider value={value}>
      {children}
      <PushOptInDialog
        visible={visible}
        busy={busy}
        onEnable={handleEnable}
        onLater={handleLater}
      />
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
    };
  }
  return ctx;
}
