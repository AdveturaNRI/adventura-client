import { Image } from 'expo-image';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import type { ChatMember } from '@/services/chats/chatsApi';

type GroupMembersSheetProps = {
  visible: boolean;
  title: string;
  members: ChatMember[];
  loading: boolean;
  onClose: () => void;
  onOpenProfile: (userId: string) => void;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
    sheet: {
      maxHeight: '70%',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      backgroundColor: colors.background,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.xl,
      borderTopWidth: 1,
      borderColor: colors.border,
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginBottom: Spacing.md,
    },
    title: {
      fontSize: FontSize.h1,
      fontWeight: '700',
      color: colors.text,
      paddingHorizontal: Spacing.lg,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: FontSize.caption,
      color: colors.primary,
      fontWeight: '600',
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.md,
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
    roleLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
    },
    empty: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      color: colors.textSecondary,
    },
  });
}

export function GroupMembersSheet({
  visible,
  title,
  members,
  loading,
  onClose,
  onOpenProfile,
}: GroupMembersSheetProps) {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.root} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          <Text style={styles.subtitle}>
            {loading ? 'Загружаем…' : `${members.length} участников`}
          </Text>
          <ScrollView>
            {!loading && members.length === 0 ? (
              <Text style={styles.empty}>Пока никого нет</Text>
            ) : (
              members.map((member) => {
                const initial = [...member.nickname.trim()][0]?.toUpperCase() ?? '?';
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
                      </Text>
                      <Text style={styles.meta}>
                        {member.online ? 'в сети' : 'был(а) недавно'}
                      </Text>
                    </View>
                    {member.role === 'owner' ? (
                      <View style={styles.roleBadge}>
                        <Text style={styles.roleLabel}>создатель</Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
