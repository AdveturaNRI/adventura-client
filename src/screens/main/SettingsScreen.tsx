import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
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

import { ThemeToggle, useIsDesktopSidebarVisible } from '@/components/navigation/DesktopThemeToggle';
import { MobileScreenHeader } from '@/components/navigation/MobileScreenHeader';
import { ScreenTransition } from '@/components/navigation/ScreenTransition';
import { ChatBackgroundPickerSheet } from '@/components/chats/ChatBackgroundPickerSheet';
import { VoiceDevicesSettingsSection } from '@/components/settings/VoiceDevicesSettingsSection';
import { toast } from '@/components/ui';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { usePushPrompt } from '@/context/PushPromptContext';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import {
  getVkAppId,
  getYandexClientId,
  isOauthWebAvailable,
} from '@/services/auth/oauth-web';
import {
  deleteNotificationSound,
  uploadNotificationSound,
} from '@/services/profile/profileApi';
import {
  disableWebPush,
  enableWebPush,
  fetchPushStatusForThisDevice,
  getNotificationPermission,
  getWebPushBlockReason,
  isIosSafariNeedPwaHint,
  isWebPushSupported,
  WEB_PUSH_OPT_IN_ENABLED,
  webPushBlockHint,
} from '@/services/push/webPush';
import { previewNotificationSound, unlockChatAlerts } from '@/utils/chat-alerts';
import { localizeErrorMessage } from '@/utils/localizeError';
import {
  fetchNotificationSoundPresets,
  hydrateNotificationSoundSettingsFromProfile,
  saveNotificationSoundSettings,
  type NotificationSoundPreset,
  type NotificationSoundSettings,
} from '@/utils/notification-sound-settings';
import {
  getChatBackgroundPreset,
  getGlobalChatBackgroundSync,
  loadGlobalChatBackground,
  subscribeGlobalChatBackground,
  type ChatBackgroundSetting,
} from '@/utils/chat-background-settings';

import { useMainScreenStyles } from './main-screen.styles';

function createSettingsStyles(colors: ThemeColors) {
  return StyleSheet.create({
    section: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    sectionHeader: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.xs,
    },
    sectionHeaderTitle: {
      fontSize: FontSize.button,
      fontWeight: '700',
      color: colors.text,
    },
    sectionHeaderSubtitle: {
      marginTop: 4,
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.45,
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
    rowBorder: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderLight,
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
    presetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm + 2,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderLight,
    },
    presetMain: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      minHeight: 44,
    },
    presetCheck: {
      width: 22,
      alignItems: 'center',
    },
    playButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.background,
    },
    playButtonPressed: {
      opacity: 0.75,
    },
    actionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.md,
      paddingTop: Spacing.xs,
    },
    secondaryButton: {
      minHeight: 36,
      paddingHorizontal: Spacing.md,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    secondaryButtonLabel: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.text,
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
  const { user, linkVk, linkYandex, unlinkOauth } = useAuth();
  const [oauthBusy, setOauthBusy] = useState(false);
  const {
    showSettingsAlert,
    dismissSettingsAlert,
    notifyPushEnabled,
    notifyPushDisabled,
    refreshPushAttention,
  } = usePushPrompt();

  const webPushBlockReason = WEB_PUSH_OPT_IN_ENABLED ? getWebPushBlockReason() : 'unsupported';
  const webPushAvailable = WEB_PUSH_OPT_IN_ENABLED && isWebPushSupported();
  const webPushHint = webPushBlockHint(webPushBlockReason);
  const iosHint = WEB_PUSH_OPT_IN_ENABLED && isIosSafariNeedPwaHint();
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(webPushAvailable);
  const [pushBusy, setPushBusy] = useState(false);
  const [permission, setPermission] = useState(getNotificationPermission());
  const [soundSettings, setSoundSettings] = useState<NotificationSoundSettings>({
    enabled: true,
    presetId: null,
    useCustom: false,
    customUrl: null,
    effectiveUrl: null,
  });
  const [presets, setPresets] = useState<NotificationSoundPreset[]>([]);
  const [soundLoading, setSoundLoading] = useState(true);
  const [soundBusy, setSoundBusy] = useState(false);
  const [chatBg, setChatBg] = useState<ChatBackgroundSetting>(() => getGlobalChatBackgroundSync());
  const [chatBgPickerOpen, setChatBgPickerOpen] = useState(false);

  useEffect(() => {
    void loadGlobalChatBackground().then(setChatBg);
    return subscribeGlobalChatBackground(setChatBg);
  }, []);

  const chatBgSubtitle =
    chatBg.kind === 'default'
      ? 'Системный'
      : chatBg.kind === 'custom'
        ? 'Своё изображение'
        : getChatBackgroundPreset(chatBg.presetId)?.label ?? 'Пресет';

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

  const refreshSoundSettings = useCallback(async () => {
    setSoundLoading(true);
    try {
      const [next, list] = await Promise.all([
        hydrateNotificationSoundSettingsFromProfile(),
        fetchNotificationSoundPresets(),
      ]);
      setSoundSettings(next);
      setPresets(list);
    } finally {
      setSoundLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshPushState();
    void refreshSoundSettings();
  }, [refreshPushState, refreshSoundSettings]);

  useFocusEffect(
    useCallback(() => {
      void refreshPushState();
      void refreshSoundSettings();
    }, [refreshPushState, refreshSoundSettings]),
  );

  const persistSoundSettings = useCallback(
    async (next: NotificationSoundSettings) => {
      setSoundBusy(true);
      setSoundSettings(next);
      try {
        await saveNotificationSoundSettings(next);
      } catch (error) {
        toast.error(localizeErrorMessage(error, 'Не удалось сохранить звук'));
        await refreshSoundSettings();
      } finally {
        setSoundBusy(false);
      }
    },
    [refreshSoundSettings],
  );

  const handleToggleMute = useCallback(
    (enabled: boolean) => {
      if (soundBusy) return;
      unlockChatAlerts();
      void persistSoundSettings({ ...soundSettings, enabled });
    },
    [persistSoundSettings, soundBusy, soundSettings],
  );

  const handleSelectPreset = useCallback(
    (preset: NotificationSoundPreset) => {
      if (soundBusy) return;
      unlockChatAlerts();
      void persistSoundSettings({
        ...soundSettings,
        useCustom: false,
        presetId: preset.id,
        effectiveUrl: preset.url,
      });
    },
    [persistSoundSettings, soundBusy, soundSettings],
  );

  const handleSelectCustom = useCallback(() => {
    if (soundBusy || !soundSettings.customUrl) return;
    unlockChatAlerts();
    void persistSoundSettings({
      ...soundSettings,
      useCustom: true,
      effectiveUrl: soundSettings.customUrl,
    });
  }, [persistSoundSettings, soundBusy, soundSettings]);

  const handlePreviewUrl = useCallback((url: string | null | undefined) => {
    if (!url) {
      toast.info('Нет файла для прослушивания');
      return;
    }
    // Нельзя звать unlockChatAlerts() перед play — warm Audio.play()
    // съедает user gesture и второй play() браузер блокирует.
    previewNotificationSound(url);
  }, []);

  const handleUploadCustom = useCallback(() => {
    if (soundBusy) return;
    void (async () => {
      try {
        const picked = await DocumentPicker.getDocumentAsync({
          type: ['audio/*'],
          copyToCacheDirectory: true,
          multiple: false,
        });
        if (picked.canceled || !picked.assets?.[0]) {
          return;
        }
        const asset = picked.assets[0];
        if (asset.size && asset.size > 256 * 1024) {
          toast.error('Максимум 256 КБ');
          return;
        }
        setSoundBusy(true);
        const profile = await uploadNotificationSound(asset.uri, {
          fileName: asset.name || 'notify.mp3',
          mimeType: asset.mimeType || 'audio/mpeg',
        });
        const next: NotificationSoundSettings = {
          enabled: soundSettings.enabled,
          presetId: profile.notificationSoundPresetId ?? soundSettings.presetId,
          useCustom: true,
          customUrl: profile.customNotificationSoundUrl ?? null,
          effectiveUrl:
            profile.effectiveNotificationSoundUrl ??
            profile.customNotificationSoundUrl ??
            null,
        };
        await saveNotificationSoundSettings(next, { syncRemote: false });
        setSoundSettings(next);
        toast.success('Свой звук загружен — нажми ▶ чтобы послушать');
      } catch (error) {
        toast.error(localizeErrorMessage(error, 'Не удалось загрузить звук'));
      } finally {
        setSoundBusy(false);
      }
    })();
  }, [soundBusy, soundSettings]);

  const handleClearCustom = useCallback(() => {
    if (soundBusy) return;
    void (async () => {
      setSoundBusy(true);
      try {
        const profile = await deleteNotificationSound();
        const preset =
          presets.find((item) => item.id === profile.notificationSoundPresetId) ??
          presets.find((item) => item.isDefault) ??
          presets[0];
        const next: NotificationSoundSettings = {
          enabled: soundSettings.enabled,
          presetId: preset?.id ?? null,
          useCustom: false,
          customUrl: null,
          effectiveUrl: preset?.url ?? profile.effectiveNotificationSoundUrl ?? null,
        };
        await saveNotificationSoundSettings(next, { syncRemote: false });
        setSoundSettings(next);
        toast.info('Свой звук удалён');
      } catch (error) {
        toast.error(localizeErrorMessage(error, 'Не удалось удалить звук'));
      } finally {
        setSoundBusy(false);
      }
    })();
  }, [presets, soundBusy, soundSettings.enabled]);

  const handleTogglePush = useCallback(
    (next: boolean) => {
      if (!WEB_PUSH_OPT_IN_ENABLED || pushBusy || Platform.OS !== 'web') {
        return;
      }
      void (async () => {
        setPushBusy(true);
        try {
          if (next) {
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
            if (result.reason === 'missing_vapid' || result.reason === 'server_disabled') {
              toast.error(
                'Не задан Firebase Web Push VAPID key (FIREBASE_WEB_VAPID_KEY / EXPO_PUBLIC_FIREBASE_VAPID_KEY).',
              );
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
          notifyPushDisabled();
          toast.info('Уведомления на этом устройстве выключены');
        } catch (error) {
          toast.error(localizeErrorMessage(error, 'Не удалось изменить уведомления'));
          await refreshPushState();
        } finally {
          setPushBusy(false);
        }
      })();
    },
    [notifyPushDisabled, notifyPushEnabled, pushBusy, refreshPushAttention, refreshPushState],
  );

  const handleKeepDisabled = useCallback(() => {
    dismissSettingsAlert();
    toast.info('Ок, напоминание скрыто. Включить можно в любой момент ниже.');
  }, [dismissSettingsAlert]);

  return (
    <ScreenTransition animateOnFocus>
      <ScrollView
        style={mainStyles.scroll}
        contentContainerStyle={mainStyles.content}
        keyboardShouldPersistTaps="handled">
        {showCompactNav ? (
          <MobileScreenHeader title="Настройки" showBack />
        ) : (
          <Text style={mainStyles.title}>Настройки</Text>
        )}

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

        {isOauthWebAvailable() && (getVkAppId() || getYandexClientId()) && !user?.isGuest ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderTitle}>Привязанные аккаунты</Text>
            </View>
            {getVkAppId() ? (
              <View style={[styles.row, styles.rowBorder]}>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>VK ID</Text>
                  <Text style={styles.rowSubtitle}>
                    {user?.linkedProviders?.includes('vk')
                      ? 'Привязан'
                      : 'Не привязан'}
                  </Text>
                </View>
                <Pressable
                  style={styles.secondaryButton}
                  disabled={oauthBusy}
                  onPress={async () => {
                    setOauthBusy(true);
                    try {
                      if (user?.linkedProviders?.includes('vk')) {
                        await unlinkOauth('vk');
                      } else {
                        await linkVk();
                      }
                    } finally {
                      setOauthBusy(false);
                    }
                  }}>
                  <Text style={styles.secondaryButtonLabel}>
                    {user?.linkedProviders?.includes('vk') ? 'Отвязать' : 'Привязать'}
                  </Text>
                </Pressable>
              </View>
            ) : null}
            {getYandexClientId() ? (
              <View style={[styles.row, styles.rowBorder]}>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>Яндекс ID</Text>
                  <Text style={styles.rowSubtitle}>
                    {user?.linkedProviders?.includes('yandex')
                      ? 'Привязан'
                      : 'Не привязан'}
                  </Text>
                </View>
                <Pressable
                  style={styles.secondaryButton}
                  disabled={oauthBusy}
                  onPress={async () => {
                    setOauthBusy(true);
                    try {
                      if (user?.linkedProviders?.includes('yandex')) {
                        await unlinkOauth('yandex');
                      } else {
                        await linkYandex();
                      }
                    } finally {
                      setOauthBusy(false);
                    }
                  }}>
                  <Text style={styles.secondaryButtonLabel}>
                    {user?.linkedProviders?.includes('yandex')
                      ? 'Отвязать'
                      : 'Привязать'}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.section}>
          <Pressable
            style={styles.row}
            onPress={() => setChatBgPickerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Общий фон чатов">
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Общий фон чатов</Text>
              <Text style={styles.rowSubtitle}>
                {chatBgSubtitle}. По умолчанию для всех диалогов; в чате можно задать свой
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderTitle}>Уведомления и звуки</Text>
          </View>

          <View style={[styles.row, styles.rowBorder]}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Звук уведомлений</Text>
              <Text style={styles.rowSubtitle}>
                {soundSettings.enabled ? 'Включён' : 'Выключен (Mute)'}
              </Text>
            </View>
            {soundLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Switch
                value={soundSettings.enabled}
                onValueChange={handleToggleMute}
                disabled={soundBusy}
                trackColor={{ false: colors.border, true: colors.primaryLight }}
                thumbColor={soundSettings.enabled ? colors.primary : colors.surface}
              />
            )}
          </View>

          {presets.map((preset) => {
            const selected = !soundSettings.useCustom && soundSettings.presetId === preset.id;
            return (
              <View key={preset.id} style={styles.presetRow}>
                <Pressable
                  style={styles.presetMain}
                  onPress={() => handleSelectPreset(preset)}
                  disabled={soundBusy || soundLoading}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}>
                  <View style={styles.presetCheck}>
                    {selected ? (
                      <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                    ) : (
                      <Ionicons name="ellipse-outline" size={20} color={colors.textMuted} />
                    )}
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>{preset.label}</Text>
                    <Text style={styles.rowSubtitle}>
                      {preset.description || (preset.isDefault ? 'По умолчанию' : 'Пресет')}
                    </Text>
                  </View>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.playButton,
                    pressed ? styles.playButtonPressed : null,
                  ]}
                  onPress={() => handlePreviewUrl(preset.url)}
                  accessibilityRole="button"
                  accessibilityLabel={`Прослушать ${preset.label}`}>
                  <Ionicons name="play" size={18} color={colors.primary} />
                </Pressable>
              </View>
            );
          })}

          <View style={styles.presetRow}>
            <Pressable
              style={styles.presetMain}
              onPress={handleSelectCustom}
              disabled={soundBusy || soundLoading || !soundSettings.customUrl}
              accessibilityRole="radio"
              accessibilityState={{ selected: soundSettings.useCustom }}>
              <View style={styles.presetCheck}>
                {soundSettings.useCustom ? (
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                ) : (
                  <Ionicons name="ellipse-outline" size={20} color={colors.textMuted} />
                )}
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Свой звук</Text>
                <Text style={styles.rowSubtitle}>
                  {soundSettings.customUrl
                    ? 'Загруженный файл'
                    : 'Загрузите mp3/ogg до 256 КБ'}
                </Text>
              </View>
            </Pressable>
            {soundSettings.customUrl ? (
              <Pressable
                style={({ pressed }) => [
                  styles.playButton,
                  pressed ? styles.playButtonPressed : null,
                ]}
                onPress={() => handlePreviewUrl(soundSettings.customUrl)}
                accessibilityRole="button"
                accessibilityLabel="Прослушать свой звук">
                <Ionicons name="play" size={18} color={colors.primary} />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.actionRow}>
            <Pressable
              style={styles.secondaryButton}
              onPress={handleUploadCustom}
              disabled={soundBusy}>
              <Text style={styles.secondaryButtonLabel}>
                {soundSettings.customUrl ? 'Заменить свой' : 'Загрузить свой'}
              </Text>
            </Pressable>
            {soundSettings.customUrl ? (
              <Pressable
                style={styles.secondaryButton}
                onPress={handleClearCustom}
                disabled={soundBusy}>
                <Text style={styles.secondaryButtonLabel}>Удалить свой</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
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

        {WEB_PUSH_OPT_IN_ENABLED && Platform.OS === 'web' ? (
          <View style={styles.section}>
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
                  trackColor={{ false: colors.border, true: colors.primaryLight }}
                  thumbColor={pushEnabled ? colors.primary : colors.surface}
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
                Разрешение заблокировано. Включите уведомления в настройках браузера для этого сайта.
              </Text>
            ) : null}
            {!webPushAvailable && !iosHint && webPushHint ? (
              <Text style={styles.hint}>{webPushHint}</Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <ChatBackgroundPickerSheet
        visible={chatBgPickerOpen}
        onClose={() => setChatBgPickerOpen(false)}
      />
    </ScreenTransition>
  );
}
