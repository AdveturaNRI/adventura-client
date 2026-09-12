import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FontSize, Radius, Sizes, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

type FinalStepActionsProps = {
  continueLabel: string;
  deleteLabel: string;
  savingLabel: string;
  editLabel?: string;
  isSaving?: boolean;
  /** Анкета уже сохранена и заполнена — «Готово» уводит дальше, «Редактировать» отдельно */
  showEdit?: boolean;
  onContinue: () => void;
  onEdit?: () => void;
  onDelete: () => void;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      width: '100%',
      maxWidth: 360,
      alignSelf: 'center',
      alignItems: 'center',
      gap: Spacing.md,
      paddingTop: Spacing.xs,
    },
    primaryButton: {
      alignSelf: 'stretch',
      minHeight: Sizes.controlHeight,
      borderRadius: Radius.pill,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingHorizontal: Spacing.lg,
      backgroundColor: colors.primary,
    },
    primaryLabel: {
      fontSize: FontSize.button,
      fontWeight: '600',
      color: colors.onPrimary,
      letterSpacing: -0.2,
    },
    secondaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
    },
    secondaryLabel: {
      fontSize: FontSize.label,
      fontWeight: '600',
      color: colors.primary,
      letterSpacing: -0.1,
    },
    deleteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
    },
    deleteLabel: {
      fontSize: FontSize.label,
      fontWeight: '500',
      color: colors.textMuted,
      letterSpacing: -0.1,
    },
    pressedPrimary: {
      opacity: 0.9,
    },
    pressedSecondary: {
      opacity: 0.7,
    },
    pressedDelete: {
      opacity: 0.7,
    },
    deletePressedLabel: {
      color: colors.destructive,
    },
    disabled: {
      opacity: 0.55,
    },
  });
}

export function FinalStepActions({
  continueLabel,
  deleteLabel,
  savingLabel,
  editLabel = 'Редактировать',
  isSaving = false,
  showEdit = false,
  onContinue,
  onEdit,
  onDelete,
}: FinalStepActionsProps) {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);

  const primaryLabel = isSaving ? savingLabel : continueLabel;

  return (
    <View style={styles.root}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={primaryLabel}
        disabled={isSaving}
        onPress={isSaving ? undefined : onContinue}
        style={({ pressed }) => [
          styles.primaryButton,
          pressed && !isSaving && styles.pressedPrimary,
          isSaving && styles.disabled,
        ]}>
        {!isSaving ? (
          <Ionicons name="checkmark-circle-outline" size={18} color={colors.onPrimary} />
        ) : null}
        <Text style={styles.primaryLabel}>{primaryLabel}</Text>
      </Pressable>

      {showEdit && onEdit ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={editLabel}
          disabled={isSaving}
          onPress={isSaving ? undefined : onEdit}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && !isSaving && styles.pressedSecondary,
            isSaving && styles.disabled,
          ]}>
          {!isSaving ? <Ionicons name="create-outline" size={15} color={colors.primary} /> : null}
          <Text style={styles.secondaryLabel}>{isSaving ? savingLabel : editLabel}</Text>
        </Pressable>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={deleteLabel}
        disabled={isSaving}
        onPress={isSaving ? undefined : onDelete}
        style={({ pressed }) => [
          styles.deleteButton,
          pressed && !isSaving && styles.pressedDelete,
          isSaving && styles.disabled,
        ]}>
        {({ pressed }) => (
          <>
            {!isSaving ? (
              <Ionicons
                name="trash-outline"
                size={15}
                color={pressed ? colors.destructive : colors.textMuted}
              />
            ) : null}
            <Text
              style={[
                styles.deleteLabel,
                pressed && !isSaving ? styles.deletePressedLabel : null,
              ]}>
              {isSaving ? savingLabel : deleteLabel}
            </Text>
          </>
        )}
      </Pressable>
    </View>
  );
}
