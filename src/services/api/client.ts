import { Platform } from 'react-native';

import { API_BASE_URL } from '@/constants/api.config';
import { ApiError } from '@/services/api/api-error';
import type { ApiErrorBody } from '@/services/api/types';
import { refreshAuthTokens } from '@/services/auth/token-refresh';
import { withLoading } from '@/services/api/loading-tracker';
import { getStoredToken } from '@/utils/auth-storage';
import { localizeErrorMessage } from '@/utils/localizeError';

function getErrorMessage(body: ApiErrorBody, fallback: string): string {
  if (Array.isArray(body.message)) {
    return body.message[0] ?? fallback;
  }

  if (typeof body.message === 'string' && body.message.length > 0) {
    return body.message;
  }

  return fallback;
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
  /** Public endpoints must not send a stale bearer token. */
  skipAuth?: boolean;
  skipAuthRefresh?: boolean;
  skipLoading?: boolean;
  _retry?: boolean;
};

async function performRequest<T>(
  path: string,
  { method = 'GET', body, token }: RequestOptions,
): Promise<{ response: Response; payload: T | ApiErrorBody | null }> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      // Avoid empty 304 bodies that break JSON clients on some proxies/caches.
      cache: method === 'GET' ? 'no-store' : 'default',
    });
  } catch (error) {
    throw new ApiError(
      localizeErrorMessage(
        error,
        'Не удалось подключиться к серверу. Проверьте, что API запущен.',
      ),
      0,
    );
  }

  const text = await response.text();

  let payload: T | ApiErrorBody | null = null;

  if (text) {
    try {
      payload = JSON.parse(text) as T | ApiErrorBody;
    } catch {
      throw new ApiError('Сервер вернул некорректный ответ', response.status);
    }
  }

  return { response, payload };
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const task = executeApiRequest<T>(path, options);
  const method = options.method ?? 'GET';
  // Reads stay silent — screens own their loaders. Mutations use the global overlay unless opted out.
  const skipLoading = options.skipLoading ?? method === 'GET';

  if (skipLoading) {
    return task;
  }

  return withLoading(task);
}

async function executeApiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const token = options.skipAuth ? null : options.token ?? (await getStoredToken());

  let response: Response;
  let payload: T | ApiErrorBody | null;

  try {
    ({ response, payload } = await performRequest<T>(path, {
      ...options,
      token,
    }));
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(localizeErrorMessage(error), 0);
  }

  if (
    response.status === 401 &&
    !options.skipAuthRefresh &&
    !options._retry
  ) {
    const refreshed = await refreshAuthTokens();

    if (refreshed) {
      return executeApiRequest<T>(path, {
        ...options,
        token: refreshed.accessToken,
        _retry: true,
      });
    }
  }

  if (!response.ok) {
    const errorBody = (payload ?? {}) as ApiErrorBody;
    throw new ApiError(
      getErrorMessage(errorBody, 'Не удалось выполнить запрос'),
      response.status,
    );
  }

  return payload as T;
}

type UploadOptions = {
  fileName?: string;
  mimeType?: string;
  token?: string | null;
  skipAuthRefresh?: boolean;
  skipLoading?: boolean;
  _retry?: boolean;
};

async function buildUploadFormData(
  fieldName: string,
  fileUri: string,
  options: Pick<UploadOptions, 'fileName' | 'mimeType'>,
): Promise<FormData> {
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
  } as unknown as Blob);

  return formData;
}

export async function apiUpload<T>(
  path: string,
  fieldName: string,
  fileUri: string,
  options: UploadOptions = {},
): Promise<T> {
  const task = executeApiUpload<T>(path, fieldName, fileUri, options);

  if (options.skipLoading) {
    return task;
  }

  return withLoading(task);
}

async function executeApiUpload<T>(
  path: string,
  fieldName: string,
  fileUri: string,
  options: UploadOptions = {},
): Promise<T> {
  const token = options.token ?? (await getStoredToken());
  const formData = await buildUploadFormData(fieldName, fileUri, options);

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers,
      body: formData,
    });
  } catch (error) {
    throw new ApiError(
      localizeErrorMessage(
        error,
        'Не удалось подключиться к серверу. Проверьте, что API запущен.',
      ),
      0,
    );
  }

  const text = await response.text();
  let payload: T | ApiErrorBody | null = null;

  if (text) {
    try {
      payload = JSON.parse(text) as T | ApiErrorBody;
    } catch {
      throw new ApiError('Сервер вернул некорректный ответ', response.status);
    }
  }

  if (
    response.status === 401 &&
    !options.skipAuthRefresh &&
    !options._retry
  ) {
    const refreshed = await refreshAuthTokens();

    if (refreshed) {
      return executeApiUpload<T>(path, fieldName, fileUri, {
        ...options,
        token: refreshed.accessToken,
        _retry: true,
      });
    }
  }

  if (!response.ok) {
    const errorBody = (payload ?? {}) as ApiErrorBody;
    throw new ApiError(
      getErrorMessage(errorBody, 'Не удалось загрузить файл'),
      response.status,
    );
  }

  return payload as T;
}

type MultipartOptions = {
  token?: string | null;
  skipAuthRefresh?: boolean;
  skipLoading?: boolean;
  _retry?: boolean;
};

export async function apiMultipart<T>(
  path: string,
  formData: FormData,
  options: MultipartOptions = {},
): Promise<T> {
  const task = executeApiMultipart<T>(path, formData, options);

  if (options.skipLoading) {
    return task;
  }

  return withLoading(task);
}

async function executeApiMultipart<T>(
  path: string,
  formData: FormData,
  options: MultipartOptions = {},
): Promise<T> {
  const token = options.token ?? (await getStoredToken());

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers,
      body: formData,
    });
  } catch (error) {
    throw new ApiError(
      localizeErrorMessage(
        error,
        'Не удалось подключиться к серверу. Проверьте, что API запущен.',
      ),
      0,
    );
  }

  const text = await response.text();
  let payload: T | ApiErrorBody | null = null;

  if (text) {
    try {
      payload = JSON.parse(text) as T | ApiErrorBody;
    } catch {
      throw new ApiError('Сервер вернул некорректный ответ', response.status);
    }
  }

  if (response.status === 401 && !options.skipAuthRefresh && !options._retry) {
    const refreshed = await refreshAuthTokens();

    if (refreshed) {
      return executeApiMultipart<T>(path, formData, {
        ...options,
        token: refreshed.accessToken,
        _retry: true,
      });
    }
  }

  if (!response.ok) {
    const errorBody = (payload ?? {}) as ApiErrorBody;
    throw new ApiError(
      getErrorMessage(errorBody, 'Не удалось выполнить запрос'),
      response.status,
    );
  }

  return payload as T;
}
