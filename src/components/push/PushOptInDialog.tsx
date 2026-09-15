import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

type PushOptInDialogProps = {
  visible: boolean;
  busy?: boolean;
  onEnable: () => void;
  onLater: () => void;
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
      backgroundColor: colors.primaryLight,
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
    enableButton: {
      minHeight: 48,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.lg,
      backgroundColor: colors.primary,
    },
    pressed: {
      opacity: 0.85,
    },
    enableLabel: {
      fontSize: FontSize.button,
      fontWeight: '500',
      color: colors.onPrimary,
    },
    laterButton: {
      alignSelf: 'center',
      paddingVertical: Spacing.xs,
      paddingHorizontal: Spacing.sm,
    },
    laterLabel: {
      fontSize: FontSize.label,
      fontWeight: '500',
      color: colors.textMuted,
    },
  });
}

export function PushOptInDialog({
  visible,
  busy = false,
  onEnable,
  onLater,
}: PushOptInDialogProps) {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onLater}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <Ionicons name="notifications-outline" size={18} color={colors.primary} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.title}>Уведомления</Text>
              <Text style={styles.message}>
                Хотите вовремя узнавать об откликах на игры и новых сообщениях?
              </Text>
            </View>
          </View>

          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [styles.enableButton, pressed || busy ? styles.pressed : null]}
              disabled={busy}
              onPress={onEnable}>
              <Text style={styles.enableLabel}>{busy ? 'Подключаем…' : 'Включить'}</Text>
            </Pressable>
            <Pressable
              style={styles.laterButton}
              disabled={busy}
              onPress={onLater}
              accessibilityRole="button">
              <Text style={styles.laterLabel}>Позже</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
