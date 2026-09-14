/** Formats an unread count for nav badges (`99+` when over the cap). */
export function formatUnreadBadge(count: number, cap = 99): string {
  if (count <= 0) {
    return '';
  }
  if (count > cap) {
    return `${cap}+`;
  }
  return String(count);
}
