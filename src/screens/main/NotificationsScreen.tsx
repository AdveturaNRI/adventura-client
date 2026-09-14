import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useIsDesktopSidebarVisible } from '@/components/navigation/DesktopThemeToggle';
import { MobileScreenHeader } from '@/components/navigation/MobileScreenHeader';
import { ScreenTransition } from '@/components/navigation/ScreenTransition';
import { NotificationCard, toast } from '@/components/ui';
import { FontSize, type ThemeColors } from '@/constants/theme';
import { useRealtime } from '@/context/RealtimeContext';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import {
  deleteNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type PortalNotification,
} from '@/services/notifications/notificationsApi';
import { openConversationWith } from '@/services/chats/chatsApi';
import { upsertWandererReaction } from '@/services/profile/wanderersApi';
import { localizeErrorMessage } from '@/utils/localizeError';

import { useNotificationsScreenStyles } from './notifications-screen.styles';

function createExtraStyles(colors: ThemeColors) {
  return StyleSheet.create({
    empty: {
      fontSize: FontSize.label,
      color: colors.textMuted,
    },
  });
}

function formatTimestamp(iso: string) {
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function NotificationsScreen() {
  const styles = useNotificationsScreenStyles();
  const extra = useThemedStyles(createExtraStyles);
  const router = useRouter();
  const hasDesktopSidebar = useIsDesktopSidebarVisible();
  const showCompactNav = !hasDesktopSidebar;
  const { lastNotification, setUnreadNotifications, publishConversationUpdate } = useRealtime();
  const [items, setItems] = useState<PortalNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const next = await listNotifications();
      setItems(next);
      const unread = next.filter((item) => !item.readAt).length;
      if (unread > 0) {
        await markAllNotificationsRead();
        setItems((prev) =>
          prev.map((item) =>
            item.readAt ? item : { ...item, readAt: new Date().toISOString() },
          ),
        );
      }
      setUnreadNotifications(0);
    } catch (error) {
      toast.error(localizeErrorMessage(error, 'Не удалось загрузить уведомления'));
    } finally {
      setLoading(false);
    }
  }, [setUnreadNotifications]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (!lastNotification) {
      return;
    }
    setItems((prev) => {
      const without = prev.filter((item) => item.id !== lastNotification.id);
      return [lastNotification, ...without];
    });
  }, [lastNotification]);

  const handleAddBack = useCallback(
    async (notification: PortalNotification) => {
      try {
        await upsertWandererReaction(notification.actor.id, 'favorite');
        if (!notification.readAt) {
          await markNotificationRead(notification.id);
        }
        setItems((prev) =>
          prev.map((item) =>
            item.id === notification.id
              ? { ...item, canAddBack: false, readAt: item.readAt ?? new Date().toISOString() }
              : item,
          ),
        );
        try {
          const conversation = await openConversationWith(notification.actor.id);
          publishConversationUpdate({ ...conversation, isFavorite: true });
        } catch {
          // Chat list will catch up via realtime / next focus load.
        }
        toast.success('Добавлен в избранные');
      } catch (error) {
        toast.error(localizeErrorMessage(error, 'Не удалось добавить в избранные'));
      }
    },
    [publishConversationUpdate],
  );

  const handleDelete = useCallback(async (notification: PortalNotification) => {
    try {
      await deleteNotification(notification.id);
      setItems((prev) => prev.filter((item) => item.id !== notification.id));
    } catch (error) {
      toast.error(localizeErrorMessage(error, 'Не удалось удалить уведомление'));
    }
  }, []);

  const confirmDelete = useCallback(
    (notification: PortalNotification) => {
      const run = () => {
        void handleDelete(notification);
      };

      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.confirm('Удалить уведомление?')) {
          run();
        }
        return;
      }

      Alert.alert('Удалить уведомление?', 'Его нельзя будет восстановить.', [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Удалить', style: 'destructive', onPress: run },
      ]);
    },
    [handleDelete],
  );

  const openActorProfile = useCallback(
    (notification: PortalNotification) => {
      const userId = notification.actor?.id?.trim();
      if (!userId) {
        return;
      }
      router.push(`/users/${userId}`);
    },
    [router],
  );

  return (
    <ScreenTransition animateOnFocus>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {showCompactNav ? (
          <MobileScreenHeader title="Уведомления" showBack />
        ) : (
          <Text style={styles.title}>Уведомления</Text>
        )}

        {loading ? (
          <View style={{ paddingVertical: 32, alignItems: 'center' }}>
            <ActivityIndicator />
          </View>
        ) : items.length === 0 ? (
          <Text style={extra.empty}>Пока нет уведомлений</Text>
        ) : (
          items.map((item) => (
            <NotificationCard
              key={item.id}
              actorName={item.actor.nickname}
              actorAvatarUrl={item.actor.avatarUrl}
              actionText={item.actionText}
              messageText={item.messageText}
              subject={item.subject || undefined}
              timestamp={formatTimestamp(item.updatedAt)}
              unread={!item.readAt}
              variant={
                item.type === 'favorite_returned'
                  ? 'returned'
                  : item.type === 'favorite_received'
                    ? 'favorite'
                    : item.type === 'game_application_accepted'
                      ? 'returned'
                      : 'default'
              }
              buttonLabel={item.canAddBack ? 'Добавить в ответ' : undefined}
              onButtonPress={
                item.canAddBack ? () => void handleAddBack(item) : undefined
              }
              onDeletePress={() => confirmDelete(item)}
              onActorPress={() => openActorProfile(item)}
            />
          ))
        )}
      </ScrollView>
    </ScreenTransition>
  );
}
