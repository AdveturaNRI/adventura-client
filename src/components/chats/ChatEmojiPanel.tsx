import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Spacing, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

type EmojiCategory = {
  key: string;
  label: string;
  emojis: string[];
};

const EMOJI_SIZE = 40;
const PANEL_HEIGHT = 248;

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    key: 'smileys',
    label: '😊',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
      '🙂', '😉', '😍', '🥰', '😘', '😗', '😋', '😜', '🤪', '😝',
      '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶',
      '😏', '😒', '🙄', '😬', '😮‍💨', '🤥', '😌', '😔', '😪', '🤤',
      '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🥵', '🥶', '🥴', '😵',
      '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕', '😟', '🙁', '☹️',
      '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥',
      '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱',
      '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡',
      '👹', '👺', '👻', '👽', '👾', '🤖', '😺', '😸', '😹', '😻',
    ],
  },
  {
    key: 'gestures',
    label: '👍',
    emojis: [
      '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞',
      '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍',
      '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝',
      '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦵', '🦶', '👂', '👃',
    ],
  },
  {
    key: 'hearts',
    label: '❤️',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
      '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '♥️',
      '💋', '💌', '💤', '💢', '💥', '💫', '💦', '💨', '🕳️', '💬',
      '👁️‍🗨️', '🗨️', '🗯️', '💭', '🕐', '⭐', '🌟', '✨', '⚡', '🔥',
    ],
  },
  {
    key: 'objects',
    label: '🎲',
    emojis: [
      '🎮', '🕹️', '🎲', '🧩', '🎯', '🏆', '🥇', '🥈', '🥉', '🎖️',
      '🎗️', '🎫', '🎟️', '🎪', '🎭', '🩰', '🎨', '🎬', '🎤', '🎧',
      '🎼', '🎹', '🥁', '🎷', '🎺', '🎸', '🪕', '🎻', '🎲', '♟️',
      '📚', '📖', '📝', '✏️', '📌', '📎', '🔗', '💡', '🔦', '🕯️',
      '📱', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '💾', '💿', '📷', '📹',
    ],
  },
  {
    key: 'nature',
    label: '🌿',
    emojis: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯',
      '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔',
      '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺',
      '🌸', '💮', '🏵️', '🌹', '🥀', '🌺', '🌻', '🌼', '🌷', '🌱',
      '🌲', '🌳', '🌴', '🌵', '🌾', '🌿', '☘️', '🍀', '🍁', '🍂',
    ],
  },
  {
    key: 'food',
    label: '🍕',
    emojis: [
      '🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐',
      '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑',
      '🍔', '🍟', '🍕', '🌭', '🥪', '🌮', '🌯', '🥙', '🧆', '🥚',
      '🍳', '🥘', '🍲', '🥣', '🥗', '🍿', '🧈', '🧂', '🥫', '🍱',
      '☕', '🍵', '🧃', '🥤', '🧋', '🍶', '🍺', '🍻', '🥂', '🍷',
    ],
  },
];

type ChatEmojiPanelProps = {
  onSelect: (emoji: string) => void;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      height: PANEL_HEIGHT,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderLight,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    categoriesBar: {
      height: 48,
      flexShrink: 0,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
      justifyContent: 'center',
    },
    categoriesContent: {
      alignItems: 'center',
      paddingHorizontal: Spacing.sm,
      gap: 4,
    },
    categoryButton: {
      width: EMOJI_SIZE,
      height: EMOJI_SIZE,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    categoryButtonActive: {
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
    },
    categoryLabel: {
      fontSize: 22,
      lineHeight: 28,
      textAlign: 'center',
    },
    grid: {
      flex: 1,
      minHeight: 0,
    },
    gridContent: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: Spacing.sm,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.md,
    },
    emojiButton: {
      width: EMOJI_SIZE,
      height: EMOJI_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
    },
    emojiButtonPressed: {
      backgroundColor: colors.surfaceMuted,
    },
    emoji: {
      fontSize: 24,
      lineHeight: 30,
      textAlign: 'center',
    },
  });
}

export function ChatEmojiPanel({ onSelect }: ChatEmojiPanelProps) {
  const styles = useThemedStyles(createStyles);
  const [activeKey, setActiveKey] = useState(EMOJI_CATEGORIES[0]?.key ?? 'smileys');

  const activeCategory = useMemo(
    () => EMOJI_CATEGORIES.find((item) => item.key === activeKey) ?? EMOJI_CATEGORIES[0],
    [activeKey],
  );

  return (
    <View style={styles.root}>
      <View style={styles.categoriesBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.categoriesContent}>
          {EMOJI_CATEGORIES.map((category) => {
            const active = category.key === activeCategory.key;
            return (
              <Pressable
                key={category.key}
                accessibilityRole="button"
                accessibilityLabel={`Категория ${category.label}`}
                onPress={() => setActiveKey(category.key)}
                style={[styles.categoryButton, active ? styles.categoryButtonActive : null]}>
                <Text style={styles.categoryLabel}>{category.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.grid}
        contentContainerStyle={styles.gridContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {activeCategory.emojis.map((emoji, index) => (
          <Pressable
            key={`${activeCategory.key}-${emoji}-${index}`}
            accessibilityRole="button"
            accessibilityLabel={`Эмодзи ${emoji}`}
            onPress={() => onSelect(emoji)}
            style={({ pressed }) => [
              styles.emojiButton,
              pressed ? styles.emojiButtonPressed : null,
            ]}>
            <Text style={styles.emoji}>{emoji}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
