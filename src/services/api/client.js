import { Platform } from 'react-native';
import { API_BASE_URL } from '@/constants/api.config';
import { ApiError } from '@/services/api/api-error';
import { refreshAuthTokens } from '@/services/auth/token-refresh';
import { withLoading } from '@/services/api/loading-tracker';
import { getStoredToken } from '@/utils/auth-storage';
import { localizeErrorMessage } from '@/utils/localizeError';
function getErrorMessage(body, fallback) {
    if (Array.isArray(body.message)) {
        return body.message[0] ?? fallback;
    }
    if (typeof body.message === 'string' && body.message.length > 0) {
        return body.message;
    }
    return fallback;
}
async function performRequest(path, { method = 'GET', body, token }) {
    const headers = {
        Accept: 'application/json',
    };
    if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
    }
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }
    let response;
    try {
        response = await fetch(`${API_BASE_URL}${path}`, {
            method,
            headers,
            body: body !== undefined ? JSON.stringify(body) : undefined,
            // Avoid empty 304 bodies that break JSON clients on some proxies/caches.
            cache: method === 'GET' ? 'no-store' : 'default',
        });
    }
    catch (error) {
        throw new ApiError(localizeErrorMessage(error, 'Не удалось подключиться к серверу. Проверьте, что API запущен.'), 0);
    }
    const text = await response.text();
    let payload = null;
    if (text) {
        try {
            payload = JSON.parse(text);
        }
        catch {
            throw new ApiError('Сервер вернул некорректный ответ', response.status);
        }
    }
    return { response, payload };
}
export async function apiRequest(path, options = {}) {
    const task = executeApiRequest(path, options);
    if (options.skipLoading) {
        return task;
    }
    return withLoading(task);
}
async function executeApiRequest(path, options = {}) {
    const token = options.token ?? (await getStoredToken());
    let response;
    let payload;
    try {
        ({ response, payload } = await performRequest(path, {
            ...options,
            token,
        }));
    }
    catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        throw new ApiError(localizeErrorMessage(error), 0);
    }
    if (response.status === 401 &&
        !options.skipAuthRefresh &&
        !options._retry) {
        const refreshed = await refreshAuthTokens();
        if (refreshed) {
            return executeApiRequest(path, {
                ...options,
                token: refreshed.accessToken,
                _retry: true,
            });
        }
    }
    if (!response.ok) {
        const errorBody = (payload ?? {});
        throw new ApiError(getErrorMessage(errorBody, 'Не удалось выполнить запрос'), response.status);
    }
    return payload;
}
async function buildUploadFormData(fieldName, fileUri, options) {
    const formData = new FormData();
    const fileName = options.fileName ?? 'image.jpg';
    const mimeType = options.mimeType ?? 'image/jpeg';
    if (Platform.OS === 'web') {
        const response = await fetch(fileUri);
        const blob = await response.blob();
        formData.append(fieldName, blob, fileName);
        return formData;
    }
    formData.append(fieldName, {
        uri: fileUri,
        name: fileName,
        type: mimeType,
    });
    return formData;
}
export async function apiUpload(path, fieldName, fileUri, options = {}) {
    const task = executeApiUpload(path, fieldName, fileUri, options);
    if (options.skipLoading) {
        return task;
    }
    return withLoading(task);
}
async function executeApiUpload(path, fieldName, fileUri, options = {}) {
    const token = options.token ?? (await getStoredToken());
    const formData = await buildUploadFormData(fieldName, fileUri, options);
    const headers = {
        Accept: 'application/json',
    };
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }
    let response;
    try {
        response = await fetch(`${API_BASE_URL}${path}`, {
            method: 'POST',
            headers,
            body: formData,
        });
    }
    catch (error) {
        throw new ApiError(localizeErrorMessage(error, 'Не удалось подключиться к серверу. Проверьте, что API запущен.'), 0);
    }
    const text = await response.text();
    let payload = null;
    if (text) {
        try {
            payload = JSON.parse(text);
        }
        catch {
            throw new ApiError('Сервер вернул некорректный ответ', response.status);
        }
    }
    if (response.status === 401 &&
        !options.skipAuthRefresh &&
        !options._retry) {
        const refreshed = await refreshAuthTokens();
        if (refreshed) {
            return executeApiUpload(path, fieldName, fileUri, {
                ...options,
                token: refreshed.accessToken,
                _retry: true,
            });
        }
    }
    if (!response.ok) {
        const errorBody = (payload ?? {});
        throw new ApiError(getErrorMessage(errorBody, 'Не удалось загрузить файл'), response.status);
    }
    return payload;
}
export async function apiMultipart(path, formData, options = {}) {
    const task = executeApiMultipart(path, formData, options);
    if (options.skipLoading) {
        return task;
    }
    return withLoading(task);
}
async function executeApiMultipart(path, formData, options = {}) {
    const token = options.token ?? (await getStoredToken());
    const headers = {
        Accept: 'application/json',
    };
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }
    let response;
    try {
        response = await fetch(`${API_BASE_URL}${path}`, {
            method: 'POST',
            headers,
            body: formData,
        });
    }
    catch (error) {
        throw new ApiError(localizeErrorMessage(error, 'Не удалось подключиться к серверу. Проверьте, что API запущен.'), 0);
    }
    const text = await response.text();
    let payload = null;
    if (text) {
        try {
            payload = JSON.parse(text);
        }
        catch {
            throw new ApiError('Сервер вернул некорректный ответ', response.status);
        }
    }
    if (response.status === 401 && !options.skipAuthRefresh && !options._retry) {
        const refreshed = await refreshAuthTokens();
        if (refreshed) {
            return executeApiMultipart(path, formData, {
                ...options,
                token: refreshed.accessToken,
                _retry: true,
            });
        }
    }
    if (!response.ok) {
        const errorBody = (payload ?? {});
        throw new ApiError(getErrorMessage(errorBody, 'Не удалось выполнить запрос'), response.status);
    }
    return payload;
}
