import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

type DeleteChatDialogProps = {
  visible: boolean;
  nickname: string;
  isDeleting?: boolean;
  /** Overrides default «Удалить чат» copy. */
  title?: string;
  message?: string;
  confirmLabel?: string;
  onDeleteForMe: () => void;
  onDeleteForEveryone?: () => void;
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
    secondaryButton: {
      minHeight: 48,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.lg,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pressed: {
      opacity: 0.85,
    },
    confirmLabel: {
      fontSize: FontSize.button,
      fontWeight: '500',
      color: colors.onPrimary,
    },
    secondaryLabel: {
      fontSize: FontSize.button,
      fontWeight: '500',
      color: colors.destructive,
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

export function DeleteChatDialog({
  visible,
  nickname,
  isDeleting = false,
  title,
  message,
  confirmLabel,
  onDeleteForMe,
  onDeleteForEveryone,
  onCancel,
}: DeleteChatDialogProps) {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={isDeleting ? undefined : onCancel}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <Ionicons name="trash-outline" size={20} color={colors.destructive} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.title}>{title ?? 'Удалить чат'}</Text>
              <Text style={styles.message}>
                {message ??
                  (onDeleteForEveryone
                    ? `Переписка с ${nickname}. Можно убрать только у себя или удалить у обоих.`
                    : `Чат «${nickname}». Скроется только у вас.`)}
              </Text>
            </View>
          </View>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={isDeleting}
              onPress={isDeleting ? undefined : onDeleteForMe}
              style={({ pressed }) => [
                onDeleteForEveryone ? styles.secondaryButton : styles.confirmButton,
                pressed && !isDeleting && styles.pressed,
                isDeleting ? { opacity: 0.7 } : undefined,
              ]}>
              <Text
                style={onDeleteForEveryone ? styles.secondaryLabel : styles.confirmLabel}>
                {isDeleting
                  ? 'Удаляем...'
                  : confirmLabel ??
                    (onDeleteForEveryone ? 'Только у меня' : 'Скрыть у меня')}
              </Text>
            </Pressable>
            {onDeleteForEveryone ? (
              <Pressable
                accessibilityRole="button"
                disabled={isDeleting}
                onPress={isDeleting ? undefined : onDeleteForEveryone}
                style={({ pressed }) => [
                  styles.confirmButton,
                  pressed && !isDeleting && styles.pressed,
                  isDeleting ? { opacity: 0.7 } : undefined,
                ]}>
                <Text style={styles.confirmLabel}>У меня и у собеседника</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={isDeleting}
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
