import { Platform } from 'react-native';

/**
 * Телефонный браузер (мягкая клавиатура): Enter = новая строка.
 * ПК / планшет с клавиатурой: Enter = отправка.
 * Не путать с шириной окна — узкий десктопный viewport всё ещё ПК.
 */
export function isPhoneWebClient(): boolean {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') {
    return false;
  }
  const ua = navigator.userAgent || '';
  if (/iPhone|iPod/i.test(ua)) {
    return true;
  }
  // Android phone, не планшет.
  if (/Android/i.test(ua) && /Mobile/i.test(ua)) {
    return true;
  }
  return false;
}

/** Web + не телефон → Enter отправляет сообщение. */
export function shouldSendChatOnEnter(): boolean {
  return Platform.OS === 'web' && !isPhoneWebClient();
}
