import { Pressable, StyleSheet, Text, View } from 'react-native';

import { UserAvatar } from '@/components/navigation/UserAvatar';
import { FontSize, Radius, Spacing, type ThemeColors } from '@/constants/theme';
import type { MockCharacter } from '@/data/characters/mock-characters';
import { useThemedStyles } from '@/hooks/use-themed-styles';

type CharacterCardProps = {
  item: MockCharacter;
  showOwner?: boolean;
  onSystemPress?: (system: string) => void;
};

const AVATAR_TINTS = [
  { backgroundColor: 'rgba(21, 122, 254, 0.22)', color: '#4B99FF' },
  { backgroundColor: 'rgba(52, 199, 89, 0.22)', color: '#34C759' },
  { backgroundColor: 'rgba(255, 149, 0, 0.22)', color: '#FF9F0A' },
  { backgroundColor: 'rgba(191, 90, 242, 0.24)', color: '#BF5AF2' },
];

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function tintForId(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash + id.charCodeAt(index) * (index + 1)) % AVATAR_TINTS.length;
  }
  return AVATAR_TINTS[hash] ?? AVATAR_TINTS[0];
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      width: '100%',
      gap: Spacing.sm,
      padding: Spacing.md,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
    },
    characterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    avatarLabel: {
      fontSize: FontSize.button,
      fontWeight: '700',
    },
    body: {
      flex: 1,
      minWidth: 0,
      gap: 4,
    },
    name: {
      fontSize: FontSize.button,
      fontWeight: '700',
      color: colors.text,
    },
    meta: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 2,
    },
    systemChip: {
      maxWidth: '100%',
      minHeight: 26,
      paddingHorizontal: 10,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.35)',
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
      justifyContent: 'center',
    },
    systemChipLabel: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.primary,
    },
    authorSection: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingTop: Spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    authorCopy: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    authorName: {
      fontSize: FontSize.label,
      fontWeight: '700',
      color: colors.text,
    },
    authorBadge: {
      alignSelf: 'flex-start',
      minHeight: 20,
      paddingHorizontal: 8,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.35)',
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
      justifyContent: 'center',
    },
    authorBadgeLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
    },
  });
}

export function CharacterCard({ item, showOwner = true, onSystemPress }: CharacterCardProps) {
  const styles = useThemedStyles(createStyles);
  const tint = tintForId(item.id);
  const summary = `${item.race} · ${item.className} · ур. ${item.level}`;

  return (
    <View style={styles.card}>
      <View style={styles.characterRow}>
        <View style={[styles.avatar, { backgroundColor: tint.backgroundColor }]}>
          <Text style={[styles.avatarLabel, { color: tint.color }]}>
            {initialsFromName(item.name)}
          </Text>
        </View>
        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {summary}
          </Text>
          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Фильтр по системе ${item.system}`}
              disabled={!onSystemPress}
              onPress={() => onSystemPress?.(item.system)}
              style={({ pressed }) => [styles.systemChip, pressed && { opacity: 0.85 }]}>
              <Text style={styles.systemChipLabel} numberOfLines={1}>
                {item.system}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {showOwner ? (
        <View
          style={styles.authorSection}
          accessibilityRole="text"
          accessibilityLabel={`Автор ${item.ownerName}`}>
          <UserAvatar nickname={item.ownerName} size={32} />
          <View style={styles.authorCopy}>
            <Text style={styles.authorName} numberOfLines={1}>
              {item.ownerName}
            </Text>
            <View style={styles.authorBadge}>
              <Text style={styles.authorBadgeLabel}>Автор</Text>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}
