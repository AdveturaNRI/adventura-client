/** Firebase web config — only used on web. Values from EXPO_PUBLIC_FIREBASE_*. */

export const firebaseWebConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID ?? '',
};

/** Web Push certificate key (Firebase Console → Cloud Messaging). Public, safe in client. */
export const firebaseWebVapidKey =
  process.env.EXPO_PUBLIC_FIREBASE_VAPID_KEY?.trim() ?? '';

export function isFirebaseWebConfigured(): boolean {
  return Boolean(
    firebaseWebConfig.apiKey &&
      firebaseWebConfig.projectId &&
      firebaseWebConfig.appId &&
      firebaseWebConfig.messagingSenderId,
  );
}
