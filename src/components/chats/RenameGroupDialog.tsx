import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

type RenameGroupDialogProps = {
  visible: boolean;
  initialTitle: string;
  isBusy: boolean;
  onCancel: () => void;
  onSubmit: (title: string) => void;
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

export function RenameGroupDialog({
  visible,
  initialTitle,
  isBusy,
  onCancel,
  onSubmit,
}: RenameGroupDialogProps) {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const [title, setTitle] = useState(initialTitle);

  useEffect(() => {
    if (visible) {
      setTitle(initialTitle);
    }
  }, [initialTitle, visible]);

  const trimmed = title.trim();
  const canSubmit = trimmed.length > 0 && trimmed !== initialTitle.trim() && !isBusy;

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
          <Text style={styles.title}>Название группы</Text>
          <View>
            <Text style={styles.label}>Новое название</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Название"
              placeholderTextColor={colors.textSubtle}
              style={styles.input}
              maxLength={80}
              editable={!isBusy}
              autoFocus
            />
          </View>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              disabled={isBusy}
              style={[styles.button, styles.cancelBtn]}>
              <Text style={[styles.buttonLabel, styles.cancelLabel]}>Отмена</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => onSubmit(trimmed)}
              disabled={!canSubmit}
              style={[styles.button, styles.submitBtn, !canSubmit && styles.submitDisabled]}>
              {isBusy ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={[styles.buttonLabel, styles.submitLabel]}>Сохранить</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
