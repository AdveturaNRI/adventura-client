/**
 * Presigned avatar URLs меняют query на каждом ответе API.
 * Если путь объекта тот же — оставляем старый uri, чтобы Image не мигал.
 */
export function stableAvatarUrl(
  prevUrl?: string | null,
  nextUrl?: string | null,
): string | null {
  const prev = prevUrl?.trim() || null;
  const next = nextUrl?.trim() || null;
  if (!prev) {
    return next;
  }
  if (!next) {
    return prev;
  }
  if (prev === next) {
    return prev;
  }
  const prevPath = prev.split('?')[0];
  const nextPath = next.split('?')[0];
  return prevPath === nextPath ? prev : next;
}

export function avatarUrlIdentity(url?: string | null): string | null {
  const trimmed = url?.trim() || null;
  return trimmed ? trimmed.split('?')[0] : null;
}
