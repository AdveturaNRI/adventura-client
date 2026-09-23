import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
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

type ContactOption = {
  id: string;
  nickname: string;
  avatarUrl: string | null;
};

type AddGroupMembersDialogProps = {
  visible: boolean;
  contacts: ContactOption[];
  /** Already in the group — hide from picker. */
  excludeIds?: string[];
  isBusy: boolean;
  onCancel: () => void;
  onSubmit: (memberIds: string[]) => void;
};

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
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: Spacing.md,
      minHeight: 44,
      backgroundColor: colors.surface,
      marginBottom: Spacing.sm,
    },
    searchInput: {
      flex: 1,
      fontSize: FontSize.input,
      color: colors.text,
      paddingVertical: 10,
      minWidth: 0,
    },
    list: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
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
      borderBottomColor: colors.border,
    },
    rowPressed: {
      opacity: 0.72,
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
  });
}

const CHROME_HEIGHT = 280;

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
  const [memberQuery, setMemberQuery] = useState('');
  const exclude = useMemo(() => new Set(excludeIds), [excludeIds]);

  useEffect(() => {
    if (!visible) {
      setSelected(new Set());
      setMemberQuery('');
    }
  }, [visible]);

  const available = useMemo(
    () => contacts.filter((c) => !exclude.has(c.id)),
    [contacts, exclude],
  );

  const filtered = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    if (!q) {
      return available;
    }
    return available.filter((contact) => contact.nickname.toLowerCase().includes(q));
  }, [available, memberQuery]);

  const canSubmit = selected.size > 0 && !isBusy;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

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
          <Text style={styles.label}>Из личных переписок</Text>
          {available.length > 0 ? (
            <View style={styles.searchWrap}>
              <Ionicons name="search" size={16} color={colors.textSubtle} />
              <TextInput
                value={memberQuery}
                onChangeText={setMemberQuery}
                placeholder="Поиск по нику"
                placeholderTextColor={colors.textSubtle}
                style={styles.searchInput}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isBusy}
              />
              {memberQuery.length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Очистить поиск"
                  onPress={() => setMemberQuery('')}
                  hitSlop={8}
                  disabled={isBusy}>
                  <Ionicons name="close-circle" size={18} color={colors.textSubtle} />
                </Pressable>
              ) : null}
            </View>
          ) : null}
          <ScrollView
            style={[styles.list, { maxHeight: listMaxHeight }]}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled">
            {available.length === 0 ? (
              <Text style={styles.empty}>
                Некого добавить — все контакты уже в группе или переписок пока нет.
              </Text>
            ) : filtered.length === 0 ? (
              <Text style={styles.empty}>Никого не нашли по этому нику.</Text>
            ) : (
              filtered.map((contact) => {
                const on = selected.has(contact.id);
                const initial = [...contact.nickname.trim()][0]?.toUpperCase() ?? '?';
                return (
                  <Pressable
                    key={contact.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    onPress={() => toggle(contact.id)}
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
