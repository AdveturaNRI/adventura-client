import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import type { ConversationListItem } from '@/services/chats/chatsApi';
import { searchWanderers } from '@/services/profile/wanderersApi';
import { localizeErrorMessage } from '@/utils/localizeError';

export type ContactOption = {
  id: string;
  nickname: string;
  avatarUrl: string | null;
};

type CreateGroupDialogProps = {
  visible: boolean;
  contacts: ContactOption[];
  isBusy: boolean;
  onCancel: () => void;
  onSubmit: (title: string, memberIds: string[]) => void;
};

function matchesNickname(nickname: string, query: string): boolean {
  const q = query.trim().toLocaleLowerCase('ru');
  if (!q) {
    return true;
  }
  const nick = nickname.toLocaleLowerCase('ru');
  if (nick.includes(q)) {
    return true;
  }
  const compactNick = nick.replace(/[_\s.\-]+/g, '');
  const compactQuery = q.replace(/[_\s.\-]+/g, '');
  return compactQuery.length > 0 && compactNick.includes(compactQuery);
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: 'center',
      padding: Spacing.lg,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    card: {
      maxHeight: '88%',
      borderRadius: 20,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.lg,
      gap: Spacing.md,
      overflow: 'hidden',
    },
    title: {
      fontSize: FontSize.h1,
      fontWeight: '700',
      color: colors.text,
      flexShrink: 0,
    },
    fieldBlock: {
      flexShrink: 0,
    },
    listBlock: {
      flexShrink: 1,
      minHeight: 0,
    },
    label: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 6,
      flexShrink: 0,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: 14,
      paddingHorizontal: Spacing.md,
      paddingVertical: 12,
      fontSize: FontSize.input,
      color: colors.text,
      backgroundColor: colors.surface,
      ...Platform.select({
        web: { outlineStyle: 'none' } as object,
        default: {},
      }),
    },
    listPanel: {
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: 14,
      overflow: 'hidden',
      backgroundColor: colors.surface,
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      minHeight: 48,
      paddingHorizontal: Spacing.md,
      backgroundColor: colors.surfaceMuted,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
    },
    searchWrapFocused: {
      backgroundColor: 'rgba(21, 122, 254, 0.08)',
    },
    searchInput: {
      flex: 1,
      fontSize: FontSize.input,
      color: colors.text,
      paddingVertical: Platform.OS === 'web' ? 12 : 10,
      minWidth: 0,
      ...Platform.select({
        web: { outlineStyle: 'none' } as object,
        default: {},
      }),
    },
    list: {
      // height capped inline
    },
    empty: {
      padding: Spacing.md,
      color: colors.textSecondary,
      fontSize: FontSize.label,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
      backgroundColor: colors.surface,
    },
    rowPressed: {
      backgroundColor: colors.surfaceMuted,
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      overflow: 'hidden',
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarImage: {
      width: '100%',
      height: '100%',
    },
    avatarInitial: {
      color: colors.onPrimary,
      fontWeight: '700',
      fontSize: 14,
    },
    nickname: {
      flex: 1,
      fontSize: FontSize.label,
      fontWeight: '600',
      color: colors.text,
    },
    check: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    checkOn: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    actions: {
      flexDirection: 'row',
      gap: Spacing.sm,
      justifyContent: 'flex-end',
      flexShrink: 0,
      paddingTop: Spacing.xs,
    },
    button: {
      paddingHorizontal: Spacing.md,
      paddingVertical: 12,
      borderRadius: 14,
      minWidth: 110,
      alignItems: 'center',
    },
    cancelBtn: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    submitBtn: {
      backgroundColor: colors.primary,
    },
    submitDisabled: {
      opacity: 0.45,
    },
    buttonLabel: {
      fontSize: FontSize.label,
      fontWeight: '700',
    },
    cancelLabel: {
      color: colors.text,
    },
    submitLabel: {
      color: colors.onPrimary,
    },
    searchStatus: {
      paddingHorizontal: Spacing.md,
      paddingBottom: Spacing.sm,
    },
  });
}

export function contactsFromConversations(items: ConversationListItem[]): ContactOption[] {
  const map = new Map<string, ContactOption>();
  for (const item of items) {
    if (item.type === 'group' || !item.peer) {
      continue;
    }
    if (!map.has(item.peer.id)) {
      map.set(item.peer.id, {
        id: item.peer.id,
        nickname: item.peer.nickname,
        avatarUrl: item.peer.avatarUrl,
      });
    }
  }
  return [...map.values()].sort((a, b) => a.nickname.localeCompare(b.nickname, 'ru'));
}

const CREATE_GROUP_CHROME_HEIGHT = 360;
const SEARCH_DEBOUNCE_MS = 280;

export function CreateGroupDialog({
  visible,
  contacts,
  isBusy,
  onCancel,
  onSubmit,
}: CreateGroupDialogProps) {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const { height: windowHeight } = useWindowDimensions();
  const listMaxHeight = Math.min(
    280,
    Math.max(120, Math.round(windowHeight * 0.88 - CREATE_GROUP_CHROME_HEIGHT)),
  );
  const [title, setTitle] = useState('');
  const [memberQuery, setMemberQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedMeta, setSelectedMeta] = useState<Map<string, ContactOption>>(new Map());
  const [remoteContacts, setRemoteContacts] = useState<ContactOption[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchGenerationRef = useRef(0);

  useEffect(() => {
    if (!visible) {
      setTitle('');
      setMemberQuery('');
      setSearchFocused(false);
      setSelected(new Set());
      setSelectedMeta(new Map());
      setRemoteContacts([]);
      setSearchBusy(false);
      setSearchError(null);
      searchGenerationRef.current += 1;
    }
  }, [visible]);

  const trimmedQuery = memberQuery.trim();

  useEffect(() => {
    if (!visible) {
      return;
    }

    if (trimmedQuery.length === 0) {
      searchGenerationRef.current += 1;
      setRemoteContacts([]);
      setSearchBusy(false);
      setSearchError(null);
      return;
    }

    const generation = ++searchGenerationRef.current;
    setSearchBusy(true);
    setSearchError(null);

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const results = await searchWanderers(trimmedQuery);
          if (generation !== searchGenerationRef.current) {
            return;
          }
          setRemoteContacts(
            results.map((item) => ({
              id: item.id,
              nickname: item.nickname,
              avatarUrl:
                item.profileCard?.small ??
                item.profileCard?.thumb ??
                item.profileCard?.medium ??
                null,
            })),
          );
        } catch (error) {
          if (generation !== searchGenerationRef.current) {
            return;
          }
          setRemoteContacts([]);
          setSearchError(localizeErrorMessage(error, 'Не удалось найти игроков'));
        } finally {
          if (generation === searchGenerationRef.current) {
            setSearchBusy(false);
          }
        }
      })();
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [trimmedQuery, visible]);

  const canSubmit = title.trim().length > 0 && selected.size > 0 && !isBusy;

  const visibleContacts = useMemo(() => {
    const byId = new Map<string, ContactOption>();

    for (const contact of selectedMeta.values()) {
      if (selected.has(contact.id)) {
        byId.set(contact.id, contact);
      }
    }

    const localMatches = trimmedQuery
      ? contacts.filter((contact) => matchesNickname(contact.nickname, trimmedQuery))
      : contacts;

    for (const contact of localMatches) {
      byId.set(contact.id, contact);
    }

    if (trimmedQuery) {
      for (const contact of remoteContacts) {
        if (!byId.has(contact.id)) {
          byId.set(contact.id, contact);
        }
      }
    }

    return [...byId.values()].sort((a, b) => {
      const aSelected = selected.has(a.id) ? 0 : 1;
      const bSelected = selected.has(b.id) ? 0 : 1;
      if (aSelected !== bSelected) {
        return aSelected - bSelected;
      }
      return a.nickname.localeCompare(b.nickname, 'ru');
    });
  }, [contacts, remoteContacts, selected, selectedMeta, trimmedQuery]);

  const toggle = (contact: ContactOption) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(contact.id)) {
        next.delete(contact.id);
      } else {
        next.add(contact.id);
      }
      return next;
    });
    setSelectedMeta((prev) => {
      const next = new Map(prev);
      if (next.has(contact.id)) {
        next.delete(contact.id);
      } else {
        next.set(contact.id, contact);
      }
      return next;
    });
  };

  const handleClose = () => {
    if (isBusy) {
      return;
    }
    onCancel();
  };

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }
    onSubmit(title.trim(), [...selected]);
  };

  const emptyHint =
    contacts.length === 0 && !trimmedQuery
      ? 'Введите ник — найдём игрока, даже если с ним ещё не было лички.'
      : trimmedQuery
        ? searchBusy
          ? 'Ищем…'
          : searchError ?? 'Никого не нашли по этому нику.'
        : 'Сначала напишите кому-нибудь в личку — оттуда можно будет выбрать людей.';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.root}>
        <View style={styles.card}>
          <Text style={styles.title}>Новая группа</Text>

          <View style={styles.fieldBlock}>
            <Text style={styles.label}>Название</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Например, вечер пятницы"
              placeholderTextColor={colors.textSubtle}
              style={styles.input}
              maxLength={80}
              editable={!isBusy}
            />
          </View>

          <View style={styles.listBlock}>
            <Text style={styles.label}>Участники</Text>
            <View style={styles.listPanel}>
              <View style={[styles.searchWrap, searchFocused && styles.searchWrapFocused]}>
                <Ionicons name="search" size={18} color={colors.textMuted} />
                <TextInput
                  value={memberQuery}
                  onChangeText={setMemberQuery}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  placeholder="Поиск по нику"
                  placeholderTextColor={colors.textMuted}
                  style={styles.searchInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                  returnKeyType="search"
                  editable={!isBusy}
                />
                {memberQuery.length > 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Очистить поиск"
                    onPress={() => setMemberQuery('')}
                    hitSlop={8}
                    disabled={isBusy}>
                    <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                  </Pressable>
                ) : null}
              </View>
              <ScrollView
                style={[styles.list, { maxHeight: listMaxHeight }]}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled">
                {searchBusy && visibleContacts.length === 0 ? (
                  <View style={styles.searchStatus}>
                    <ActivityIndicator
                      color={colors.primary}
                      style={{ marginVertical: Spacing.md }}
                    />
                  </View>
                ) : visibleContacts.length === 0 ? (
                  <Text style={styles.empty}>{emptyHint}</Text>
                ) : (
                  visibleContacts.map((contact) => {
                    const on = selected.has(contact.id);
                    const initial = [...contact.nickname.trim()][0]?.toUpperCase() ?? '?';
                    return (
                      <Pressable
                        key={contact.id}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: on }}
                        onPress={() => toggle(contact)}
                        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                        <View style={styles.avatar}>
                          {contact.avatarUrl ? (
                            <Image source={{ uri: contact.avatarUrl }} style={styles.avatarImage} />
                          ) : (
                            <Text style={styles.avatarInitial}>{initial}</Text>
                          )}
                        </View>
                        <Text style={styles.nickname} numberOfLines={1}>
                          {contact.nickname}
                        </Text>
                        <View style={[styles.check, on && styles.checkOn]}>
                          {on ? (
                            <Ionicons name="checkmark" size={14} color={colors.onPrimary} />
                          ) : null}
                        </View>
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>
            </View>
          </View>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={handleClose}
              style={[styles.button, styles.cancelBtn]}
              disabled={isBusy}>
              <Text style={[styles.buttonLabel, styles.cancelLabel]}>Отмена</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={handleSubmit}
              disabled={!canSubmit}
              style={[styles.button, styles.submitBtn, !canSubmit && styles.submitDisabled]}>
              {isBusy ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={[styles.buttonLabel, styles.submitLabel]}>Создать</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
