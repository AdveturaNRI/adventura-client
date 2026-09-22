import { ApiError } from '@/services/api/api-error';
import { getCachedFileTooLargeMessage } from '@/utils/upload-limits';

const NETWORK_ERROR_PATTERNS = [
  /load failed/i,
  /failed to fetch/i,
  /network request failed/i,
  /networkerror/i,
  /fetch error/i,
  /the internet connection appears to be offline/i,
  /err_connection_refused/i,
  /err_network/i,
  /could not connect/i,
];

const HTTP_STATUS_MESSAGES: Record<number, string> = {
  400: 'Некорректный запрос',
  401: 'Неверный email или пароль',
  403: 'Доступ запрещён',
  404: 'Сервис не найден',
  409: 'Конфликт данных',
  422: 'Ошибка валидации',
  429: 'Слишком много запросов, попробуйте позже',
  500: 'Ошибка на сервере, попробуйте позже',
  502: 'Сервер временно недоступен',
  503: 'Сервис временно недоступен',
};

function getFileTooLargeMessage(): string {
  return getCachedFileTooLargeMessage() ?? 'Файл слишком большой';
}

function isGenericFileTooLargeMessage(message: string): boolean {
  const trimmed = message.trim();

  return (
    trimmed === 'File too large' ||
    trimmed === 'Payload Too Large' ||
    /file too large/i.test(trimmed) ||
    /payload too large/i.test(trimmed)
  );
}

function translateKnownErrorMessage(message: string): string | null {
  if (isGenericFileTooLargeMessage(message)) {
    return getFileTooLargeMessage();
  }
  if (/invalid constraint|overconstrained/i.test(message)) {
    return 'Микрофон не принял настройки захвата. Попробуй ещё раз или выбери другой микрофон в настройках.';
  }
  if (
    /not allowed by the user agent|notallowederror|permission denied|permission dismissed/i.test(
      message,
    )
  ) {
    return 'Браузер заблокировал микрофон. На телефоне открой сайт по HTTPS и разреши доступ сразу при нажатии «Позвонить» / «Ответить».';
  }

  return null;
}

export function localizeErrorMessage(
  error: unknown,
  fallback = 'Не удалось выполнить запрос',
): string {
  if (error instanceof ApiError) {
    if (error.status === 0) {
      return error.message;
    }

    if (error.status === 413) {
      if (error.message && !isGenericFileTooLargeMessage(error.message)) {
        return error.message;
      }

      return getFileTooLargeMessage();
    }

    const translated = translateKnownErrorMessage(error.message);
    if (translated) {
      return translated;
    }

    if (error.message && error.message !== fallback) {
      return error.message;
    }

    return HTTP_STATUS_MESSAGES[error.status] ?? fallback;
  }

  if (!(error instanceof Error)) {
    return fallback;
  }

  const message = error.message.trim();
  if (!message) {
    return fallback;
  }

  if (NETWORK_ERROR_PATTERNS.some((pattern) => pattern.test(message))) {
    return 'Не удалось подключиться к серверу. Проверьте, что API запущен.';
  }

  if (/unexpected token|json/i.test(message)) {
    return 'Сервер вернул некорректный ответ';
  }

  const translated = translateKnownErrorMessage(message);
  if (translated) {
    return translated;
  }

  return message;
}

export function isNetworkError(error: unknown): boolean {
  if (error instanceof ApiError && error.status === 0) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return NETWORK_ERROR_PATTERNS.some((pattern) => pattern.test(error.message));
}
