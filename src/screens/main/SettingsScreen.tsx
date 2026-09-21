import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Ionicons } from '@expo/vector-icons';

import { ThemeToggle, useIsDesktopSidebarVisible } from '@/components/navigation/DesktopThemeToggle';
import { MobileScreenHeader } from '@/components/navigation/MobileScreenHeader';
import { ScreenTransition } from '@/components/navigation/ScreenTransition';
import { VoiceDevicesSettingsSection } from '@/components/settings/VoiceDevicesSettingsSection';
import { toast } from '@/components/ui';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { usePushPrompt } from '@/context/PushPromptContext';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import {
  disableWebPush,
  enableWebPush,
  fetchPushStatusForThisDevice,
  getNotificationPermission,
  isIosSafariNeedPwaHint,
  isWebPushSupported,
  WEB_PUSH_OPT_IN_ENABLED,
} from '@/services/push/webPush';
import { localizeErrorMessage } from '@/utils/localizeError';

import { useMainScreenStyles } from './main-screen.styles';

function createSettingsStyles(colors: ThemeColors) {
  return StyleSheet.create({
    scrollContent: {
      paddingBottom: Spacing.xl,
      gap: Spacing.md,
      flexGrow: 1,
    },
    section: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    sectionGap: {
      marginTop: 0,
    },
    alertCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.destructive,
      backgroundColor: 'rgba(255, 59, 48, 0.12)',
      padding: Spacing.md,
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    alertTitle: {
      fontSize: FontSize.button,
      fontWeight: '700',
      color: colors.destructive,
    },
    alertBody: {
      fontSize: FontSize.caption,
      color: colors.text,
      lineHeight: FontSize.caption * 1.45,
    },
    alertButton: {
      alignSelf: 'flex-start',
      marginTop: Spacing.xs,
      minHeight: 36,
      paddingHorizontal: Spacing.md,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.destructive,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    alertButtonPressed: {
      opacity: 0.85,
    },
    alertButtonLabel: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.destructive,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.md,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
    },
    rowText: {
      flex: 1,
      gap: 4,
    },
    rowTitle: {
      fontSize: FontSize.button,
      fontWeight: '600',
      color: colors.text,
    },
    rowTitleWithIcon: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    rowSubtitle: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.45,
    },
    sectionIconWell: {
      width: 28,
      height: 28,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
    },
    hint: {
      marginTop: Spacing.sm,
      marginBottom: Spacing.md,
      paddingHorizontal: Spacing.lg,
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.45,
    },
    hintAccent: {
      marginTop: Spacing.sm,
      marginBottom: Spacing.md,
      paddingHorizontal: Spacing.lg,
      fontSize: FontSize.caption,
      color: colors.primary,
      lineHeight: FontSize.caption * 1.45,
      fontWeight: '600',
    },
  });
}

export default function SettingsScreen() {
  const mainStyles = useMainScreenStyles();
  const styles = useThemedStyles(createSettingsStyles);
  const colors = useTheme();
  const hasDesktopSidebar = useIsDesktopSidebarVisible();
  const showCompactNav = !hasDesktopSidebar;
  const {
    showSettingsAlert,
    dismissSettingsAlert,
    notifyPushEnabled,
    refreshPushAttention,
  } = usePushPrompt();

  const webPushAvailable = WEB_PUSH_OPT_IN_ENABLED && isWebPushSupported();
  const iosHint = WEB_PUSH_OPT_IN_ENABLED && isIosSafariNeedPwaHint();
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(webPushAvailable);
  const [pushBusy, setPushBusy] = useState(false);
  const [permission, setPermission] = useState(getNotificationPermission());

  const refreshPushState = useCallback(async () => {
    if (!webPushAvailable) {
      setPushLoading(false);
      return;
    }
    setPushLoading(true);
    try {
      setPermission(getNotificationPermission());
      const subscribed = await fetchPushStatusForThisDevice();
      const enabled = subscribed && getNotificationPermission() === 'granted';
      setPushEnabled(enabled);
      if (enabled) {
        notifyPushEnabled();
      } else {
        refreshPushAttention();
      }
    } catch {
      setPushEnabled(false);
      refreshPushAttention();
    } finally {
      setPushLoading(false);
    }
  }, [notifyPushEnabled, refreshPushAttention, webPushAvailable]);

  useEffect(() => {
    void refreshPushState();
  }, [refreshPushState]);

  useFocusEffect(
    useCallback(() => {
      void refreshPushState();
    }, [refreshPushState]),
  );

  const handleTogglePush = useCallback(
    (next: boolean) => {
      if (!WEB_PUSH_OPT_IN_ENABLED || pushBusy || Platform.OS !== 'web') {
        return;
      }
      void (async () => {
        setPushBusy(true);
        try {
          if (next) {
            // enableWebPush calls Notification.requestPermission() first (user gesture).
            const result = await enableWebPush();
            setPermission(getNotificationPermission());
            if (result.ok) {
              setPushEnabled(true);
              notifyPushEnabled();
              toast.success('Уведомления включены');
              return;
            }
            setPushEnabled(false);
            refreshPushAttention();
            if (result.reason === 'denied') {
              toast.info('Разрешите уведомления в настройках браузера');
              return;
            }
            if (result.reason === 'ios_pwa') {
              toast.info('На iPhone пуши работают, если сайт добавлен на домашний экран.');
              return;
            }
            if (result.reason === 'server_disabled') {
              toast.error('Пуш-уведомления на сервере выключены. Попробуйте позже.');
              return;
            }
            if (result.reason === 'subscribe_failed') {
              toast.error('Браузер не смог оформить подписку на уведомления');
              return;
            }
            toast.error('Не удалось включить уведомления');
            return;
          }

          await disableWebPush();
          setPushEnabled(false);
          refreshPushAttention();
          toast.info('Уведомления на этом устройстве выключены');
        } catch (error) {
          toast.error(localizeErrorMessage(error, 'Не удалось изменить уведомления'));
          await refreshPushState();
        } finally {
          setPushBusy(false);
        }
      })();
    },
    [notifyPushEnabled, pushBusy, refreshPushAttention, refreshPushState],
  );

  const handleKeepDisabled = useCallback(() => {
    dismissSettingsAlert();
    toast.info('Ок, напоминание скрыто. Включить можно в любой момент ниже.');
  }, [dismissSettingsAlert]);

  return (
    <ScreenTransition animateOnFocus>
      <View style={mainStyles.container}>
        {showCompactNav ? (
          <MobileScreenHeader title="Настройки" showBack />
        ) : (
          <Text style={mainStyles.title}>Настройки</Text>
        )}

        <ScrollView
          style={mainStyles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {WEB_PUSH_OPT_IN_ENABLED && Platform.OS === 'web' && showSettingsAlert ? (
            <View style={styles.alertCard}>
              <Text style={styles.alertTitle}>Уведомления выключены</Text>
              <Text style={styles.alertBody}>
                Без пушей можно пропустить заявки на игры и сообщения в чатах, пока сайт закрыт.
              </Text>
              <Pressable
                style={({ pressed }) => [
                  styles.alertButton,
                  pressed ? styles.alertButtonPressed : null,
                ]}
                onPress={handleKeepDisabled}
                accessibilityRole="button">
                <Text style={styles.alertButtonLabel}>Оставить выключенными</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.section}>
            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Тема оформления</Text>
                <Text style={styles.rowSubtitle}>Светлая или тёмная тема приложения</Text>
              </View>
              <ThemeToggle />
            </View>
          </View>

          {WEB_PUSH_OPT_IN_ENABLED && Platform.OS === 'web' ? (
            <View style={[styles.section, styles.sectionGap]}>
              <View style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>Браузерные уведомления на этом устройстве</Text>
                  <Text style={styles.rowSubtitle}>
                    Заявки на игры и новые сообщения, даже когда вкладка закрыта
                  </Text>
                </View>
                {pushLoading ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Switch
                    value={pushEnabled}
                    onValueChange={handleTogglePush}
                    disabled={pushBusy || iosHint || !webPushAvailable}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor="#FFFFFF"
                    // @ts-expect-error RN-web: on-state uses activeThumbColor (defaults to Material teal)
                    activeThumbColor="#FFFFFF"
                    ios_backgroundColor={colors.border}
                  />
                )}
              </View>
              {iosHint ? (
                <Text style={styles.hintAccent}>
                  На iPhone пуши работают, если сайт добавлен на домашний экран.
                </Text>
              ) : null}
              {!iosHint && permission === 'denied' ? (
                <Text style={styles.hint}>
                  Разрешение заблокировано. Включите уведомления в настройках браузера для этого
                  сайта.
                </Text>
              ) : null}
              {!webPushAvailable && !iosHint ? (
                <Text style={styles.hint}>Этот браузер не поддерживает веб-пуши.</Text>
              ) : null}
            </View>
          ) : null}

          <View style={[styles.section, styles.sectionGap]}>
            <View style={styles.row}>
              <View style={styles.rowText}>
                <View style={styles.rowTitleWithIcon}>
                  <View style={styles.sectionIconWell}>
                    <Ionicons name="volume-high" size={16} color={colors.primary} />
                  </View>
                  <Text style={styles.rowTitle}>Звук и микрофон</Text>
                </View>
                <Text style={styles.rowSubtitle}>
                  Микрофон и динамики для звонков, плюс проверка перед входом в голос
                </Text>
              </View>
            </View>
            <VoiceDevicesSettingsSection />
          </View>
        </ScrollView>
      </View>
    </ScreenTransition>
  );
}
