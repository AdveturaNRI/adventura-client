import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

type BlockUserDialogProps = {
  visible: boolean;
  nickname: string;
  isBusy?: boolean;
  onConfirm: (deleteChat: boolean) => void;
  onCancel: () => void;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
    },
    sheet: {
      width: '100%',
      maxWidth: 420,
      borderRadius: 20,
      backgroundColor: colors.surface,
      padding: Spacing.lg,
      gap: Spacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
    },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceMuted,
      flexShrink: 0,
    },
    headerText: {
      flex: 1,
      gap: Spacing.xs,
      paddingTop: 2,
    },
    title: {
      fontSize: FontSize.button,
      fontWeight: '700',
      color: colors.text,
    },
    message: {
      fontSize: FontSize.label,
      color: colors.textSecondary,
      lineHeight: FontSize.label * 1.5,
    },
    checkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.xs,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    checkboxChecked: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    checkLabel: {
      fontSize: FontSize.label,
      fontWeight: '600',
      color: colors.text,
    },
    actions: {
      gap: Spacing.sm,
      paddingTop: Spacing.xs,
    },
    confirmButton: {
      minHeight: 48,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.lg,
      backgroundColor: colors.destructive,
    },
    pressed: {
      opacity: 0.85,
    },
    confirmLabel: {
      fontSize: FontSize.button,
      fontWeight: '500',
      color: colors.onPrimary,
    },
    cancelButton: {
      alignSelf: 'center',
      paddingVertical: Spacing.xs,
      paddingHorizontal: Spacing.sm,
    },
    cancelLabel: {
      fontSize: FontSize.label,
      fontWeight: '500',
      color: colors.textMuted,
    },
  });
}

export function BlockUserDialog({
  visible,
  nickname,
  isBusy = false,
  onConfirm,
  onCancel,
}: BlockUserDialogProps) {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const [deleteChat, setDeleteChat] = useState(false);

  useEffect(() => {
    if (visible) {
      setDeleteChat(false);
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={isBusy ? undefined : onCancel}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <Ionicons name="ban-outline" size={20} color={colors.destructive} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.title}>Заблокировать</Text>
              <Text style={styles.message}>
                {`${nickname} больше не сможет писать вам.`}
              </Text>
            </View>
          </View>

          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: deleteChat }}
            disabled={isBusy}
            onPress={() => setDeleteChat((value) => !value)}
            style={styles.checkRow}>
            <View style={[styles.checkbox, deleteChat && styles.checkboxChecked]}>
              {deleteChat ? (
                <Ionicons name="checkmark" size={14} color={colors.onPrimary} />
              ) : null}
            </View>
            <Text style={styles.checkLabel}>Удалить чат</Text>
          </Pressable>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={isBusy}
              onPress={isBusy ? undefined : () => onConfirm(deleteChat)}
              style={({ pressed }) => [
                styles.confirmButton,
                pressed && !isBusy && styles.pressed,
                isBusy ? { opacity: 0.7 } : undefined,
              ]}>
              <Text style={styles.confirmLabel}>
                {isBusy ? 'Блокируем...' : 'Заблокировать'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isBusy}
              onPress={onCancel}
              style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}>
              <Text style={styles.cancelLabel}>Отмена</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
