import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { FontSize, Radius, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

type ChatMessageActionsSheetProps = {
  visible: boolean;
  onClose: () => void;
  onReply: () => void;
  onForward: () => void;
  onSelectMore: () => void;
  allowForward?: boolean;
};

function createStyles(colors: ThemeColors, isDesktopWeb: boolean) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: isDesktopWeb ? 'center' : 'flex-end',
      alignItems: isDesktopWeb ? 'center' : 'stretch',
      paddingHorizontal: isDesktopWeb ? Spacing.lg : 0,
      paddingVertical: isDesktopWeb ? Spacing.xl : 0,
    },
    sheet: {
      width: '100%',
      maxWidth: isDesktopWeb ? 380 : undefined,
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderBottomLeftRadius: isDesktopWeb ? 20 : 0,
      borderBottomRightRadius: isDesktopWeb ? 20 : 0,
      paddingBottom: Spacing.lg,
      overflow: 'hidden',
    },
    title: {
      fontSize: FontSize.button,
      fontWeight: '600',
      color: colors.text,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
    },
    action: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
    },
    actionPressed: {
      backgroundColor: colors.surfaceMuted,
    },
    actionLabel: {
      fontSize: FontSize.input,
      color: colors.text,
      fontWeight: '500',
    },
  });
}

export function ChatMessageActionsSheet({
  visible,
  onClose,
  onReply,
  onForward,
  onSelectMore,
  allowForward = true,
}: ChatMessageActionsSheetProps) {
  const colors = useTheme();
  const isDesktopWeb = useIsDesktopWeb();
  const styles = useThemedStyles((theme) => createStyles(theme, isDesktopWeb));

  if (!visible) {
    return null;
  }

  return (
    <Modal visible transparent animationType={isDesktopWeb ? 'fade' : 'slide'} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" />
        <View style={styles.sheet}>
          <Text style={styles.title}>Сообщение</Text>
          <Pressable
            accessibilityRole="button"
            onPress={onReply}
            style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}>
            <Ionicons name="arrow-undo-outline" size={20} color={colors.primary} />
            <Text style={styles.actionLabel}>Ответить</Text>
          </Pressable>
          {allowForward ? (
            <Pressable
              accessibilityRole="button"
              onPress={onForward}
              style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}>
              <Ionicons name="arrow-redo-outline" size={20} color={colors.primary} />
              <Text style={styles.actionLabel}>Переслать</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={onSelectMore}
            style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}>
            <Ionicons name="checkbox-outline" size={20} color={colors.primary} />
            <Text style={styles.actionLabel}>Выбрать несколько</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
