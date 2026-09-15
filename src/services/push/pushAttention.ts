import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import {
  fetchPushStatusForThisDevice,
  getNotificationPermission,
  isIosSafariNeedPwaHint,
  isWebPushSupported,
} from '@/services/push/webPush';

const DISMISSED_KEY = '@adventura/push-attention-dismissed';
const OFFER_AFTER_REGISTER_KEY = '@adventura/push-offer-after-register';

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

export async function markOfferPushAfterRegister(): Promise<void> {
  if (Platform.OS !== 'web') {
    return;
  }
  await AsyncStorage.setItem(OFFER_AFTER_REGISTER_KEY, '1');
  await AsyncStorage.removeItem(DISMISSED_KEY);
}

export async function consumeOfferPushAfterRegister(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(OFFER_AFTER_REGISTER_KEY);
    if (value !== '1') {
      return false;
    }
    await AsyncStorage.removeItem(OFFER_AFTER_REGISTER_KEY);
    return true;
  } catch {
    return false;
  }
}

/** Push is off on this web device and the user has not pressed «оставить выключенными». */
export async function shouldShowPushAttention(): Promise<boolean> {
  if (Platform.OS !== 'web' || !isWebPushSupported()) {
    return false;
  }
  if (isIosSafariNeedPwaHint()) {
    // Still show attention — they need the PWA hint in settings.
    // But enable won't work until installed; keep the badge so they open settings.
  }

  if (await isPushAttentionDismissed()) {
    return false;
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
