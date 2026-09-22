import { diceRollPreviewText, parseDiceRollPayload } from '@/utils/chat-dice-roll';
/** Portal events that should surface as an in-app toast. */
export const TOAST_PORTAL_NOTIFICATION_TYPES = new Set([
    'favorite_received',
    'favorite_returned',
    'game_application',
    'game_application_accepted',
    'game_application_rejected',
    'game_player_removed',
    'system_announcement',
]);
export function shouldToastPortalNotification(type) {
    return TOAST_PORTAL_NOTIFICATION_TYPES.has(type);
}
export function getPortalNotificationToastVariant(type) {
    switch (type) {
        case 'game_application_rejected':
        case 'game_player_removed':
            return 'warning';
        case 'game_application_accepted':
        case 'favorite_received':
        case 'favorite_returned':
            return 'success';
        default:
            return 'info';
    }
}
export function getPortalNotificationCopy(notification) {
    const actorName = notification.actorName ?? notification.actor?.nickname;
    const subject = notification.subject;
    const actionText = notification.actionText?.trim();
    const messageText = notification.messageText?.trim();
    if (notification.type === 'system_announcement') {
        return {
            title: subject?.trim() || 'Adventura',
            body: messageText || subject?.trim() || 'Новое объявление',
        };
    }
    if (actionText || messageText) {
        return {
            title: actionText || 'Новое уведомление',
            body: messageText ||
                (actorName && subject
                    ? `${actorName} · ${subject}`
                    : actorName || subject || 'Откройте список уведомлений'),
        };
    }
    switch (notification.type) {
        case 'favorite_returned':
            return {
                title: 'Вас добавили в избранные',
                body: actorName
                    ? `${actorName} добавил вас в избранные в ответ`
                    : 'Вас добавили в избранные в ответ',
            };
        case 'game_application':
            return {
                title: 'Новая заявка на игру',
                body: actorName
                    ? `${actorName} подал заявку${subject ? ` на «${subject}»` : ''}`
                    : subject
                        ? `Заявка на «${subject}»`
                        : 'Кто-то подал заявку на ваш стол',
            };
        case 'game_application_accepted':
            return {
                title: 'Вас приняли за стол',
                body: subject
                    ? actorName
                        ? `${actorName} принял вас на «${subject}»`
                        : `Вас приняли на «${subject}»`
                    : actorName
                        ? `${actorName} принял вашу заявку`
                        : 'Мастер принял вашу заявку',
            };
        case 'game_application_rejected':
            return {
                title: 'Заявку отклонили',
                body: subject
                    ? actorName
                        ? `${actorName} отклонил заявку на «${subject}»`
                        : `Заявку на «${subject}» отклонили`
                    : actorName
                        ? `${actorName} отклонил вашу заявку`
                        : 'Мастер отклонил вашу заявку',
            };
        case 'game_player_removed':
            return {
                title: 'Вас убрали из игры',
                body: subject
                    ? actorName
                        ? `${actorName} убрал вас из «${subject}»`
                        : `Вас убрали из «${subject}»`
                    : actorName
                        ? `${actorName} убрал вас из состава`
                        : 'Мастер убрал вас из состава',
            };
        case 'favorite_received':
            return {
                title: 'Вас добавили в избранные',
                body: actorName ? `${actorName} добавил вас в избранные` : 'Вас добавили в избранные',
            };
        default:
            return {
                title: 'Новое уведомление',
                body: actorName ? `${actorName}` : 'У вас новое событие',
            };
    }
}
export function getChatMessageToastCopy(message) {
    const senderName = message.sender?.nickname?.trim() || 'Сообщение';
    const kind = message.kind ?? 'user';
    const body = message.body?.trim() ?? '';
    if (kind === 'game_deleted') {
        return {
            title: 'Игра удалена',
            body: body || 'Чат этой игры больше недоступен',
        };
    }
    if (kind === 'favorite_received') {
        return {
            title: 'В избранных',
            body: body || `${senderName} добавил вас в избранные`,
        };
    }
    if (kind === 'favorite_removed') {
        return {
            title: 'Убрали из избранных',
            body: body || `${senderName} убрал вас из избранных`,
        };
    }
    if (kind === 'user_blocked') {
        return {
            title: 'Блокировка',
            body: body || 'Вас заблокировали',
        };
    }
    if (kind === 'user_unblocked') {
        return {
            title: 'Разблокировка',
            body: body || `${senderName} разблокировал вас`,
        };
    }
    if (kind === 'dice_roll') {
        const payload = parseDiceRollPayload(body);
        return {
            title: senderName,
            body: diceRollPreviewText(payload),
        };
    }
    if (body) {
        return { title: senderName, body };
    }
    const attachmentKind = message.attachment?.kind;
    if (attachmentKind === 'image' || message.image) {
        return { title: senderName, body: 'Фото' };
    }
    if (attachmentKind === 'audio') {
        return { title: senderName, body: 'Аудио' };
    }
    if (attachmentKind === 'file') {
        return { title: senderName, body: message.attachment?.name || 'Файл' };
    }
    return { title: senderName, body: 'Новое сообщение' };
}
export function getChatMessageToastVariant(message) {
    const kind = message.kind ?? 'user';
    if (kind === 'game_deleted' || kind === 'favorite_removed' || kind === 'user_blocked') {
        return 'warning';
    }
    if (kind === 'favorite_received' || kind === 'user_unblocked') {
        return 'success';
    }
    return 'info';
}
