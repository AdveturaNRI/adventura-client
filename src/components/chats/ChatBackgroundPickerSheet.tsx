import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ChatBackgroundEditor } from '@/components/chats/ChatBackgroundEditor';
import { toast } from '@/components/ui';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import {
  setConversationBackground,
  type ConversationListItem,
} from '@/services/chats/chatsApi';
import { getImageSize } from '@/utils/image-size';
import { localizeErrorMessage } from '@/utils/localizeError';
import {
  CHAT_BACKGROUND_PRESETS,
  CHAT_BG_HISTORY_MAX,
  CHAT_BG_MAX_UPLOAD_MB,
  clearConversationChatBackground,
  getChatBackgroundHistorySync,
  isAllowedChatBackgroundMime,
  loadChatBackgroundHistory,
  loadConversationChatBackgroundOverride,
  persistChatBackgroundUri,
  rememberCustomChatBackground,
  removeChatBackgroundHistoryItem,
  resetGlobalChatBackground,
  resolveChatBackground,
  resolveChatBackgroundSync,
  resolvePresetColors,
  saveConversationChatBackground,
  saveGlobalChatBackground,
  subscribeChatBackgroundHistory,
  subscribeConversationChatBackground,
  subscribeGlobalChatBackground,
  type ChatBackgroundHistoryItem,
  type ChatBackgroundSetting,
} from '@/utils/chat-background-settings';

type ChatBackgroundPickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Если задан — фон только для этого чата. Иначе — общий из настроек. */
  conversationId?: string | null;
  /** После успешного sync shared-фона (чат) — обновить conversation в родителе. */
  onConversationUpdated?: (conversation: ConversationListItem) => void;
};

function guessMimeFromUri(uri: string): string {
  const lower = uri.split('?')[0]?.toLowerCase() ?? '';
  if (lower.startsWith('data:image/')) {
    const mime = lower.slice('data:'.length).split(';')[0];
    return mime || 'image/webp';
  }
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return 'image/webp';
}

function guessFileNameFromUri(uri: string, mimeType: string): string {
  const ext =
    mimeType === 'image/png' ? 'png' : mimeType === 'image/jpeg' ? 'jpg' : 'webp';
  return `chat-bg.${ext}`;
}

type PendingEdit = {
  uri: string;
  width: number;
  height: number;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    sheet: {
      maxHeight: '82%',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderColor: colors.border,
      paddingBottom: Spacing.xl,
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginTop: Spacing.sm,
      marginBottom: Spacing.md,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.sm,
    },
    title: {
      fontSize: FontSize.h1,
      fontWeight: '700',
      color: colors.text,
    },
    subtitle: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.45,
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.md,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceMuted,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.lg,
    },
    tile: {
      width: '31%',
      minWidth: 96,
      flexGrow: 1,
      aspectRatio: 0.85,
      borderRadius: 14,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: 'transparent',
      backgroundColor: colors.surfaceMuted,
    },
    tileSelected: {
      borderColor: colors.primary,
    },
    tileFill: {
      flex: 1,
    },
    tileLabel: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 8,
      paddingVertical: 6,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    tileLabelText: {
      fontSize: 11,
      fontWeight: '600',
      color: '#FFFFFF',
      textAlign: 'center',
    },
    tileCheck: {
      position: 'absolute',
      top: 6,
      right: 6,
    },
    actions: {
      gap: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.lg,
    },
    actionBtn: {
      minHeight: 48,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    actionBtnPrimary: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    actionBtnLabel: {
      fontSize: FontSize.label,
      fontWeight: '600',
      color: colors.text,
    },
    actionBtnLabelOnPrimary: {
      color: colors.onPrimary,
    },
    customPreview: {
      height: 72,
      borderRadius: 14,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
      marginHorizontal: Spacing.lg,
      marginTop: Spacing.md,
    },
    customPreviewImage: {
      width: '100%',
      height: '100%',
    },
    sectionLabel: {
      marginTop: Spacing.lg,
      marginBottom: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      fontSize: FontSize.label,
      fontWeight: '700',
      color: colors.text,
    },
    sectionHint: {
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.sm,
      fontSize: FontSize.caption,
      color: colors.textMuted,
    },
    historyTile: {
      position: 'relative',
    },
    historyRemove: {
      position: 'absolute',
      top: 4,
      right: 4,
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.55)',
      zIndex: 2,
    },
  });
}

function PresetSwatch({ colors }: { colors: [string, string] }) {
  const webGradient =
    Platform.OS === 'web'
      ? ({
          backgroundImage: `linear-gradient(160deg, ${colors[0]} 0%, ${colors[1]} 100%)`,
        } as object)
      : null;

  return (
    <View style={[{ flex: 1, backgroundColor: colors[0] }, webGradient]}>
      {Platform.OS !== 'web' ? (
        <View style={{ flex: 1, backgroundColor: colors[1], opacity: 0.55 }} />
      ) : null}
    </View>
  );
}

export function ChatBackgroundPickerSheet({
  visible,
  onClose,
  conversationId,
  onConversationUpdated,
}: ChatBackgroundPickerSheetProps) {
  const colors = useTheme();
  const isDark = colors.background === '#000000';
  const styles = useThemedStyles(createStyles);
  const isPerChat = Boolean(conversationId);
  const [setting, setSetting] = useState<ChatBackgroundSetting>(() =>
    resolveChatBackgroundSync(conversationId),
  );
  const [hasOverride, setHasOverride] = useState(false);
  const [history, setHistory] = useState<ChatBackgroundHistoryItem[]>(() =>
    getChatBackgroundHistorySync(),
  );
  const [busy, setBusy] = useState(false);
  const [pendingEdit, setPendingEdit] = useState<PendingEdit | null>(null);

  const refreshSetting = useCallback(async () => {
    const resolved = await resolveChatBackground(conversationId);
    setSetting(resolved);
    if (conversationId) {
      const override = await loadConversationChatBackgroundOverride(conversationId);
      setHasOverride(override != null);
    } else {
      setHasOverride(false);
    }
  }, [conversationId]);

  useEffect(() => {
    if (!visible) return;
    void refreshSetting();
    void loadChatBackgroundHistory().then(setHistory);
    const unsubGlobal = subscribeGlobalChatBackground(() => {
      void refreshSetting();
    });
    const unsubChat = subscribeConversationChatBackground((id) => {
      if (!conversationId || id === '*' || id === conversationId) {
        void refreshSetting();
      }
    });
    const unsubHistory = subscribeChatBackgroundHistory(setHistory);
    return () => {
      unsubGlobal();
      unsubChat();
      unsubHistory();
    };
  }, [visible, conversationId, refreshSetting]);

  /** Локально + (для чата) shared на сервер, затем сразу закрываем пикер. */
  const persistSetting = useCallback(
    async (next: ChatBackgroundSetting) => {
      if (!conversationId) {
        await saveGlobalChatBackground(next);
        onClose();
        return;
      }

      let synced: ChatBackgroundSetting = next;
      let updated: ConversationListItem | null = null;

      if (next.kind === 'custom') {
        if (next.uri.startsWith('data:')) {
          await rememberCustomChatBackground(next.uri);
        }
        const mimeType = guessMimeFromUri(next.uri);
        updated = await setConversationBackground(conversationId, {
          kind: 'custom',
          fileUri: next.uri,
          fileName: guessFileNameFromUri(next.uri, mimeType),
          mimeType,
        });
        const url = updated.background?.url;
        if (url) {
          synced = { kind: 'custom', uri: url };
        }
      } else if (next.kind === 'preset') {
        updated = await setConversationBackground(conversationId, {
          kind: 'preset',
          presetId: next.presetId,
        });
      } else {
        updated = await setConversationBackground(conversationId, { kind: 'default' });
      }

      await saveConversationChatBackground(conversationId, synced);
      if (updated) {
        onConversationUpdated?.(updated);
      }
      onClose();
    },
    [conversationId, onClose, onConversationUpdated],
  );

  const handleSelectPreset = useCallback(
    async (presetId: string) => {
      if (busy) return;
      setBusy(true);
      try {
        await persistSetting({ kind: 'preset', presetId });
        toast.success(isPerChat ? 'Фон этого чата обновлён' : 'Общий фон чатов обновлён');
      } catch (error) {
        toast.error(localizeErrorMessage(error, 'Не удалось сохранить фон'));
      } finally {
        setBusy(false);
      }
    },
    [busy, isPerChat, persistSetting],
  );

  const handleSelectHistory = useCallback(
    async (item: ChatBackgroundHistoryItem) => {
      if (busy) return;
      setBusy(true);
      try {
        await persistSetting({ kind: 'custom', uri: item.uri });
        toast.success(isPerChat ? 'Фон этого чата обновлён' : 'Общий фон чатов обновлён');
      } catch (error) {
        toast.error(localizeErrorMessage(error, 'Не удалось применить фон'));
      } finally {
        setBusy(false);
      }
    },
    [busy, isPerChat, persistSetting],
  );

  const handleRemoveHistory = useCallback(
    async (item: ChatBackgroundHistoryItem) => {
      if (busy) return;
      setBusy(true);
      try {
        await removeChatBackgroundHistoryItem(item.id);
        if (setting.kind === 'custom' && setting.uri === item.uri) {
          if (conversationId) {
            const updated = await setConversationBackground(conversationId, { kind: 'clear' });
            await clearConversationChatBackground(conversationId);
            onConversationUpdated?.(updated);
            onClose();
          } else {
            await resetGlobalChatBackground();
          }
          toast.info('Фон удалён из истории и сброшен');
        } else {
          toast.info('Фон удалён из истории');
        }
      } catch (error) {
        toast.error(localizeErrorMessage(error, 'Не удалось удалить фон'));
      } finally {
        setBusy(false);
      }
    },
    [busy, conversationId, onClose, onConversationUpdated, setting],
  );

  /** Системный фон (без картинки) — для этого чата или общий. */
  const handleSystem = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      await persistSetting({ kind: 'default' });
      toast.info(isPerChat ? 'У этого чата системный фон' : 'Общий фон сброшен');
    } catch (error) {
      toast.error(localizeErrorMessage(error, 'Не удалось сбросить фон'));
    } finally {
      setBusy(false);
    }
  }, [busy, isPerChat, persistSetting]);

  /** Вернуть чат к общему фону из настроек (и убрать shared у собеседника). */
  const handleInheritGlobal = useCallback(async () => {
    if (busy || !conversationId) return;
    setBusy(true);
    try {
      const updated = await setConversationBackground(conversationId, { kind: 'clear' });
      await clearConversationChatBackground(conversationId);
      onConversationUpdated?.(updated);
      toast.info('Используется общий фон из настроек');
      onClose();
    } catch (error) {
      toast.error(localizeErrorMessage(error, 'Не удалось сбросить фон'));
    } finally {
      setBusy(false);
    }
  }, [busy, conversationId, onClose, onConversationUpdated]);

  const openEditor = useCallback(async (uri: string, width?: number, height?: number) => {
    let w = width ?? 0;
    let h = height ?? 0;
    if (!w || !h) {
      const size = await getImageSize(uri);
      w = size.width;
      h = size.height;
    }
    if (!w || !h) {
      throw new Error('Не удалось определить размер изображения');
    }
    setPendingEdit({ uri, width: w, height: h });
  }, []);

  const handleUpload = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/png', 'image/webp'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (picked.canceled || !picked.assets?.[0]) {
        return;
      }
      const asset = picked.assets[0];
      if (asset.size != null && asset.size > CHAT_BG_MAX_UPLOAD_MB * 1024 * 1024) {
        toast.error(`Файл слишком большой (максимум ${CHAT_BG_MAX_UPLOAD_MB} МБ)`);
        return;
      }
      if (asset.mimeType && !isAllowedChatBackgroundMime(asset.mimeType)) {
        toast.error('Нужен JPG, PNG или WebP');
        return;
      }
      await openEditor(asset.uri);
    } catch (error) {
      toast.error(localizeErrorMessage(error, 'Не удалось открыть изображение'));
    } finally {
      setBusy(false);
    }
  }, [busy, openEditor]);

  const handleEditorSave = useCallback(
    async (uri: string) => {
      try {
        const persisted = await persistChatBackgroundUri(uri);
        await persistSetting({ kind: 'custom', uri: persisted });
        setPendingEdit(null);
        toast.success(isPerChat ? 'Фон этого чата сохранён' : 'Общий фон сохранён');
      } catch (error) {
        toast.error(localizeErrorMessage(error, 'Не удалось сохранить фон'));
      }
    },
    [isPerChat, persistSetting],
  );

  const systemSelected =
    setting.kind === 'default' && (!isPerChat || hasOverride);
  const inheritingGlobal = isPerChat && !hasOverride;

  return (
    <>
      <Modal visible={visible && !pendingEdit} transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.root}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Закрыть" />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <Text style={styles.title}>
                {isPerChat ? 'Фон этого чата' : 'Общий фон чатов'}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Закрыть"
                onPress={onClose}
                style={styles.closeBtn}>
                <Ionicons name="close" size={18} color={colors.text} />
              </Pressable>
            </View>
            <Text style={styles.subtitle}>
              {isPerChat
                ? 'Виден обоим участникам. Общий фон по умолчанию — в Настройках.'
                : 'По умолчанию для всех чатов на этом устройстве. В меню чата — общий фон для диалога.'}{' '}
              JPG/PNG/WebP до {CHAT_BG_MAX_UPLOAD_MB} МБ.
            </Text>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={styles.grid}>
                {isPerChat ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: inheritingGlobal }}
                    disabled={busy}
                    onPress={() => void handleInheritGlobal()}
                    style={[styles.tile, inheritingGlobal && styles.tileSelected]}>
                    <View
                      style={[
                        styles.tileFill,
                        {
                          backgroundColor: colors.surfaceMuted,
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 8,
                        },
                      ]}>
                      <Ionicons name="settings-outline" size={22} color={colors.primary} />
                    </View>
                    <View style={styles.tileLabel}>
                      <Text style={styles.tileLabelText}>Как в настройках</Text>
                    </View>
                    {inheritingGlobal ? (
                      <View style={styles.tileCheck}>
                        <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                      </View>
                    ) : null}
                  </Pressable>
                ) : null}

                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: systemSelected }}
                  disabled={busy}
                  onPress={() => void handleSystem()}
                  style={[styles.tile, systemSelected && styles.tileSelected]}>
                  <View
                    style={[
                      styles.tileFill,
                      {
                        backgroundColor: colors.background,
                        alignItems: 'center',
                        justifyContent: 'center',
                      },
                    ]}>
                    <Ionicons name="ban-outline" size={22} color={colors.textMuted} />
                  </View>
                  <View style={styles.tileLabel}>
                    <Text style={styles.tileLabelText}>Системный</Text>
                  </View>
                  {systemSelected ? (
                    <View style={styles.tileCheck}>
                      <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                    </View>
                  ) : null}
                </Pressable>

                {CHAT_BACKGROUND_PRESETS.map((preset) => {
                  const selected =
                    hasOverride || !isPerChat
                      ? setting.kind === 'preset' && setting.presetId === preset.id
                      : false;
                  return (
                    <Pressable
                      key={preset.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      disabled={busy}
                      onPress={() => void handleSelectPreset(preset.id)}
                      style={[styles.tile, selected && styles.tileSelected]}>
                      <PresetSwatch colors={resolvePresetColors(preset, isDark)} />
                      <View
                        style={[
                          StyleSheet.absoluteFill,
                          {
                            backgroundColor: `rgba(0,0,0,${
                              (isDark && preset.darkDimmer != null
                                ? preset.darkDimmer
                                : preset.dimmer) * 0.55
                            })`,
                          },
                        ]}
                      />
                      <View style={styles.tileLabel}>
                        <Text style={styles.tileLabelText}>{preset.label}</Text>
                      </View>
                      {selected ? (
                        <View style={styles.tileCheck}>
                          <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>

              {history.length > 0 ? (
                <>
                  <Text style={styles.sectionLabel}>Мои фоны</Text>
                  <Text style={styles.sectionHint}>
                    До {CHAT_BG_HISTORY_MAX} последних. Нажми — применить, ✕ — удалить.
                  </Text>
                  <View style={styles.grid}>
                    {history.map((item) => {
                      const selected =
                        (hasOverride || !isPerChat) &&
                        setting.kind === 'custom' &&
                        setting.uri === item.uri;
                      return (
                        <View
                          key={item.id}
                          style={[
                            styles.tile,
                            styles.historyTile,
                            selected && styles.tileSelected,
                          ]}>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                            disabled={busy}
                            onPress={() => void handleSelectHistory(item)}
                            style={styles.tileFill}>
                            <Image
                              source={{ uri: item.uri }}
                              style={StyleSheet.absoluteFill}
                              contentFit="cover"
                            />
                            {selected ? (
                              <View style={styles.tileCheck}>
                                <Ionicons
                                  name="checkmark-circle"
                                  size={18}
                                  color={colors.primary}
                                />
                              </View>
                            ) : null}
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Удалить фон"
                            hitSlop={6}
                            disabled={busy}
                            onPress={() => void handleRemoveHistory(item)}
                            style={styles.historyRemove}>
                            <Ionicons name="close" size={14} color="#FFFFFF" />
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                </>
              ) : null}

              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => void handleUpload()}
                  style={({ pressed }) => [
                    styles.actionBtn,
                    styles.actionBtnPrimary,
                    pressed && { opacity: 0.85 },
                  ]}>
                  {busy ? (
                    <ActivityIndicator color={colors.onPrimary} />
                  ) : (
                    <>
                      <Ionicons name="image-outline" size={18} color={colors.onPrimary} />
                      <Text style={[styles.actionBtnLabel, styles.actionBtnLabelOnPrimary]}>
                        {history.length > 0 || setting.kind === 'custom'
                          ? 'Новое фото'
                          : 'Загрузить и отредактировать'}
                      </Text>
                    </>
                  )}
                </Pressable>
                {setting.kind === 'custom' && (hasOverride || !isPerChat) ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => {
                      void (async () => {
                        setBusy(true);
                        try {
                          await openEditor(setting.uri);
                        } catch (error) {
                          toast.error(
                            localizeErrorMessage(error, 'Не удалось открыть редактор'),
                          );
                        } finally {
                          setBusy(false);
                        }
                      })();
                    }}
                    style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.85 }]}>
                    <Ionicons name="crop-outline" size={18} color={colors.text} />
                    <Text style={styles.actionBtnLabel}>Редактировать текущий</Text>
                  </Pressable>
                ) : null}
                {isPerChat && hasOverride ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => void handleInheritGlobal()}
                    style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.85 }]}>
                    <Ionicons name="return-down-back-outline" size={18} color={colors.text} />
                    <Text style={styles.actionBtnLabel}>Вернуть общий из настроек</Text>
                  </Pressable>
                ) : null}
                {!isPerChat && setting.kind !== 'default' ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => void handleSystem()}
                    style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.85 }]}>
                    <Ionicons name="refresh-outline" size={18} color={colors.text} />
                    <Text style={styles.actionBtnLabel}>Сбросить до системного</Text>
                  </Pressable>
                ) : null}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {pendingEdit ? (
        <ChatBackgroundEditor
          visible
          imageUri={pendingEdit.uri}
          imageWidth={pendingEdit.width}
          imageHeight={pendingEdit.height}
          onCancel={() => setPendingEdit(null)}
          onSave={(uri) => {
            void handleEditorSave(uri);
          }}
        />
      ) : null}
    </>
  );
}

