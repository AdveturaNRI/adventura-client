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
  View,
} from 'react-native';

import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import type { ConversationListItem } from '@/services/chats/chatsApi';

type ContactOption = {
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
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: Spacing.md,
      paddingVertical: 12,
      fontSize: FontSize.input,
      color: colors.text,
      backgroundColor: colors.surface,
    },
    list: {
      maxHeight: 280,
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

export function CreateGroupDialog({
  visible,
  contacts,
  isBusy,
  onCancel,
  onSubmit,
}: CreateGroupDialogProps) {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const [title, setTitle] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!visible) {
      setTitle('');
      setSelected(new Set());
    }
  }, [visible]);

  const canSubmit = title.trim().length > 0 && selected.size > 0 && !isBusy;

  const sortedContacts = useMemo(() => contacts, [contacts]);

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

  const handleClose = () => {
    if (isBusy) {
      return;
    }
    setTitle('');
    setSelected(new Set());
    onCancel();
  };

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }
    onSubmit(title.trim(), [...selected]);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.root}>
        <View style={styles.card}>
          <Text style={styles.title}>Новая группа</Text>

          <View>
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

          <View>
            <Text style={styles.label}>Участники из переписок</Text>
            <ScrollView style={styles.list}>
              {sortedContacts.length === 0 ? (
                <Text style={styles.empty}>
                  Сначала напишите кому-нибудь в личку — оттуда можно будет выбрать людей.
                </Text>
              ) : (
                sortedContacts.map((contact) => {
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
