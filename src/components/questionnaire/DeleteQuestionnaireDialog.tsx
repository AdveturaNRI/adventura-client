import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import {
  QUESTIONNAIRE_DELETE_CANCEL_LABEL,
  QUESTIONNAIRE_DELETE_CONFIRM_LABEL,
  QUESTIONNAIRE_DELETE_MESSAGE,
  QUESTIONNAIRE_DELETE_TITLE,
} from '@/screens/questionnaire/questionnaire.config';

type DeleteQuestionnaireDialogProps = {
  visible: boolean;
  isDeleting?: boolean;
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
    confirmButtonPressed: {
      opacity: 0.85,
    },
    confirmButtonLabel: {
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
    cancelPressed: {
      opacity: 0.75,
    },
  });
}

export function DeleteQuestionnaireDialog({
  visible,
  isDeleting = false,
  onConfirm,
  onCancel,
}: DeleteQuestionnaireDialogProps) {
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
              <Text style={styles.title}>{QUESTIONNAIRE_DELETE_TITLE}</Text>
              <Text style={styles.message}>{QUESTIONNAIRE_DELETE_MESSAGE}</Text>
            </View>
          </View>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={isDeleting}
              onPress={isDeleting ? undefined : onConfirm}
              style={({ pressed }) => [
                styles.confirmButton,
                pressed && !isDeleting && styles.confirmButtonPressed,
                isDeleting ? { opacity: 0.7 } : undefined,
              ]}>
              <Text style={styles.confirmButtonLabel}>
                {isDeleting ? 'Удаляем...' : QUESTIONNAIRE_DELETE_CONFIRM_LABEL}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isDeleting}
              onPress={onCancel}
              style={({ pressed }) => [styles.cancelButton, pressed ? styles.cancelPressed : null]}>
              <Text style={styles.cancelLabel}>{QUESTIONNAIRE_DELETE_CANCEL_LABEL}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
