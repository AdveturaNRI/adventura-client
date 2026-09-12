export const MAX_GAME_SYSTEM_NAME_LENGTH = 60;

export function matchesGameSystemSearch(value: string, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return value.toLowerCase().includes(normalizedQuery);
}

export function normalizeGameSystemName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '');
}

export function findCatalogSystemMatch(name: string, catalogNames: string[]): string | null {
  const normalized = normalizeGameSystemName(name);

  return catalogNames.find((catalogName) => normalizeGameSystemName(catalogName) === normalized) ?? null;
}

export function isGameSystemAlreadySelected(name: string, selectedNames: string[]): boolean {
  const normalized = normalizeGameSystemName(name);

  return selectedNames.some((selectedName) => normalizeGameSystemName(selectedName) === normalized);
}

export type CustomSystemValidationResult =
  | { ok: true; name: string }
  | { ok: false; error: string };

export function validateCustomGameSystemName(
  rawName: string,
  catalogNames: string[],
  selectedNames: string[],
  existingUserSystemNames: string[] = [],
): CustomSystemValidationResult {
  const trimmed = rawName.trim();

  if (!trimmed) {
    return { ok: false, error: 'Введите название системы' };
  }

  if (trimmed.length > MAX_GAME_SYSTEM_NAME_LENGTH) {
    return { ok: false, error: 'Слишком длинное название' };
  }

  const catalogMatch = findCatalogSystemMatch(trimmed, catalogNames);

  if (catalogMatch) {
    if (isGameSystemAlreadySelected(catalogMatch, selectedNames)) {
      return { ok: false, error: 'Эта система уже добавлена' };
    }

    return { ok: true, name: catalogMatch };
  }

  const knownNames = [...selectedNames, ...existingUserSystemNames];

  if (isGameSystemAlreadySelected(trimmed, knownNames)) {
    return { ok: false, error: 'Эта система уже добавлена' };
  }

  return { ok: true, name: trimmed };
}
