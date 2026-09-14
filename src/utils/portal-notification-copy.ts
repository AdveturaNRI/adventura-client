import type { PortalNotification } from '@/services/notifications/notificationsApi';

export type PortalNotificationCopy = {
  title: string;
  body: string;
};

/** Types that deserve an in-app toast while the user is online. */
export const CRITICAL_PORTAL_NOTIFICATION_TYPES: ReadonlySet<PortalNotification['type']> =
  new Set([
    'game_application',
    'game_application_accepted',
    'game_application_rejected',
    'game_player_removed',
  ]);

export function isCriticalPortalNotification(type: PortalNotification['type']): boolean {
  return CRITICAL_PORTAL_NOTIFICATION_TYPES.has(type);
}

export function getPortalNotificationCopy(
  notification: Pick<PortalNotification, 'type' | 'actor' | 'subject'> & {
    actorName?: string;
  },
): PortalNotificationCopy {
  const actorName = notification.actorName ?? notification.actor?.nickname;
  const subject = notification.subject;

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
        title: 'Новое уведомление',
        body: actorName ? `${actorName} добавил вас в избранные` : 'Вас добавили в избранные',
      };
    default:
      return {
        title: 'Новое уведомление',
        body: actorName ? `${actorName}` : 'У вас новое событие',
      };
  }
}
