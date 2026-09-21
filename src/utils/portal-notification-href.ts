import type { PortalNotification } from '@/services/notifications/notificationsApi';

/**
 * Deep link for a portal notification. Keep in sync with API
 * `resolveNotificationHref` in notifications.service.ts.
 */
export function getPortalNotificationHref(
  notification: Pick<PortalNotification, 'type' | 'refId' | 'actor'>,
): string | null {
  const refId = notification.refId?.trim() || '';
  const actorId = notification.actor?.id?.trim() || '';

  switch (notification.type) {
    case 'game_application':
      return refId ? `/games-manage?id=${encodeURIComponent(refId)}` : '/my-games';
    case 'game_application_accepted':
    case 'game_application_rejected':
    case 'game_player_removed':
      return refId ? `/games/${encodeURIComponent(refId)}` : '/games';
    case 'game_deleted':
      return '/my-games';
    case 'club_deleted':
      return '/my-clubs';
    case 'favorite_received':
    case 'favorite_returned':
      return actorId ? `/users/${encodeURIComponent(actorId)}` : null;
    case 'system_announcement':
      return null;
    default:
      return null;
  }
}
