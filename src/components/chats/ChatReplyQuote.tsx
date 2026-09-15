import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FontSize, Radius, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

export type ChatReplyPreviewData = {
  id: string;
  senderNickname: string;
  body: string | null;
  hasMedia: boolean;
};

type ChatReplyQuoteProps = {
  preview: ChatReplyPreviewData;
  mine?: boolean;
  compact?: boolean;
  onPress?: () => void;
  onClear?: () => void;
};

function previewText(preview: ChatReplyPreviewData) {
  const body = preview.body?.trim();
  if (body) {
    return body;
  }
  return preview.hasMedia ? 'Вложение' : 'Сообщение';
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
      paddingLeft: Spacing.sm,
      paddingVertical: 4,
      gap: 2,
      minWidth: 0,
    },
    wrapMine: {
      borderLeftColor: 'rgba(255,255,255,0.7)',
    },
    wrapComposer: {
      flex: 1,
      minWidth: 0,
      backgroundColor: colors.surfaceMuted,
      borderRadius: Radius.md,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    body: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    author: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.primary,
    },
    authorMine: {
      color: 'rgba(255,255,255,0.92)',
    },
    text: {
      fontSize: FontSize.caption,
      color: colors.textSecondary,
    },
    textMine: {
      color: 'rgba(255,255,255,0.82)',
    },
    clear: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}

export function ChatReplyQuote({
  preview,
  mine = false,
  compact = false,
  onPress,
  onClear,
}: ChatReplyQuoteProps) {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);

  if (onClear) {
    return (
      <View style={styles.wrapComposer}>
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          disabled={!onPress}
          style={styles.body}>
          <Text style={styles.author} numberOfLines={1}>
            {preview.senderNickname}
          </Text>
          <Text style={styles.text} numberOfLines={2}>
            {previewText(preview)}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Отменить ответ"
          onPress={onClear}
          hitSlop={8}
          style={styles.clear}>
          <Ionicons name="close" size={18} color={colors.textMuted} />
        </Pressable>
      </View>
    );
  }

  const content = (
    <View style={[styles.wrap, mine && styles.wrapMine, compact && { paddingVertical: 2 }]}>
      <Text style={[styles.author, mine && styles.authorMine]} numberOfLines={1}>
        {preview.senderNickname}
      </Text>
      <Text style={[styles.text, mine && styles.textMine]} numberOfLines={2}>
        {previewText(preview)}
      </Text>
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      {content}
    </Pressable>
  );
}
