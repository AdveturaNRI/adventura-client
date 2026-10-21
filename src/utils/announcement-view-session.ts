/** One view per announcement id per app session (modal + лента + деталка). */
const viewedIds = new Set<string>();

/** @returns true if this is the first claim for `id` in the session. */
export function claimAnnouncementView(id: string): boolean {
  const key = id.trim();
  if (!key || viewedIds.has(key)) return false;
  viewedIds.add(key);
  return true;
}
