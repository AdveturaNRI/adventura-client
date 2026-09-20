import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import {
  fetchPushStatusForThisDevice,
  getCurrentPushEndpoint,
  getNotificationPermission,
  isIosSafariNeedPwaHint,
  isWebPushSupported,
} from '@/services/push/webPush';

const DISMISSED_KEY = '@adventura/push-attention-dismissed';
const OFFER_AFTER_AUTH_KEY = '@adventura/push-offer-after-auth';
/** One-shot for accounts that existed before FCM opt-in. */
const FCM_V1_OFFERED_KEY = '@adventura/push-fcm-v1-offered';
/** User turned push off in settings — do not silent-resync until they opt in again. */
const USER_DISABLED_KEY = '@adventura/push-user-disabled';
/** Soft-prompt «Позже» — hide dialog until this timestamp. */
const SOFT_DISMISS_UNTIL_KEY = '@adventura/push-prompt-dismiss-until';
const SOFT_DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

export type PushOptInVariant = 'opt-in' | 'reconnect';

export async function isPushAttentionDismissed(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(DISMISSED_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function dismissPushAttention(): Promise<void> {
  await AsyncStorage.setItem(DISMISSED_KEY, '1');
}

export async function clearPushAttentionDismissed(): Promise<void> {
  await AsyncStorage.removeItem(DISMISSED_KEY);
}

export async function isPushUserDisabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(USER_DISABLED_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function markPushUserDisabled(): Promise<void> {
  await AsyncStorage.setItem(USER_DISABLED_KEY, '1');
}

export async function clearPushUserDisabled(): Promise<void> {
  await AsyncStorage.removeItem(USER_DISABLED_KEY);
}

export async function isSoftPromptDismissed(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(SOFT_DISMISS_UNTIL_KEY);
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

export async function markSoftPromptDismissed(): Promise<void> {
  await AsyncStorage.setItem(
    SOFT_DISMISS_UNTIL_KEY,
    String(Date.now() + SOFT_DISMISS_MS),
  );
}

export async function clearSoftPromptDismissed(): Promise<void> {
  await AsyncStorage.removeItem(SOFT_DISMISS_UNTIL_KEY);
}

/** После логина / регистрации — один раз показать soft-prompt (даже если «Позже» раньше). */
export async function markOfferPushAfterAuth(): Promise<void> {
  if (Platform.OS !== 'web') {
    return;
  }
  await AsyncStorage.setItem(OFFER_AFTER_AUTH_KEY, '1');
  await AsyncStorage.removeItem(DISMISSED_KEY);
  await AsyncStorage.removeItem(SOFT_DISMISS_UNTIL_KEY);
}

/** @deprecated use markOfferPushAfterAuth */
export async function markOfferPushAfterRegister(): Promise<void> {
  return markOfferPushAfterAuth();
}

export async function peekOfferPushAfterAuth(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(OFFER_AFTER_AUTH_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function consumeOfferPushAfterAuth(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(OFFER_AFTER_AUTH_KEY);
    if (value !== '1') {
      return false;
    }
    await AsyncStorage.removeItem(OFFER_AFTER_AUTH_KEY);
    return true;
  } catch {
    return false;
  }
}

/** @deprecated use consumeOfferPushAfterAuth */
export async function consumeOfferPushAfterRegister(): Promise<boolean> {
  return consumeOfferPushAfterAuth();
}

export async function hasOfferedFcmV1(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(FCM_V1_OFFERED_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function markFcmV1Offered(): Promise<void> {
  await AsyncStorage.setItem(FCM_V1_OFFERED_KEY, '1');
}

/**
 * This browser/device still needs an opt-in ask:
 * - permission default, or
 * - granted but no FCM token bound to the account yet (legacy web-push / pre-FCM)
 */
export async function deviceNeedsPushOptIn(): Promise<boolean> {
  if (Platform.OS !== 'web' || !isWebPushSupported()) {
    return false;
  }
  if (isIosSafariNeedPwaHint()) {
    return false;
  }

  const permission = getNotificationPermission();
  if (permission === 'denied' || permission === 'unsupported') {
    return false;
  }
  if (permission === 'default') {
    return true;
  }

  if (await isPushUserDisabled()) {
    return true;
  }

  const localToken = await getCurrentPushEndpoint();
  if (!localToken) {
    return true;
  }
  try {
    return !(await fetchPushStatusForThisDevice());
  } catch {
    return true;
  }
}

export async function resolvePushOptInVariant(): Promise<PushOptInVariant> {
  const permission = getNotificationPermission();
  if (permission === 'granted') {
    return 'reconnect';
  }
  return 'opt-in';
}

/**
 * Existing accounts that never saw the FCM prompt — force one offer
 * (ignores 7-day «Позже» once).
 */
export async function shouldForceLegacyFcmOffer(): Promise<boolean> {
  if (!(await deviceNeedsPushOptIn())) {
    return false;
  }
  return !(await hasOfferedFcmV1());
}

/** Push is off on this web device and the user has not pressed «оставить выключенными». */
export async function shouldShowPushAttention(): Promise<boolean> {
  if (Platform.OS !== 'web' || !isWebPushSupported()) {
    return false;
  }

  if (await isPushAttentionDismissed()) {
    return false;
  }

  if (await isPushUserDisabled()) {
    return true;
  }

  const permission = getNotificationPermission();
  if (permission === 'granted') {
    try {
      const subscribed = await fetchPushStatusForThisDevice();
      if (subscribed) {
        return false;
      }
    } catch {
      return true;
    }
  }

  return true;
}
