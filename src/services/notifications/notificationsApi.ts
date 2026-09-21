import { apiRequest } from '@/services/api/client';

export type PortalNotification = {
  id: string;
  type:
    | 'favorite_received'
    | 'favorite_returned'
    | 'game_application'
    | 'game_application_accepted'
    | 'game_application_rejected'
    | 'game_player_removed'
    | 'game_deleted'
    | 'club_deleted'
    | 'system_announcement';
  actor: {
    id: string;
    nickname: string;
    avatarUrl: string | null;
  };
  actionText: string;
  messageText: string;
  subject: string;
  refId?: string;
  /** Deep link to related entity (game, club, user…). */
  href?: string | null;
  canAddBack: boolean;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function listNotifications() {
  return apiRequest<PortalNotification[]>('/notifications');
}

export function getNotificationsUnreadCount() {
  return apiRequest<{ count: number }>('/notifications/unread-count', {
    skipLoading: true,
  });
}

export function markNotificationRead(id: string) {
  return apiRequest<{ ok: true }>(`/notifications/${id}/read`, {
    method: 'POST',
    skipLoading: true,
  });
}

export function markAllNotificationsRead() {
  return apiRequest<{ ok: true }>('/notifications/read', {
    method: 'POST',
    skipLoading: true,
  });
}

export function deleteNotification(id: string) {
  return apiRequest<{ ok: true }>(`/notifications/${id}`, {
    method: 'DELETE',
    skipLoading: true,
  });
}
