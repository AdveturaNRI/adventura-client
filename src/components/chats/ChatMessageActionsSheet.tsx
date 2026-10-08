import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { FontSize, Radius, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { CHAT_REACTION_EMOJIS } from '@/services/chats/chatsApi';

function ReactionButton({
  emoji,
  selected,
  colors,
  onReact,
}: {
  emoji: string;
  selected: boolean;
  colors: ThemeColors;
  onReact: (emoji: string) => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Поставить реакцию ${emoji}`}
      onPress={() => onReact(emoji)}
      style={({ pressed }) => [
        {
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: selected ? colors.primary + '25' : colors.surfaceMuted,
        },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={{ fontSize: 23 }}>{emoji}</Text>
    </Pressable>
  );
}

type ChatMessageActionsSheetProps = {
  visible: boolean;
  onClose: () => void;
  onReply: () => void;
  onForward: () => void;
  onSelectMore: () => void;
  onCopy?: () => void;
  allowForward?: boolean;
  allowCopy?: boolean;
  onReact: (emoji: string) => void;
  selectedEmoji?: string | null;
  reactionOrder?: string[];
};

function createStyles(colors: ThemeColors, isDesktopWeb: boolean) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: isDesktopWeb ? 'flex-start' : 'flex-end',
      alignItems: isDesktopWeb ? 'center' : 'stretch',
      paddingHorizontal: isDesktopWeb ? Spacing.lg : 0,
      paddingVertical: isDesktopWeb ? Spacing.xl : 0,
    },
    sheet: {
      width: '100%',
      maxWidth: isDesktopWeb ? 380 : undefined,
      // Keep the hover target anchored while the reaction grid grows. Centering
      // a height-animated sheet moves it underneath a stationary mouse pointer,
      // repeatedly firing hover-in/hover-out on desktop.
      ...(isDesktopWeb ? { position: 'absolute' as const, top: '12%' as const } : {}),
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
  onCopy,
  allowForward = true,
  allowCopy = false,
  onReact,
  selectedEmoji,
  reactionOrder,
}: ChatMessageActionsSheetProps) {
  const colors = useTheme();
  const isDesktopWeb = useIsDesktopWeb();
  const [reactionColumns, setReactionColumns] = useState(7);
  const reactionsExpanded = useRef(false);
  const reactionHeight = useRef(new Animated.Value(56)).current;
  const reactions = reactionOrder?.length ? reactionOrder : CHAT_REACTION_EMOJIS;
  const styles = useThemedStyles((theme) => createStyles(theme, isDesktopWeb));

  const animateReactions = useCallback((expanded: boolean) => {
    if (reactionsExpanded.current === expanded) return;
    reactionsExpanded.current = expanded;
    Animated.timing(reactionHeight, {
      toValue: expanded ? Math.ceil(reactions.length / reactionColumns) * 46 + 16 : 56,
      duration: expanded ? 240 : 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [reactionColumns, reactionHeight, reactions.length]);

  useEffect(() => {
    if (!visible) {
      reactionsExpanded.current = false;
      reactionHeight.setValue(56);
    }
  }, [reactionHeight, visible]);

  if (!visible) {
    return null;
  }

  return (
    <Modal visible transparent animationType={isDesktopWeb ? 'fade' : 'slide'} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" />
        <Pressable
          style={styles.sheet}
          onHoverIn={isDesktopWeb ? () => {
            // Expand once per opened menu. Do not collapse on hover-out: the
            // animated grid changes hit-testing boundaries in React Native Web
            // and can otherwise oscillate while the pointer is stationary.
            animateReactions(true);
          } : undefined}
        >
          <Text style={styles.title}>Сообщение</Text>
          {isDesktopWeb ? (
            <View style={{ paddingHorizontal: Spacing.md }}>
              <Animated.View
                onLayout={(event) => {
                  const columns = Math.max(1, Math.floor((event.nativeEvent.layout.width + 6) / 46));
                  setReactionColumns((current) => current === columns ? current : columns);
                }}
                style={{ height: reactionHeight, overflow: 'hidden', paddingVertical: Spacing.sm }}
              >
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {reactions.map((emoji) => (
                    <ReactionButton key={emoji} emoji={emoji} selected={selectedEmoji === emoji} colors={colors} onReact={onReact} />
                  ))}
                </View>
              </Animated.View>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator
              contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.sm }}
            >
              {reactions.map((emoji) => (
                <ReactionButton key={emoji} emoji={emoji} selected={selectedEmoji === emoji} colors={colors} onReact={onReact} />
              ))}
            </ScrollView>
          )}
          {allowCopy && onCopy ? (
            <Pressable
              accessibilityRole="button"
              onPress={onCopy}
              style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
            >
              <Ionicons name="copy-outline" size={20} color={colors.primary} />
              <Text style={styles.actionLabel}>Копировать</Text>
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" onPress={onReply} style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}>
            <Ionicons name="arrow-undo-outline" size={20} color={colors.primary} />
            <Text style={styles.actionLabel}>Ответить</Text>
          </Pressable>
          {allowForward ? (
            <Pressable
              accessibilityRole="button"
              onPress={onForward}
              style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
            >
              <Ionicons name="arrow-redo-outline" size={20} color={colors.primary} />
              <Text style={styles.actionLabel}>Переслать</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={onSelectMore}
            style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
          >
            <Ionicons name="checkbox-outline" size={20} color={colors.primary} />
            <Text style={styles.actionLabel}>Выбрать несколько</Text>
          </Pressable>
        </Pressable>
      </View>
    </Modal>
  );
}
