import { usePathname, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { toast } from '@/components/ui/feedback/toast';
import { useAuth } from '@/context/AuthContext';
import { useRealtimeOptional } from '@/context/RealtimeContext';
import {
  getChatMessageToastCopy,
  getChatMessageToastVariant,
  getPortalNotificationCopy,
  getPortalNotificationToastVariant,
  shouldToastPortalNotification,
} from '@/utils/portal-notification-copy';
import { getPortalNotificationHref } from '@/utils/portal-notification-href';

const TOAST_DURATION_MS = 5000;

function isActiveChatThread(pathname: string, conversationId: string) {
  return (
    pathname === `/chats/${conversationId}` ||
    pathname.endsWith(`/chats/${conversationId}`)
  );
}

/**
 * In-app toasts for portal notifications and incoming chat messages.
 */
export function NotificationToastListener() {
  const realtime = useRealtimeOptional();
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isDesktopWeb = useIsDesktopWeb();
  const lastHandledNotificationIdRef = useRef<string | null>(null);
  const lastHandledMessageIdRef = useRef<string | null>(null);
  const pathnameRef = useRef(pathname);
  const userIdRef = useRef(user?.id);

  pathnameRef.current = pathname;
  userIdRef.current = user?.id;

  const lastNotification = realtime?.lastNotification ?? null;
  const lastMessage = realtime?.lastMessage ?? null;
  const alignment = isDesktopWeb ? 'right' : 'center';

  useEffect(() => {
    if (!lastNotification) {
      return;
    }
    if (lastHandledNotificationIdRef.current === lastNotification.id) {
      return;
    }
    lastHandledNotificationIdRef.current = lastNotification.id;

    if (!shouldToastPortalNotification(lastNotification.type)) {
      return;
    }
    if (pathnameRef.current.startsWith('/notifications')) {
      return;
    }

    const { title, body } = getPortalNotificationCopy(lastNotification);
    const variant = getPortalNotificationToastVariant(lastNotification.type);
    const href =
      lastNotification.href?.trim() ||
      getPortalNotificationHref(lastNotification) ||
      '/notifications';

    toast[variant](body, {
      title,
      duration: TOAST_DURATION_MS,
      alignment,
      emphasis: 'alert',
      avatarName: lastNotification.actor.nickname,
      avatarUrl: lastNotification.actor.avatarUrl,
      actionLabel: 'Открыть',
      onAction: () => {
        router.push(href as never);
      },
    });
  }, [lastNotification, alignment, router]);

  useEffect(() => {
    if (!lastMessage) {
      return;
    }
    if (lastHandledMessageIdRef.current === lastMessage.id) {
      return;
    }
    lastHandledMessageIdRef.current = lastMessage.id;

    if (lastMessage.senderId === userIdRef.current) {
      return;
    }
    // Избранные уже приходят портальным notification:new — не дублируем тост.
    if (lastMessage.kind === 'favorite_received') {
      return;
    }
    if (isActiveChatThread(pathnameRef.current, lastMessage.conversationId)) {
      return;
    }
    if (pathnameRef.current.startsWith('/notifications')) {
      return;
    }

    const { title, body } = getChatMessageToastCopy(lastMessage);
    const variant = getChatMessageToastVariant(lastMessage);
    const conversationId = lastMessage.conversationId;
    const sender = lastMessage.sender;

    toast[variant](body, {
      title,
      duration: TOAST_DURATION_MS,
      alignment,
      emphasis: 'chat',
      avatarName: sender?.nickname ?? title,
      avatarUrl: sender?.avatarUrl ?? null,
      actionLabel: 'Открыть',
      onAction: () => {
        router.push(`/chats/${conversationId}`);
      },
    });
  }, [lastMessage, alignment, router]);

  return null;
}
