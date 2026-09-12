import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { FontSize, Radius, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

const FAVORITE_GOLD = '#C9A227';

export type NotificationCardVariant = 'favorite' | 'returned' | 'default';

export type NotificationCardProps = {
  actorName: string;
  actorAvatarUrl?: string | null;
  actionText: string;
  messageText: string;
  subject?: string;
  imageUrl?: string | null;
  timestamp: string;
  buttonLabel?: string;
  onButtonPress?: () => void;
  onDeletePress?: () => void;
  unread?: boolean;
  variant?: NotificationCardVariant;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.md,
      gap: Spacing.sm,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 2,
    },
    cardUnread: {
      borderColor: colors.primary,
      backgroundColor: colors.surfaceMuted,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
    },
    avatarWrap: {
      width: 40,
      height: 40,
      flexShrink: 0,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.avatar,
      overflow: 'hidden',
    },
    avatarFavorite: {
      borderWidth: 1,
      borderColor: FAVORITE_GOLD,
    },
    avatarImage: {
      width: '100%',
      height: '100%',
    },
    avatarInitial: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    avatarInitialText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.onPrimary,
    },
    crownSeal: {
      position: 'absolute',
      right: -2,
      bottom: -2,
      width: 16,
      height: 16,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: FAVORITE_GOLD,
    },
    content: {
      flex: 1,
      minWidth: 0,
      gap: 6,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
    },
    textBlock: {
      flex: 1,
      minWidth: 0,
      gap: 4,
    },
    actorName: {
      fontSize: FontSize.button,
      fontWeight: '700',
      color: colors.text,
    },
    message: {
      fontSize: FontSize.label,
      color: colors.text,
      lineHeight: FontSize.label * 1.4,
    },
    actionText: {
      fontWeight: '600',
      color: '#9A7518',
    },
    subject: {
      fontSize: FontSize.label,
      color: colors.text,
    },
    actionButton: {
      minHeight: 32,
      paddingHorizontal: 10,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: 'rgba(201, 162, 39, 0.45)',
      backgroundColor: 'rgba(212, 175, 55, 0.14)',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      flexShrink: 0,
    },
    actionButtonPressed: {
      opacity: 0.85,
    },
    actionButtonLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: '#9A7518',
    },
    imageWrap: {
      borderRadius: 10,
      overflow: 'hidden',
      backgroundColor: colors.placeholderAlt,
      aspectRatio: 16 / 9,
    },
    image: {
      width: '100%',
      height: '100%',
    },
    footerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 4,
    },
    timestamp: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
    },
    deleteButton: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    deleteButtonPressed: {
      opacity: 0.7,
      backgroundColor: colors.surfaceMuted,
    },
  });
}

function ActorAvatar({
  name,
  avatarUrl,
  styles,
  showCrown,
}: {
  name: string;
  avatarUrl?: string | null;
  styles: ReturnType<typeof createStyles>;
  showCrown: boolean;
}) {
  const initial = [...name.trim()][0]?.toUpperCase() ?? '?';

  return (
    <View style={styles.avatarWrap}>
      <View style={[styles.avatar, showCrown && styles.avatarFavorite]}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatarImage} accessibilityLabel={name} />
        ) : (
          <View style={styles.avatarInitial}>
            <Text style={styles.avatarInitialText}>{initial}</Text>
          </View>
        )}
      </View>
      {showCrown ? (
        <View style={styles.crownSeal}>
          <MaterialCommunityIcons name="crown" size={9} color={FAVORITE_GOLD} />
        </View>
      ) : null}
    </View>
  );
}

export function NotificationCard({
  actorName,
  actorAvatarUrl,
  actionText,
  messageText,
  subject,
  imageUrl,
  timestamp,
  buttonLabel = 'Написать',
  onButtonPress,
  onDeletePress,
  unread = false,
  variant = 'default',
}: NotificationCardProps) {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const isFavorite = variant === 'favorite' || variant === 'returned';

  return (
    <View style={[styles.card, unread && styles.cardUnread]}>
      <View style={styles.headerRow}>
        <ActorAvatar
          name={actorName}
          avatarUrl={actorAvatarUrl}
          styles={styles}
          showCrown={isFavorite}
        />

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <View style={styles.textBlock}>
              <Text style={styles.actorName}>{actorName}</Text>
              <Text style={styles.message}>
                <Text style={styles.actionText}>{actionText}</Text>
                {messageText}
              </Text>
              {subject ? <Text style={styles.subject}>{subject}</Text> : null}
            </View>

            {onButtonPress ? (
              <Pressable
                accessibilityRole="button"
                onPress={onButtonPress}
                style={({ pressed }) => [
                  styles.actionButton,
                  pressed && styles.actionButtonPressed,
                ]}>
                <MaterialCommunityIcons name="crown" size={13} color="#9A7518" />
                <Text style={styles.actionButtonLabel}>{buttonLabel}</Text>
              </Pressable>
            ) : null}
          </View>

          {imageUrl ? (
            <View style={styles.imageWrap}>
              <Image source={{ uri: imageUrl }} style={styles.image} accessibilityLabel={subject} />
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.timestamp}>{timestamp}</Text>
        {onDeletePress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Удалить уведомление"
            hitSlop={8}
            onPress={onDeletePress}
            style={({ pressed }) => [
              styles.deleteButton,
              pressed && styles.deleteButtonPressed,
            ]}>
            <Ionicons name="trash-outline" size={15} color={colors.destructive} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
