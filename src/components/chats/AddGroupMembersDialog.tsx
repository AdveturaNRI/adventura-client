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
import { searchWanderers } from '@/services/profile/wanderersApi';
import { localizeErrorMessage } from '@/utils/localizeError';

import type { ContactOption } from './CreateGroupDialog';

type AddGroupMembersDialogProps = {
  visible: boolean;
  contacts: ContactOption[];
  /** Already in the group — hide from picker. */
  excludeIds?: string[];
  isBusy: boolean;
  onCancel: () => void;
  onSubmit: (memberIds: string[]) => void;
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
    },
    label: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 6,
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
    list: {},
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

const CHROME_HEIGHT = 280;
const SEARCH_DEBOUNCE_MS = 280;

export function AddGroupMembersDialog({
  visible,
  contacts,
  excludeIds = [],
  isBusy,
  onCancel,
  onSubmit,
}: AddGroupMembersDialogProps) {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const { height: windowHeight } = useWindowDimensions();
  const listMaxHeight = Math.min(
    280,
    Math.max(120, Math.round(windowHeight * 0.88 - CHROME_HEIGHT)),
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedMeta, setSelectedMeta] = useState<Map<string, ContactOption>>(new Map());
  const [memberQuery, setMemberQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [remoteContacts, setRemoteContacts] = useState<ContactOption[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchGenerationRef = useRef(0);
  const exclude = useMemo(() => new Set(excludeIds), [excludeIds]);

  useEffect(() => {
    if (!visible) {
      setSelected(new Set());
      setSelectedMeta(new Map());
      setMemberQuery('');
      setSearchFocused(false);
      setRemoteContacts([]);
      setSearchBusy(false);
      setSearchError(null);
      searchGenerationRef.current += 1;
    }
  }, [visible]);

  const available = useMemo(
    () => contacts.filter((c) => !exclude.has(c.id)),
    [contacts, exclude],
  );

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
            results
              .filter((item) => !exclude.has(item.id))
              .map((item) => ({
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
  }, [exclude, trimmedQuery, visible]);

  const visibleContacts = useMemo(() => {
    const byId = new Map<string, ContactOption>();

    for (const contact of selectedMeta.values()) {
      if (selected.has(contact.id) && !exclude.has(contact.id)) {
        byId.set(contact.id, contact);
      }
    }

    const localMatches = trimmedQuery
      ? available.filter((contact) => matchesNickname(contact.nickname, trimmedQuery))
      : available;

    for (const contact of localMatches) {
      byId.set(contact.id, contact);
    }

    if (trimmedQuery) {
      for (const contact of remoteContacts) {
        if (!byId.has(contact.id) && !exclude.has(contact.id)) {
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
  }, [available, exclude, remoteContacts, selected, selectedMeta, trimmedQuery]);

  const canSubmit = selected.size > 0 && !isBusy;

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

  const emptyHint =
    available.length === 0 && !trimmedQuery
      ? 'Введите ник — найдём игрока, даже если с ним ещё не было лички.'
      : trimmedQuery
        ? searchBusy
          ? 'Ищем…'
          : searchError ?? 'Никого не нашли по этому нику.'
        : 'Некого добавить — все контакты уже в группе или переписок пока нет.';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!isBusy) {
          onCancel();
        }
      }}>
      <View style={styles.root}>
        <View style={styles.card}>
          <Text style={styles.title}>Добавить участников</Text>
          <Text style={styles.label}>Игроки</Text>
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
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              style={[styles.button, styles.cancelBtn]}
              disabled={isBusy}>
              <Text style={[styles.buttonLabel, styles.cancelLabel]}>Отмена</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => onSubmit([...selected])}
              disabled={!canSubmit}
              style={[styles.button, styles.submitBtn, !canSubmit && styles.submitDisabled]}>
              {isBusy ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={[styles.buttonLabel, styles.submitLabel]}>Добавить</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
