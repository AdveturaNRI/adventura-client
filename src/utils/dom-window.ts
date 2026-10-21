import { Platform } from 'react-native';

/** RN polyfills `window`, but DOM listeners / location / matchMedia are web-only. */
export function canUseDomWindow(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    typeof window.addEventListener === 'function'
  );
}

export function canUseDomDocument(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof document !== 'undefined' &&
    typeof document.addEventListener === 'function'
  );
}
