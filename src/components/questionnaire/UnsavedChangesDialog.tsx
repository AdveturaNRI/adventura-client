import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

type UnsavedChangesDialogProps = {
  visible: boolean;
  title: string;
  message: string;
  saveLabel: string;
  discardLabel: string;
  cancelLabel: string;
  isSaving?: boolean;
  onSave: () => void;
  onDiscard: () => void;
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

export function UnsavedChangesDialog({
  visible,
  title,
  message,
  saveLabel,
  discardLabel,
  cancelLabel,
  isSaving = false,
  onSave,
  onDiscard,
  onCancel,
}: UnsavedChangesDialogProps) {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={isSaving ? undefined : onCancel}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <Ionicons name="warning-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.message}>{message}</Text>
            </View>
          </View>

          <View style={styles.actions}>
            <Button label={isSaving ? 'Сохраняем...' : saveLabel} onPress={isSaving ? undefined : onSave} />
            <Button
              label={discardLabel}
              variant="outline"
              onPress={isSaving ? undefined : onDiscard}
            />
            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              onPress={onCancel}
              style={({ pressed }) => [styles.cancelButton, pressed ? styles.cancelPressed : null]}>
              <Text style={styles.cancelLabel}>{cancelLabel}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
