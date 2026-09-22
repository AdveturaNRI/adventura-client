import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

type DeleteAuthorPostDialogProps = {
  visible: boolean;
  postTitle?: string;
  onConfirm: () => void;
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
      backgroundColor: 'rgba(255, 59, 48, 0.12)',
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
    confirmLabel: {
      fontSize: FontSize.button,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    cancelButton: {
      minHeight: 48,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.lg,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
    },
    cancelLabel: {
      fontSize: FontSize.button,
      fontWeight: '600',
      color: colors.text,
    },
  });
}

export function DeleteAuthorPostDialog({
  visible,
  postTitle,
  onConfirm,
  onCancel,
}: DeleteAuthorPostDialogProps) {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <Ionicons name="trash-outline" size={20} color={colors.destructive} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.title}>Удалить публикацию?</Text>
              <Text style={styles.message}>
                {postTitle
                  ? `«${postTitle}» пропадёт из «Публикаций». Вернуть не получится.`
                  : 'Публикация пропадёт из ленты. Вернуть не получится.'}
              </Text>
            </View>
          </View>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Удалить"
              onPress={onConfirm}
              style={({ pressed }) => [styles.confirmButton, pressed && { opacity: 0.88 }]}>
              <Text style={styles.confirmLabel}>Удалить</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Отмена"
              onPress={onCancel}
              style={({ pressed }) => [styles.cancelButton, pressed && { opacity: 0.88 }]}>
              <Text style={styles.cancelLabel}>Отмена</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
