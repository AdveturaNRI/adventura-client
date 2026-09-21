import { Platform } from 'react-native';
import { apiRequest } from '@/services/api/client';
import { firebaseWebConfig, firebaseWebVapidKey, isFirebaseWebConfigured, } from '@/services/push/firebase-config';
const SW_PATH = '/service-worker.js';
const FCM_TOKEN_KEY = '@adventura/fcm-device-token';
/** Firebase Cloud Messaging opt-in (settings + soft prompt). */
export const WEB_PUSH_OPT_IN_ENABLED = true;
let messagingPromise = null;
let vapidCache = null;
const VAPID_CACHE_MS = 5 * 60_000;
function canUseWebPush() {
    return (Platform.OS === 'web' &&
        typeof window !== 'undefined' &&
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        typeof Notification !== 'undefined');
}
export function isWebPushSupported() {
    return canUseWebPush() && isFirebaseWebConfigured();
}
export function getNotificationPermission() {
    if (!canUseWebPush()) {
        return 'unsupported';
    }
    return Notification.permission;
}
export function isIosSafariNeedPwaHint() {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof navigator === 'undefined') {
        return false;
    }
    const ua = navigator.userAgent || '';
    const isIos = /iPad|iPhone|iPod/.test(ua) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (!isIos) {
        return false;
    }
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
        // @ts-expect-error iOS Safari
        Boolean(navigator.standalone);
    return !isStandalone;
}
function rememberToken(token) {
    try {
        if (typeof localStorage === 'undefined') {
            return;
        }
        if (token) {
            localStorage.setItem(FCM_TOKEN_KEY, token);
        }
        else {
            localStorage.removeItem(FCM_TOKEN_KEY);
        }
    }
    catch {
        // ignore
    }
}
function readRememberedToken() {
    try {
        if (typeof localStorage === 'undefined') {
            return null;
        }
        return localStorage.getItem(FCM_TOKEN_KEY);
    }
    catch {
        return null;
    }
}
async function ensureServiceWorker() {
    if (!canUseWebPush()) {
        return null;
    }
    return navigator.serviceWorker.register(SW_PATH);
}
async function getFirebaseMessaging() {
    if (!canUseWebPush() || !isFirebaseWebConfigured()) {
        return null;
    }
    if (!messagingPromise) {
        messagingPromise = (async () => {
            const { initializeApp, getApps } = await import('firebase/app');
            const { getMessaging, isSupported } = await import('firebase/messaging');
            if (!(await isSupported())) {
                return null;
            }
            const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseWebConfig);
            return getMessaging(app);
        })().catch(() => null);
    }
    return messagingPromise;
}
/**
 * VAPID for FCM getToken: server key → client EXPO_PUBLIC_FIREBASE_VAPID_KEY.
 * Cached — settings/prompt otherwise spam /push/vapid-public-key.
 */
async function resolveVapidKey() {
    if (vapidCache && Date.now() - vapidCache.at < VAPID_CACHE_MS) {
        return { key: vapidCache.key };
    }
    try {
        const vapid = await apiRequest('/push/vapid-public-key', {
            skipLoading: true,
        });
        const serverKey = vapid?.publicKey?.trim() || '';
        if (vapid?.enabled && serverKey) {
            vapidCache = { key: serverKey, at: Date.now() };
            return { key: serverKey };
        }
        if (firebaseWebVapidKey) {
            vapidCache = { key: firebaseWebVapidKey, at: Date.now() };
            return { key: firebaseWebVapidKey };
        }
        return {
            key: null,
            reason: vapid?.reason === 'missing_vapid' ? 'missing_vapid' : 'server_disabled',
        };
    }
    catch {
        if (firebaseWebVapidKey) {
            vapidCache = { key: firebaseWebVapidKey, at: Date.now() };
            return { key: firebaseWebVapidKey };
        }
        return { key: null, reason: 'server_disabled' };
    }
}
export async function getCurrentPushEndpoint() {
    return readRememberedToken();
}
export async function fetchPushStatusForThisDevice() {
    const token = readRememberedToken();
    if (!token) {
        return false;
    }
    const status = await apiRequest(`/push/fcm-tokens/status?token=${encodeURIComponent(token)}`, { skipLoading: true });
    return status.subscribed;
}
/**
 * Re-bind current device FCM token to the logged-in user (no permission prompt).
 * Call after login / session restore when Notification.permission === 'granted'.
 */
export async function syncWebPushToUser() {
    if (!WEB_PUSH_OPT_IN_ENABLED || !canUseWebPush() || !isFirebaseWebConfigured()) {
        return false;
    }
    if (Notification.permission !== 'granted') {
        return false;
    }
    if (isIosSafariNeedPwaHint()) {
        return false;
    }
    try {
        const { key } = await resolveVapidKey();
        if (!key) {
            return false;
        }
        const registration = await ensureServiceWorker();
        if (!registration) {
            return false;
        }
        await navigator.serviceWorker.ready;
        const messaging = await getFirebaseMessaging();
        if (!messaging) {
            return false;
        }
        const { getToken } = await import('firebase/messaging');
        const token = await getToken(messaging, {
            vapidKey: key,
            serviceWorkerRegistration: registration,
        });
        if (!token) {
            return false;
        }
        rememberToken(token);
        await apiRequest('/push/fcm-tokens', {
            method: 'POST',
            body: {
                token,
                userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
            },
            skipLoading: true,
        });
        return true;
    }
    catch {
        return false;
    }
}
export async function enableWebPush() {
    if (!WEB_PUSH_OPT_IN_ENABLED) {
        return { ok: false, reason: 'unsupported' };
    }
    if (!canUseWebPush() || !isFirebaseWebConfigured()) {
        return { ok: false, reason: 'unsupported' };
    }
    if (isIosSafariNeedPwaHint()) {
        return { ok: false, reason: 'ios_pwa' };
    }
    // Must run in the same user-gesture turn as the click, before any await —
    // otherwise Chrome/Safari may not show the system permission dialog.
    const permission = Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission();
    if (permission !== 'granted') {
        return { ok: false, reason: 'denied' };
    }
    const { key, reason: vapidReason } = await resolveVapidKey();
    if (!key) {
        return { ok: false, reason: vapidReason ?? 'server_disabled' };
    }
    const registration = await ensureServiceWorker();
    if (!registration) {
        return { ok: false, reason: 'unsupported' };
    }
    await navigator.serviceWorker.ready;
    const messaging = await getFirebaseMessaging();
    if (!messaging) {
        return { ok: false, reason: 'unsupported' };
    }
    let token;
    try {
        const { getToken } = await import('firebase/messaging');
        token = await getToken(messaging, {
            vapidKey: key,
            serviceWorkerRegistration: registration,
        });
    }
    catch {
        return { ok: false, reason: 'subscribe_failed' };
    }
    if (!token) {
        return { ok: false, reason: 'subscribe_failed' };
    }
    rememberToken(token);
    try {
        await apiRequest('/push/fcm-tokens', {
            method: 'POST',
            body: {
                token,
                userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
            },
        });
    }
    catch {
        return { ok: false, reason: 'server_disabled' };
    }
    return { ok: true };
}
export async function disableWebPush() {
    if (!canUseWebPush()) {
        return;
    }
    const token = readRememberedToken();
    if (token) {
        try {
            await apiRequest('/push/fcm-tokens', {
                method: 'DELETE',
                body: { token },
                skipLoading: true,
            });
        }
        catch {
            // Still drop local token if API fails.
        }
    }
    try {
        const messaging = await getFirebaseMessaging();
        if (messaging) {
            const { deleteToken } = await import('firebase/messaging');
            await deleteToken(messaging);
        }
    }
    catch {
        // ignore
    }
    rememberToken(null);
}
