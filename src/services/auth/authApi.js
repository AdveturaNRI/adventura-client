import { apiRequest } from '@/services/api/client';
export function registerUser(payload) {
    return apiRequest('/auth/register', {
        method: 'POST',
        body: payload,
        skipAuthRefresh: true,
    });
}
export function loginUser(payload) {
    return apiRequest('/auth/login', {
        method: 'POST',
        body: payload,
        skipAuthRefresh: true,
    });
}
export function fetchCurrentUser(token, options) {
    return apiRequest('/auth/me', {
        token,
        skipLoading: options?.skipLoading,
        skipAuthRefresh: options?.skipAuthRefresh,
    });
}
export function fetchNicknameSuggestion() {
    return apiRequest('/auth/nickname', {
        skipAuthRefresh: true,
    });
}
export function guestLogin() {
    return apiRequest('/auth/guest', {
        method: 'POST',
        skipAuthRefresh: true,
    });
}
export function requestEmailVerification(token) {
    return apiRequest('/auth/verify-email/request', {
        method: 'POST',
        token,
    });
}
export function verifyEmail(tokenValue) {
    return apiRequest('/auth/verify-email', {
        method: 'POST',
        body: { token: tokenValue },
        skipAuthRefresh: true,
    });
}
export function forgotPassword(email) {
    return apiRequest('/auth/forgot-password', {
        method: 'POST',
        body: { email },
        skipAuthRefresh: true,
    });
}
export function resetPassword(tokenValue, password) {
    return apiRequest('/auth/reset-password', {
        method: 'POST',
        body: { token: tokenValue, password },
        skipAuthRefresh: true,
    });
}
export { logoutUser, refreshAuthTokens } from '@/services/auth/token-refresh';
