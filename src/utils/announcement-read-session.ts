/** One dismiss/mark-read claim per announcement version per app session. */
const readKeys = new Set<string>();

function toKey(id: string, publicationVersion: number) {
  return `${id.trim()}:${publicationVersion}`;
}

/** @returns true if this is the first claim for this version in the session. */
export function claimAnnouncementRead(
  id: string,
  publicationVersion: number,
): boolean {
  const key = toKey(id, publicationVersion);
  if (!id.trim() || publicationVersion < 1 || readKeys.has(key)) return false;
  readKeys.add(key);
  return true;
}

/** Allow retry after a failed dismiss. */
export function releaseAnnouncementRead(
  id: string,
  publicationVersion: number,
): void {
  readKeys.delete(toKey(id, publicationVersion));
}
