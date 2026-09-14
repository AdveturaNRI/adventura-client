import { usePathname, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { toast } from '@/components/ui/feedback/toast';
import { useRealtimeOptional } from '@/context/RealtimeContext';
import {
  getPortalNotificationCopy,
  isCriticalPortalNotification,
} from '@/utils/portal-notification-copy';

const TOAST_DURATION_MS = 4500;

/**
 * Shows an interactive in-app toast for critical portal notifications
 * (game applications and related events) while the user is online.
 */
export function NotificationToastListener() {
  const realtime = useRealtimeOptional();
  const pathname = usePathname();
  const router = useRouter();
  const isDesktopWeb = useIsDesktopWeb();
  const lastHandledIdRef = useRef<string | null>(null);

  const lastNotification = realtime?.lastNotification ?? null;

  useEffect(() => {
    if (!lastNotification) {
      return;
    }
    if (lastHandledIdRef.current === lastNotification.id) {
      return;
    }
    lastHandledIdRef.current = lastNotification.id;

    if (!isCriticalPortalNotification(lastNotification.type)) {
      return;
    }
    if (pathname.startsWith('/notifications')) {
      return;
    }

    const { title, body } = getPortalNotificationCopy(lastNotification);

    toast.info(body, {
      title,
      duration: TOAST_DURATION_MS,
      alignment: isDesktopWeb ? 'right' : 'center',
      actionLabel: 'Открыть',
      onAction: () => {
        router.push('/notifications');
      },
    });
  }, [lastNotification, pathname, isDesktopWeb, router]);

  return null;
}
