export function formatUserCardLocation(
  playsOnline: boolean,
  location: string | string[] | null | undefined,
): string {
  const parts: string[] = [];

  if (playsOnline) {
    parts.push('Онлайн');
  }

  const cities = Array.isArray(location)
    ? location.map((item) => item.trim()).filter(Boolean)
    : location?.trim()
      ? location
          .split(/\s*[·|,]\s*/)
          .map((item) => item.trim())
          .filter(Boolean)
      : [];

  parts.push(...cities);

  return parts.length > 0 ? parts.join(', ') : 'Не указано';
}

export function formatUserCardSystems(
  systems: string[],
  readyToLearnNew: boolean,
  openToAnySystem = false,
): string {
  const parts = [...systems];

  if (openToAnySystem) {
    parts.push('любая система');
  }

  if (readyToLearnNew) {
    parts.push('готов пробовать новое');
  }

  return parts.length > 0 ? parts.join(', ') : 'Не указано';
}

export function formatUserCardVisibility(isPublic: boolean): {
  label: string;
  variant: 'success' | 'visibilityPrivate';
} {
  return isPublic
    ? { label: 'Публичная', variant: 'success' }
    : { label: 'Приватная', variant: 'visibilityPrivate' };
}
