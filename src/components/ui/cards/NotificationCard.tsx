import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

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
  /** Opens the actor profile — only avatar + nickname are interactive. */
  onActorPress?: () => void;
  /** Opens the related entity (game / club / profile). */
  onPress?: () => void;
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
    cardPressable: {
      ...Platform.select({
        web: { cursor: 'pointer' } as object,
        default: {},
      }),
    },
    cardPressed: {
      opacity: 0.92,
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
    avatarPressable: {
      borderRadius: 20,
      ...Platform.select({
        web: { cursor: 'pointer' } as object,
        default: {},
      }),
    },
    avatarPressableHover: {
      opacity: 0.88,
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
    actorNamePressable: {
      alignSelf: 'flex-start',
      maxWidth: '100%',
      borderRadius: 4,
      ...Platform.select({
        web: { cursor: 'pointer' } as object,
        default: {},
      }),
    },
    actorNamePressableHover: {
      opacity: 0.82,
    },
    actorName: {
      fontSize: FontSize.button,
      fontWeight: '700',
      color: colors.text,
    },
    actorNameInteractive: {
      color: colors.primary,
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
      ...Platform.select({
        web: { cursor: 'pointer' } as object,
        default: {},
      }),
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
  onPress,
}: {
  name: string;
  avatarUrl?: string | null;
  styles: ReturnType<typeof createStyles>;
  showCrown: boolean;
  onPress?: () => void;
}) {
  const initial = [...name.trim()][0]?.toUpperCase() ?? '?';

  const avatar = (
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

  if (!onPress) {
    return avatar;
  }

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Профиль ${name}`}
      onPress={(event) => {
        event.stopPropagation?.();
        onPress();
      }}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.avatarPressable,
        (pressed || hovered) && styles.avatarPressableHover,
      ]}>
      {avatar}
    </Pressable>
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
  onActorPress,
  onPress,
  unread = false,
  variant = 'default',
}: NotificationCardProps) {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const isFavorite = variant === 'favorite' || variant === 'returned';

  const content = (
    <>
      <View style={styles.headerRow}>
        <ActorAvatar
          name={actorName}
          avatarUrl={actorAvatarUrl}
          styles={styles}
          showCrown={isFavorite}
          onPress={onActorPress}
        />

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <View style={styles.textBlock}>
              {onActorPress ? (
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel={`Профиль ${actorName}`}
                  onPress={(event) => {
                    event.stopPropagation?.();
                    onActorPress();
                  }}
                  style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                    styles.actorNamePressable,
                    (pressed || hovered) && styles.actorNamePressableHover,
                  ]}>
                  <Text style={[styles.actorName, styles.actorNameInteractive]} numberOfLines={1}>
                    {actorName}
                  </Text>
                </Pressable>
              ) : (
                <Text style={styles.actorName} numberOfLines={1}>
                  {actorName}
                </Text>
              )}
              <Text style={styles.message}>
                <Text style={styles.actionText}>{actionText}</Text>
                {messageText}
              </Text>
              {subject ? <Text style={styles.subject}>{subject}</Text> : null}
            </View>

            {onButtonPress ? (
              <Pressable
                accessibilityRole="button"
                onPress={(event) => {
                  event.stopPropagation?.();
                  onButtonPress();
                }}
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
            onPress={(event) => {
              event.stopPropagation?.();
              onDeletePress();
            }}
            style={({ pressed }) => [
              styles.deleteButton,
              pressed && styles.deleteButtonPressed,
            ]}>
            <Ionicons name="trash-outline" size={15} color={colors.destructive} />
          </Pressable>
        ) : null}
      </View>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Открыть: ${subject || actorName}`}
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          unread && styles.cardUnread,
          styles.cardPressable,
          pressed && styles.cardPressed,
        ]}>
        {content}
      </Pressable>
    );
  }

  return <View style={[styles.card, unread && styles.cardUnread]}>{content}</View>;
}
