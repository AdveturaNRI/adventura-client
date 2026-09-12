const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NICKNAME_REGEX = /^[^\s@]+$/;
const NICKNAME_MAX_LENGTH = 24;

export function getNicknameError(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return 'Введите никнейм';
  if (trimmed.length < 3) return 'Никнейм должен быть не короче 3 символов';
  if (trimmed.length > NICKNAME_MAX_LENGTH) {
    return `Никнейм должен быть не длиннее ${NICKNAME_MAX_LENGTH} символов`;
  }
  if (!NICKNAME_REGEX.test(trimmed)) {
    return 'Никнейм не должен содержать пробелы или @';
  }
  return undefined;
}

export function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value.trim());
}

export function getEmailError(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return 'Введите email';
  if (!isValidEmail(trimmed)) return 'Некорректный email';
  return undefined;
}

export function getPasswordConfirmError(
  password: string,
  confirm: string,
): string | undefined {
  if (!password) return 'Введите пароль';
  if (password.length < 8) return 'Пароль должен быть не короче 8 символов';
  if (!confirm) return 'Повторите пароль';
  if (password !== confirm) return 'Пароли не совпадают';
  return undefined;
}
