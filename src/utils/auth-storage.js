import AsyncStorage from '@react-native-async-storage/async-storage';
const AUTH_TOKEN_KEY = '@adventura/auth-token';
const AUTH_REFRESH_TOKEN_KEY = '@adventura/auth-refresh-token';
const AUTH_USER_KEY = '@adventura/auth-user';
export async function getStoredToken() {
    return AsyncStorage.getItem(AUTH_TOKEN_KEY);
}
export async function getStoredRefreshToken() {
    return AsyncStorage.getItem(AUTH_REFRESH_TOKEN_KEY);
}
export async function getStoredUser() {
    const raw = await AsyncStorage.getItem(AUTH_USER_KEY);
    if (!raw)
        return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.id || !parsed.email || !parsed.nickname) {
        return null;
    }
    return {
        id: parsed.id,
        email: parsed.email,
        nickname: parsed.nickname,
        isGuest: Boolean(parsed.isGuest),
        emailVerified: Boolean(parsed.emailVerified),
    };
}
export async function saveAuthSession(accessToken, refreshToken, user) {
    await AsyncStorage.setMany({
        [AUTH_TOKEN_KEY]: accessToken,
        [AUTH_REFRESH_TOKEN_KEY]: refreshToken,
        [AUTH_USER_KEY]: JSON.stringify(user),
    });
}
export async function patchStoredUser(patch) {
    const current = await getStoredUser();
    if (!current) {
        return null;
    }
    const next = { ...current, ...patch };
    await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(next));
    return next;
}
export async function clearAuthSession() {
    await AsyncStorage.removeMany([
        AUTH_TOKEN_KEY,
        AUTH_REFRESH_TOKEN_KEY,
        AUTH_USER_KEY,
    ]);
}
