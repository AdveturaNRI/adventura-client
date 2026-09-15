import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { UserAvatar } from '@/components/navigation/UserAvatar';
import { useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { toast } from '@/components/ui';
import { FontSize, Radius, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { listConversations, type ConversationListItem } from '@/services/chats/chatsApi';
import { localizeErrorMessage } from '@/utils/localizeError';

type GmChatTargetPickerProps = {
  visible: boolean;
  onClose: () => void;
  onPick: (conversationId: string, title: string) => void;
  busy?: boolean;
};

function isGroupChat(item: ConversationListItem) {
  return item.type === 'group' || Boolean(item.gameId);
}

function conversationTitle(item: ConversationListItem) {
  if (isGroupChat(item)) {
    return item.title?.trim() || (item.gameId ? 'Чат игры' : 'Группа');
  }
  return item.peer?.nickname?.trim() || 'Чат';
}

function conversationIcon(item: ConversationListItem): keyof typeof Ionicons.glyphMap {
  if (item.gameId) return 'game-controller-outline';
  if (item.type === 'group') return 'people-outline';
  return 'person-outline';
}

function createStyles(colors: ThemeColors, isDesktopWeb: boolean) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: isDesktopWeb ? 'center' : 'flex-end',
      alignItems: isDesktopWeb ? 'center' : 'stretch',
      padding: isDesktopWeb ? Spacing.lg : 0,
    },
    sheet: {
      width: '100%',
      maxWidth: isDesktopWeb ? 420 : undefined,
      maxHeight: isDesktopWeb ? '80%' : '78%',
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderRadius: isDesktopWeb ? 20 : undefined,
      borderWidth: isDesktopWeb ? 1 : 0,
      borderColor: colors.border,
      paddingBottom: Spacing.lg,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    searchWrap: {
      marginHorizontal: Spacing.md,
      marginTop: Spacing.md,
      marginBottom: Spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.md,
      minHeight: 42,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      backgroundColor: 'rgba(21, 122, 254, 0.06)',
    },
    searchInput: {
      flex: 1,
      fontSize: FontSize.input,
      color: colors.text,
      paddingVertical: Spacing.sm,
    },
    list: {
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
    },
    rowMeta: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    rowText: {
      fontSize: FontSize.label,
      fontWeight: '600',
      color: colors.text,
    },
    rowHint: {
      fontSize: FontSize.caption,
      color: colors.primary,
      fontWeight: '600',
    },
    empty: {
      padding: Spacing.lg,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: FontSize.label,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: FontSize.label * 1.45,
    },
    loader: {
      paddingVertical: Spacing.xl,
      alignItems: 'center',
    },
  });
}

export function GmChatTargetPicker({
  visible,
  onClose,
  onPick,
  busy = false,
}: GmChatTargetPickerProps) {
  const colors = useTheme();
  const isDesktopWeb = useIsDesktopWeb();
  const styles = useThemedStyles((theme) => createStyles(theme, isDesktopWeb));
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ConversationListItem[]>([]);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listConversations();
      setItems(list.filter((item) => !item.blockedByMe && !item.blockedMe));
    } catch (error) {
      toast.error(localizeErrorMessage(error, 'Не удалось загрузить чаты'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setQuery('');
      void load();
    }
  }, [visible, load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => conversationTitle(item).toLowerCase().includes(q));
  }, [items, query]);

  const content = useMemo(() => {
    if (loading) {
      return (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.primary} />
        </View>
      );
    }
    if (items.length === 0) {
      return (
        <View style={styles.empty}>
          <Ionicons name="chatbubbles-outline" size={28} color={colors.primary} />
          <Text style={styles.emptyText}>
            Пока нет чатов. Напиши кому-нибудь или зайди в игру — и сюда можно будет кинуть
            генерацию.
          </Text>
        </View>
      );
    }
    if (filtered.length === 0) {
      return (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Ничего не нашлось по запросу.</Text>
        </View>
      );
    }
    return (
      <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        {filtered.map((item) => {
          const title = conversationTitle(item);
          const hint = item.gameId ? 'Игра' : item.type === 'group' ? 'Группа' : 'Личный';
          return (
            <Pressable
              key={item.id}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={`Отправить в ${title}`}
              onPress={() => onPick(item.id, title)}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}>
              {item.type !== 'group' && !item.gameId && item.peer ? (
                <UserAvatar
                  nickname={title}
                  avatarUrl={item.peer.avatarUrl ?? null}
                  size={36}
                />
              ) : (
                <Ionicons name={conversationIcon(item)} size={22} color={colors.primary} />
              )}
              <View style={styles.rowMeta}>
                <Text style={styles.rowText} numberOfLines={1}>
                  {title}
                </Text>
                <Text style={styles.rowHint}>{hint}</Text>
              </View>
              <Ionicons name="send-outline" size={18} color={colors.primaryLight} />
            </Pressable>
          );
        })}
      </ScrollView>
    );
  }, [
    busy,
    colors.primary,
    colors.primaryLight,
    filtered,
    items.length,
    loading,
    onPick,
    styles,
  ]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button">
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>Отправить в чат</Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Закрыть">
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>
          {!loading && items.length > 0 ? (
            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={18} color={colors.primary} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Найти чат"
                placeholderTextColor={colors.textMuted}
                style={styles.searchInput}
                autoCorrect={false}
                autoCapitalize="none"
                clearButtonMode="while-editing"
              />
            </View>
          ) : null}
          {content}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
