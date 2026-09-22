/** Firebase web config — only used on web. Values from EXPO_PUBLIC_FIREBASE_*. */

function env(name: string): string {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Keep in sync with `public/firebase-config.js`.
 * Fallback when Metro/static export did not inline EXPO_PUBLIC_* (prod CI
 * missing secrets, or local .env added without a clean restart).
 */
const FIREBASE_WEB_FALLBACK = {
  apiKey: 'AIzaSyDBZMrLPSKBud9CJpMVHT59GCTnJU20b2U',
  authDomain: 'adventu-1ee37.firebaseapp.com',
  projectId: 'adventu-1ee37',
  storageBucket: 'adventu-1ee37.firebasestorage.app',
  messagingSenderId: '526819440427',
  appId: '1:526819440427:web:dcf38469a5d2cf46fdb76e',
  measurementId: 'G-5BYYJV5H9Q',
} as const;

export const firebaseWebConfig = {
  apiKey: env('EXPO_PUBLIC_FIREBASE_API_KEY') || FIREBASE_WEB_FALLBACK.apiKey,
  authDomain: env('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN') || FIREBASE_WEB_FALLBACK.authDomain,
  projectId: env('EXPO_PUBLIC_FIREBASE_PROJECT_ID') || FIREBASE_WEB_FALLBACK.projectId,
  storageBucket:
    env('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET') || FIREBASE_WEB_FALLBACK.storageBucket,
  messagingSenderId:
    env('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID') || FIREBASE_WEB_FALLBACK.messagingSenderId,
  appId: env('EXPO_PUBLIC_FIREBASE_APP_ID') || FIREBASE_WEB_FALLBACK.appId,
  measurementId:
    env('EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID') || FIREBASE_WEB_FALLBACK.measurementId,
};

/** Web Push certificate key (Firebase Console → Cloud Messaging). Public, safe in client. */
export const firebaseWebVapidKey = env('EXPO_PUBLIC_FIREBASE_VAPID_KEY');

export function isFirebaseWebConfigured(): boolean {
  return Boolean(
    firebaseWebConfig.apiKey &&
      firebaseWebConfig.projectId &&
      firebaseWebConfig.appId &&
      firebaseWebConfig.messagingSenderId,
  );
}
