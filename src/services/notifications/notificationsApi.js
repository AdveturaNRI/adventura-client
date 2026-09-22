import { apiRequest } from '@/services/api/client';
export function listNotifications() {
    return apiRequest('/notifications');
}
export function getNotificationsUnreadCount() {
    return apiRequest('/notifications/unread-count', {
        skipLoading: true,
    });
}
export function markNotificationRead(id) {
    return apiRequest(`/notifications/${id}/read`, {
        method: 'POST',
        skipLoading: true,
    });
}
export function markAllNotificationsRead() {
    return apiRequest('/notifications/read', {
        method: 'POST',
        skipLoading: true,
    });
}
export function deleteNotification(id) {
    return apiRequest(`/notifications/${id}`, {
        method: 'DELETE',
        skipLoading: true,
    });
}
