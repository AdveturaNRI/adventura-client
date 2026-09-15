import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
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
import { FontSize, Radius, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { listConversations, type ConversationListItem } from '@/services/chats/chatsApi';
import { localizeErrorMessage } from '@/utils/localizeError';
import { toast } from '@/components/ui';

type ChatForwardPickerProps = {
  visible: boolean;
  excludeConversationId?: string | null;
  onClose: () => void;
  onPick: (conversationId: string) => void;
  busy?: boolean;
};

function conversationTitle(item: ConversationListItem) {
  if (item.type === 'group') {
    return item.title?.trim() || 'Группа';
  }
  return item.peer?.nickname?.trim() || 'Чат';
}

function createStyles(colors: ThemeColors, isDesktopWeb: boolean) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: isDesktopWeb ? 'center' : 'flex-end',
      alignItems: isDesktopWeb ? 'center' : 'stretch',
      paddingHorizontal: isDesktopWeb ? Spacing.lg : 0,
      paddingVertical: isDesktopWeb ? Spacing.xl : 0,
    },
    sheet: {
      width: '100%',
      maxWidth: isDesktopWeb ? 420 : undefined,
      maxHeight: isDesktopWeb ? '80%' : '78%',
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderBottomLeftRadius: isDesktopWeb ? 20 : 0,
      borderBottomRightRadius: isDesktopWeb ? 20 : 0,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
    },
    title: {
      fontSize: FontSize.button,
      fontWeight: '600',
      color: colors.text,
    },
    searchWrap: {
      marginHorizontal: Spacing.lg,
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
      backgroundColor: colors.surfaceMuted,
    },
    searchInput: {
      flex: 1,
      fontSize: FontSize.input,
      color: colors.text,
      paddingVertical: Spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
    },
    rowPressed: {
      backgroundColor: colors.surfaceMuted,
    },
    rowTitle: {
      flex: 1,
      fontSize: FontSize.input,
      color: colors.text,
      fontWeight: '500',
    },
    empty: {
      padding: Spacing.xl,
      alignItems: 'center',
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: FontSize.caption,
      textAlign: 'center',
    },
  });
}

export function ChatForwardPicker({
  visible,
  excludeConversationId,
  onClose,
  onPick,
  busy = false,
}: ChatForwardPickerProps) {
  const colors = useTheme();
  const isDesktopWeb = useIsDesktopWeb();
  const styles = useThemedStyles((theme) => createStyles(theme, isDesktopWeb));
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<ConversationListItem[]>([]);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      return;
    }
    let cancelled = false;
    setLoading(true);
    listConversations()
      .then((next) => {
        if (!cancelled) {
          setItems(next);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(localizeErrorMessage(error, 'Не удалось загрузить чаты'));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((item) => item.id !== excludeConversationId)
      .filter((item) => {
        if (!q) {
          return true;
        }
        return conversationTitle(item).toLowerCase().includes(q);
      })
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }, [excludeConversationId, items, query]);

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible
      transparent
      animationType={isDesktopWeb ? 'fade' : 'slide'}
      onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Переслать в чат</Text>
            <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <View style={styles.searchWrap}>
            <Ionicons name="search" size={16} color={colors.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Поиск"
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
              editable={!busy}
            />
          </View>

          {loading ? (
            <View style={styles.empty}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Нет подходящих чатов</Text>
            </View>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled">
              {filtered.map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => onPick(item.id)}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                  <UserAvatar
                    nickname={conversationTitle(item)}
                    avatarUrl={
                      item.type === 'group'
                        ? item.membersPreview?.[0]?.avatarUrl ?? null
                        : item.peer?.avatarUrl ?? null
                    }
                    size={40}
                  />
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {conversationTitle(item)}
                  </Text>
                  {busy ? <ActivityIndicator size="small" color={colors.primary} /> : null}
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
