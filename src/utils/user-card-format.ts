export function formatUserCardLocation(playsOnline: boolean, location: string): string {
  const parts: string[] = [];

  if (playsOnline) {
    parts.push('Онлайн');
  }

  if (location.trim()) {
    parts.push(location.trim());
  }

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
