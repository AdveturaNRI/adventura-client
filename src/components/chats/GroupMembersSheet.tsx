import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import type { ChatMember } from '@/services/chats/chatsApi';

type GroupMembersSheetProps = {
  visible: boolean;
  title: string;
  members: ChatMember[];
  loading: boolean;
  busy?: boolean;
  myUserId?: string | null;
  myRole?: 'owner' | 'admin' | 'member' | null;
  /** Game chats: roster is managed by the game, no admin tools. */
  readOnly?: boolean;
  onClose: () => void;
  onOpenProfile: (userId: string) => void;
  onAddMembers?: () => void;
  onPromote?: (userId: string) => void;
  onDemote?: (userId: string) => void;
  onTransfer?: (userId: string) => void;
  onRemove?: (userId: string) => void;
};

function roleLabel(role: ChatMember['role']) {
  if (role === 'owner') {
    return 'создатель';
  }
  if (role === 'admin') {
    return 'админ';
  }
  return null;
}

function createStyles(colors: ThemeColors, isDesktop: boolean) {
  return StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: isDesktop ? 'center' : 'flex-end',
      alignItems: isDesktop ? 'center' : 'stretch',
      paddingHorizontal: isDesktop ? Spacing.lg : 0,
      paddingVertical: isDesktop ? Spacing.xl : 0,
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
    sheet: {
      width: isDesktop ? '100%' : undefined,
      maxWidth: isDesktop ? 440 : undefined,
      maxHeight: isDesktop ? '80%' : '78%',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderBottomLeftRadius: isDesktop ? 20 : 0,
      borderBottomRightRadius: isDesktop ? 20 : 0,
      backgroundColor: colors.background,
      paddingTop: Spacing.md,
      paddingBottom: isDesktop ? Spacing.lg : Spacing.xl,
      borderWidth: isDesktop ? 1 : StyleSheet.hairlineWidth,
      borderBottomWidth: isDesktop ? 1 : 0,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginBottom: Spacing.md,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.sm,
    },
    headerCopy: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      fontSize: FontSize.h1,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: FontSize.caption,
      color: colors.primary,
      fontWeight: '600',
    },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
      flexShrink: 0,
    },
    addBtnLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
    },
    list: {
      flexGrow: 0,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingHorizontal: Spacing.lg,
      paddingVertical: 12,
    },
    rowPressed: {
      opacity: 0.72,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
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
    },
    body: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    name: {
      fontSize: FontSize.label,
      fontWeight: '600',
      color: colors.text,
    },
    meta: {
      fontSize: FontSize.caption,
      color: colors.textSecondary,
    },
    roleBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
    },
    roleBadgeAdmin: {
      backgroundColor: 'rgba(52, 199, 89, 0.14)',
    },
    roleLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
    },
    roleLabelAdmin: {
      color: '#1F8A3C',
    },
    manageBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
    },
    empty: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      color: colors.textSecondary,
    },
    actionRoot: {
      flex: 1,
      justifyContent: isDesktop ? 'center' : 'flex-end',
      alignItems: isDesktop ? 'center' : 'stretch',
      paddingHorizontal: isDesktop ? Spacing.lg : 0,
      paddingVertical: isDesktop ? Spacing.xl : 0,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    actionSheet: {
      width: isDesktop ? '100%' : undefined,
      maxWidth: isDesktop ? 380 : undefined,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderBottomLeftRadius: isDesktop ? 20 : 0,
      borderBottomRightRadius: isDesktop ? 20 : 0,
      backgroundColor: colors.background,
      paddingTop: Spacing.md,
      paddingBottom: isDesktop ? Spacing.lg : Spacing.xl,
      borderWidth: isDesktop ? 1 : StyleSheet.hairlineWidth,
      borderBottomWidth: isDesktop ? 1 : 0,
      borderColor: colors.border,
    },
    actionTitle: {
      fontSize: FontSize.label,
      fontWeight: '700',
      color: colors.text,
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.sm,
    },
    actionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: Spacing.lg,
      paddingVertical: 14,
    },
    actionItemPressed: {
      opacity: 0.72,
    },
    actionLabel: {
      fontSize: FontSize.label,
      fontWeight: '600',
      color: colors.text,
    },
    actionDanger: {
      color: colors.destructive,
    },
    actionCancel: {
      marginTop: Spacing.sm,
      marginHorizontal: Spacing.lg,
      alignItems: 'center',
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    actionCancelLabel: {
      fontSize: FontSize.label,
      fontWeight: '700',
      color: colors.text,
    },
  });
}

export function GroupMembersSheet({
  visible,
  title,
  members,
  loading,
  busy = false,
  myUserId,
  myRole,
  readOnly = false,
  onClose,
  onOpenProfile,
  onAddMembers,
  onPromote,
  onDemote,
  onTransfer,
  onRemove,
}: GroupMembersSheetProps) {
  const colors = useTheme();
  const isDesktop = useIsDesktopWeb();
  const styles = useThemedStyles((theme) => createStyles(theme, isDesktop));
  const [selected, setSelected] = useState<ChatMember | null>(null);

  const canManage = !readOnly && (myRole === 'owner' || myRole === 'admin');
  const isOwner = myRole === 'owner';

  const actions = useMemo(() => {
    if (!selected || !canManage || selected.id === myUserId) {
      return [];
    }
    const items: Array<{
      key: string;
      label: string;
      icon: keyof typeof Ionicons.glyphMap;
      danger?: boolean;
      run: () => void;
    }> = [];

    if (isOwner && selected.role === 'member') {
      items.push({
        key: 'promote',
        label: 'Сделать администратором',
        icon: 'shield-checkmark-outline',
        run: () => onPromote?.(selected.id),
      });
    }
    if (isOwner && selected.role === 'admin') {
      items.push({
        key: 'demote',
        label: 'Снять администратора',
        icon: 'shield-outline',
        run: () => onDemote?.(selected.id),
      });
    }
    if (isOwner && selected.role !== 'owner') {
      items.push({
        key: 'transfer',
        label: 'Передать права создателя',
        icon: 'key-outline',
        run: () => onTransfer?.(selected.id),
      });
    }

    const canKick =
      selected.role !== 'owner' &&
      (isOwner || (myRole === 'admin' && selected.role === 'member'));
    if (canKick) {
      items.push({
        key: 'remove',
        label: 'Исключить из группы',
        icon: 'person-remove-outline',
        danger: true,
        run: () => onRemove?.(selected.id),
      });
    }

    return items;
  }, [
    canManage,
    isOwner,
    myRole,
    myUserId,
    onDemote,
    onPromote,
    onRemove,
    onTransfer,
    selected,
  ]);

  const closeActions = () => setSelected(null);

  return (
    <Modal
      visible={visible}
      transparent
      animationType={isDesktop ? 'fade' : 'slide'}
      onRequestClose={onClose}>
      <Pressable style={styles.root} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          {!isDesktop ? <View style={styles.handle} /> : null}
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.title} numberOfLines={2}>
                {title}
              </Text>
              <Text style={styles.subtitle}>
                {loading ? 'Загружаем…' : `${members.length} участников`}
              </Text>
            </View>
            {canManage && onAddMembers ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Добавить участников"
                disabled={busy}
                onPress={onAddMembers}
                style={styles.addBtn}>
                {busy ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <Ionicons name="person-add-outline" size={16} color={colors.primary} />
                    <Text style={styles.addBtnLabel}>Добавить</Text>
                  </>
                )}
              </Pressable>
            ) : null}
          </View>
          <ScrollView style={styles.list} nestedScrollEnabled>
            {!loading && members.length === 0 ? (
              <Text style={styles.empty}>Пока никого нет</Text>
            ) : (
              members.map((member) => {
                const initial = [...member.nickname.trim()][0]?.toUpperCase() ?? '?';
                const badge = roleLabel(member.role);
                const showManage =
                  canManage &&
                  member.id !== myUserId &&
                  member.role !== 'owner' &&
                  (isOwner || member.role === 'member');
                return (
                  <Pressable
                    key={member.id}
                    accessibilityRole="button"
                    onPress={() => onOpenProfile(member.id)}
                    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                    <View style={styles.avatar}>
                      {member.avatarUrl ? (
                        <Image source={{ uri: member.avatarUrl }} style={styles.avatarImage} />
                      ) : (
                        <Text style={styles.avatarInitial}>{initial}</Text>
                      )}
                    </View>
                    <View style={styles.body}>
                      <Text style={styles.name} numberOfLines={1}>
                        {member.nickname}
                        {member.id === myUserId ? ' (вы)' : ''}
                      </Text>
                      <Text style={styles.meta}>
                        {member.online ? 'в сети' : 'был(а) недавно'}
                      </Text>
                    </View>
                    {badge ? (
                      <View
                        style={[
                          styles.roleBadge,
                          member.role === 'admin' && styles.roleBadgeAdmin,
                        ]}>
                        <Text
                          style={[
                            styles.roleLabel,
                            member.role === 'admin' && styles.roleLabelAdmin,
                          ]}>
                          {badge}
                        </Text>
                      </View>
                    ) : null}
                    {showManage ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Управление ${member.nickname}`}
                        hitSlop={8}
                        disabled={busy}
                        onPress={(event) => {
                          event.stopPropagation?.();
                          setSelected(member);
                        }}
                        style={styles.manageBtn}>
                        <Ionicons
                          name="ellipsis-horizontal"
                          size={18}
                          color={colors.textSubtle}
                        />
                      </Pressable>
                    ) : null}
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </Pressable>
      </Pressable>

      <Modal
        visible={Boolean(selected)}
        transparent
        animationType="fade"
        onRequestClose={closeActions}>
        <Pressable style={styles.actionRoot} onPress={closeActions}>
          <Pressable style={styles.actionSheet} onPress={(e) => e.stopPropagation()}>
            {!isDesktop ? <View style={styles.handle} /> : null}
            <Text style={styles.actionTitle} numberOfLines={1}>
              {selected?.nickname}
            </Text>
            {actions.map((action) => (
              <Pressable
                key={action.key}
                accessibilityRole="button"
                disabled={busy}
                onPress={() => {
                  closeActions();
                  action.run();
                }}
                style={({ pressed }) => [
                  styles.actionItem,
                  pressed && styles.actionItemPressed,
                ]}>
                <Ionicons
                  name={action.icon}
                  size={20}
                  color={action.danger ? colors.destructive : colors.primary}
                />
                <Text
                  style={[styles.actionLabel, action.danger && styles.actionDanger]}>
                  {action.label}
                </Text>
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="button"
              onPress={closeActions}
              style={styles.actionCancel}>
              <Text style={styles.actionCancelLabel}>Отмена</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </Modal>
  );
}
