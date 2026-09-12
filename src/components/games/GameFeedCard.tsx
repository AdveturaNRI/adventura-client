import { useState, type ComponentProps } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { FontSize, Radius, Spacing, type ThemeColors } from '@/constants/theme';
import { useProfile } from '@/context/ProfileContext';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import type { GameListItem } from '@/services/games/gamesApi';
import { pickProfileCardUrl } from '@/services/profile/profileApi';
import { formatCityLabel } from '@/utils/city-label';
import { DEFAULT_TIMEZONE, formatDateTimeInTimezone } from '@/utils/timezones';

export type GameFeedCardVariant = 'compact' | 'detail';

type GameFeedCardProps = {
  item: GameListItem;
  variant?: GameFeedCardVariant;
  busy?: boolean;
  onPress?: () => void;
  onOpenMaster: (userId: string) => void;
  onApply: (item: GameListItem) => void;
  onCancel: (id: string) => void;
  onManage: (id: string) => void;
};

function formatViewerGameDateTime(iso: string | null, viewerTimezone: string): string {
  if (!iso) {
    return 'Дата по договорённости';
  }

  return (
    formatDateTimeInTimezone(iso, viewerTimezone) ?? 'Дата по договорённости'
  );
}

function formatDurationHours(hours: number | null | undefined): string | null {
  if (hours == null || hours < 1) {
    return null;
  }

  const mod10 = hours % 10;
  const mod100 = hours % 100;
  let unit = 'часов';
  if (mod100 < 11 || mod100 > 14) {
    if (mod10 === 1) {
      unit = 'час';
    } else if (mod10 >= 2 && mod10 <= 4) {
      unit = 'часа';
    }
  }

  return `~${hours} ${unit}`;
}

function feedStatusMeta(status: GameListItem['status']): {
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  backgroundColor: string;
} {
  if (status === 'CLOSED') {
    return { label: 'Набор закрыт', icon: 'lock-closed', backgroundColor: '#FF9500' };
  }
  if (status === 'FINISHED') {
    return { label: 'Завершена', icon: 'flag', backgroundColor: '#8E8E93' };
  }
  return { label: 'Набор открыт', icon: 'radio-button-on', backgroundColor: '#34C759' };
}

function createStyles(colors: ThemeColors, variant: GameFeedCardVariant) {
  const isDetail = variant === 'detail';

  return StyleSheet.create({
    root: {
      width: '100%',
    },
    card: {
      width: '100%',
      borderRadius: isDetail ? 20 : 16,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      overflow: 'hidden',
      ...Platform.select({
        ios: {
          shadowColor: colors.shadow,
          shadowOpacity: 0.08,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
        },
        android: { elevation: 2 },
        web: { boxShadow: '0 4px 16px rgba(0,0,0,0.06)' } as object,
        default: {},
      }),
    },
    cardHovered: {
      ...Platform.select({
        web: { transform: [{ translateY: -2 }] } as object,
        default: {},
      }),
    },
    cover: {
      width: '100%',
      aspectRatio: isDetail ? 16 / 10 : 16 / 9,
      backgroundColor: colors.surfaceMuted,
      position: 'relative',
      overflow: 'hidden',
    },
    coverImage: {
      ...StyleSheet.absoluteFill,
      width: '100%',
      height: '100%',
    },
    coverPlaceholder: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      backgroundColor: colors.surfaceMuted,
    },
    coverPlaceholderLabel: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
    },
    coverShield: {
      ...StyleSheet.absoluteFill,
      backgroundColor: 'transparent',
    },
    coverGradient: {
      ...StyleSheet.absoluteFill,
      ...Platform.select({
        web: {
          backgroundImage:
            'linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.12) 42%, rgba(0,0,0,0) 70%)',
        } as object,
        default: {
          backgroundColor: 'rgba(0,0,0,0.22)',
        },
      }),
    },
    coverGradientNativeBase: {
      ...StyleSheet.absoluteFill,
      top: '55%',
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    coverGradientNativeMid: {
      ...StyleSheet.absoluteFill,
      top: '35%',
      height: '30%',
      backgroundColor: 'rgba(0,0,0,0.2)',
    },
    coverTopBar: {
      position: 'absolute',
      top: Spacing.sm,
      left: Spacing.sm,
      right: Spacing.sm,
      zIndex: 2,
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: Spacing.sm,
    },
    coverBottomBar: {
      position: 'absolute',
      left: Spacing.sm,
      right: Spacing.sm,
      bottom: Spacing.sm,
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: Spacing.sm,
    },
    statusBadge: {
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: Radius.pill,
    },
    statusBadgeText: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    masterChip: {
      flexShrink: 1,
      flexGrow: 0,
      maxWidth: '55%',
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: Radius.pill,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    masterAvatar: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.avatar,
      flexShrink: 0,
    },
    masterAvatarEmpty: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    masterName: {
      flexShrink: 1,
      minWidth: 0,
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    dateChip: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    dateChipText: {
      flexShrink: 1,
      minWidth: 0,
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    kindBadge: {
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
    },
    kindBadgeOneshot: {
      backgroundColor: colors.primary,
    },
    kindBadgeCampaign: {
      backgroundColor: '#FF9500',
    },
    kindBadgeText: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.onPrimary,
    },
    body: {
      gap: isDetail ? Spacing.md : Spacing.sm,
      paddingHorizontal: isDetail ? Spacing.lg : Spacing.md,
      paddingTop: isDetail ? Spacing.lg : Spacing.md,
      paddingBottom: Spacing.sm,
    },
    actionsWrap: {
      paddingHorizontal: isDetail ? Spacing.lg : Spacing.md,
      paddingBottom: isDetail ? Spacing.lg : Spacing.md,
    },
    metaItems: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 10,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      maxWidth: '100%',
    },
    metaItemText: {
      flexShrink: 1,
      fontSize: FontSize.caption,
      color: colors.textMuted,
    },
    ageBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: Radius.pill,
      backgroundColor: 'rgba(21, 122, 254, 0.08)',
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.16)',
    },
    ageBadgeText: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.primary,
    },
    durationBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: Radius.pill,
      backgroundColor: 'rgba(255, 149, 0, 0.12)',
      borderWidth: 1,
      borderColor: 'rgba(255, 149, 0, 0.22)',
    },
    durationBadgeText: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: '#FF9500',
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: isDetail ? 'flex-start' : 'center',
      justifyContent: 'space-between',
      gap: Spacing.md,
    },
    title: {
      flex: 1,
      minWidth: 0,
      fontSize: isDetail ? 22 : FontSize.button,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.2,
    },
    priceWrap: {
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingTop: isDetail ? 4 : 0,
    },
    priceText: {
      fontSize: isDetail ? FontSize.button : FontSize.label,
      fontWeight: '700',
    },
    priceTextFree: {
      color: '#3DAB5A',
    },
    priceTextPaid: {
      color: colors.text,
    },
    descriptionRow: {
      flexDirection: isDetail ? 'column' : 'row',
      alignItems: isDetail ? 'stretch' : 'flex-end',
      gap: Spacing.sm,
    },
    description: {
      flex: isDetail ? undefined : 1,
      minWidth: isDetail ? undefined : 0,
      fontSize: isDetail ? FontSize.label : FontSize.caption,
      color: isDetail ? colors.textSecondary : colors.textMuted,
      lineHeight: isDetail ? FontSize.label * 1.5 : FontSize.caption * 1.4,
    },
    playersRow: {
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: isDetail ? 'flex-start' : undefined,
      gap: 3,
    },
    playersText: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.textMuted,
    },
    cardAction: {
      minHeight: isDetail ? 48 : 42,
      borderRadius: Radius.pill,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingHorizontal: Spacing.md,
    },
    cardActionPrimary: {
      backgroundColor: colors.primary,
    },
    cardActionDanger: {
      backgroundColor: 'rgba(255,59,48,0.1)',
      borderWidth: 1,
      borderColor: 'rgba(255,59,48,0.25)',
    },
    cardActionMuted: {
      backgroundColor: 'rgba(21, 122, 254, 0.1)',
    },
    cardActionOutline: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    cardActionLabel: {
      fontSize: FontSize.label,
      fontWeight: '700',
    },
    cardActionLabelOn: {
      color: colors.onPrimary,
    },
    cardActionLabelDanger: {
      color: colors.destructive,
    },
    cardActionLabelPrimary: {
      color: colors.primary,
    },
  });
}

type Styles = ReturnType<typeof createStyles>;

function MetaItem({
  icon,
  label,
  styles,
  colors,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  styles: Styles;
  colors: ThemeColors;
}) {
  return (
    <View style={styles.metaItem}>
      <Ionicons name={icon} size={13} color={colors.textMuted} />
      <Text style={styles.metaItemText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function GameFeedCard({
  item,
  variant = 'compact',
  busy = false,
  onPress,
  onOpenMaster,
  onApply,
  onCancel,
  onManage,
}: GameFeedCardProps) {
  const colors = useTheme();
  const styles = useThemedStyles((theme) => createStyles(theme, variant));
  const { profile } = useProfile();
  const viewerTimezone = profile?.timezone?.trim() || DEFAULT_TIMEZONE;
  const [hovered, setHovered] = useState(false);
  const isDetail = variant === 'detail';

  const coverUrl = pickProfileCardUrl(item.cover, item.updatedAt);
  const isCampaign = item.kind === 'CAMPAIGN';
  const kindLabel = isCampaign ? 'Кампания' : 'Ваншот';
  const kindIcon = isCampaign ? ('library-outline' as const) : ('flash-outline' as const);
  const location = item.isOnline
    ? 'Онлайн'
    : item.city
      ? formatCityLabel({
          name: item.city.name,
          region: item.city.region,
          countryCode: 'RU',
        })
      : 'Офлайн';
  const scheduleLabel = formatViewerGameDateTime(item.scheduledAt, viewerTimezone);
  const priceLabel = item.isFree
    ? 'Бесплатно'
    : item.priceRub != null
      ? `${item.priceRub.toLocaleString('ru-RU')} ₽`
      : '—';
  const experienceLabel = item.beginnersWelcome
    ? 'Опыт не важен'
    : item.experienceLabel?.trim()
      ? `Опыт: ${item.experienceLabel.trim()}`
      : 'Опыт не указан';
  const ageLabel =
    item.anyAge || item.minAge == null || item.minAge <= 0
      ? 'Любой возраст'
      : `${item.minAge}+`;
  const durationLabel = formatDurationHours(item.durationHours);
  const description =
    item.description?.trim() || 'Мастер пока не добавил описание стола.';
  const playersLabel = `${item.playersCount ?? 0}/${item.maxPlayers}`;
  const owner = item.owner;
  const relation = item.viewerRelation ?? 'none';
  const recruiting = item.status === 'RECRUITING';
  const status = feedStatusMeta(item.status);

  const actions = (() => {
    if (relation === 'owner') {
      return (
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => onManage(item.id)}
          style={({ pressed }) => [
            styles.cardAction,
            styles.cardActionOutline,
            pressed && { opacity: 0.88 },
          ]}>
          <Ionicons name="settings-outline" size={16} color={colors.text} />
          <Text style={[styles.cardActionLabel, { color: colors.text }]}>Управление</Text>
        </Pressable>
      );
    }
    if (relation === 'pending') {
      return (
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => onCancel(item.id)}
          style={({ pressed }) => [
            styles.cardAction,
            styles.cardActionDanger,
            pressed && { opacity: 0.88 },
            busy && { opacity: 0.55 },
          ]}>
          <Ionicons name="close-circle-outline" size={16} color={colors.destructive} />
          <Text style={[styles.cardActionLabel, styles.cardActionLabelDanger]}>
            Отменить заявку
          </Text>
        </Pressable>
      );
    }
    if (relation === 'player') {
      return (
        <View style={[styles.cardAction, styles.cardActionMuted]}>
          <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
          <Text style={[styles.cardActionLabel, styles.cardActionLabelPrimary]}>
            Вы в составе
          </Text>
        </View>
      );
    }
    if (!recruiting) {
      return (
        <View style={[styles.cardAction, styles.cardActionMuted]}>
          <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} />
          <Text style={[styles.cardActionLabel, { color: colors.textMuted }]}>
            Набор закрыт
          </Text>
        </View>
      );
    }
    if (relation === 'rejected') {
      return (
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => onApply(item)}
          style={({ pressed }) => [
            styles.cardAction,
            styles.cardActionPrimary,
            pressed && { opacity: 0.88 },
            busy && { opacity: 0.55 },
          ]}>
          <Ionicons name="refresh-outline" size={16} color={colors.onPrimary} />
          <Text style={[styles.cardActionLabel, styles.cardActionLabelOn]}>
            Подать снова
          </Text>
        </Pressable>
      );
    }
    return (
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={() => onApply(item)}
        style={({ pressed }) => [
          styles.cardAction,
          styles.cardActionPrimary,
          pressed && { opacity: 0.88 },
          busy && { opacity: 0.55 },
        ]}>
        <Ionicons name="send-outline" size={16} color={colors.onPrimary} />
        <Text style={[styles.cardActionLabel, styles.cardActionLabelOn]}>
          Подать заявку
        </Text>
      </Pressable>
    );
  })();

  const coverMedia = (
    <View style={StyleSheet.absoluteFill}>
      {coverUrl ? (
        <Image
          key={coverUrl}
          source={{ uri: coverUrl }}
          style={styles.coverImage}
          contentFit="cover"
          pointerEvents="none"
        />
      ) : (
        <View style={styles.coverPlaceholder}>
          <Ionicons name="image-outline" size={28} color={colors.textMuted} />
          <Text style={styles.coverPlaceholderLabel}>Без обложки</Text>
        </View>
      )}
      <View pointerEvents="none" style={styles.coverShield} />
      <View pointerEvents="none" style={styles.coverGradient}>
        {Platform.OS !== 'web' ? (
          <>
            <View style={styles.coverGradientNativeMid} />
            <View style={styles.coverGradientNativeBase} />
          </>
        ) : null}
      </View>
    </View>
  );

  const coverBottom = (
    <View style={styles.coverBottomBar} pointerEvents="none">
      <View style={styles.dateChip}>
        <Ionicons name="today-outline" size={12} color="#FFFFFF" />
        <Text style={styles.dateChipText} numberOfLines={1}>
          {scheduleLabel}
        </Text>
      </View>
      <View
        style={[
          styles.kindBadge,
          isCampaign ? styles.kindBadgeCampaign : styles.kindBadgeOneshot,
        ]}>
        <Ionicons name={kindIcon} size={13} color={colors.onPrimary} />
        <Text style={styles.kindBadgeText}>{kindLabel}</Text>
      </View>
    </View>
  );

  const bodyContent = (
    <>
      <View style={styles.metaItems}>
        <MetaItem
          icon={item.isOnline ? 'wifi-outline' : 'map-outline'}
          label={location}
          styles={styles}
          colors={colors}
        />
        <MetaItem
          icon="layers-outline"
          label={item.systemName}
          styles={styles}
          colors={colors}
        />
        <MetaItem
          icon={item.beginnersWelcome ? 'leaf-outline' : 'ribbon-outline'}
          label={experienceLabel}
          styles={styles}
          colors={colors}
        />
        {durationLabel ? (
          <View style={styles.durationBadge}>
            <Ionicons name="timer-outline" size={12} color="#FF9500" />
            <Text style={styles.durationBadgeText}>{durationLabel}</Text>
          </View>
        ) : null}
        <View style={styles.ageBadge}>
          <Ionicons name="id-card-outline" size={12} color={colors.primary} />
          <Text style={styles.ageBadgeText}>{ageLabel}</Text>
        </View>
      </View>

      <View style={styles.titleRow}>
        <Text style={styles.title} numberOfLines={isDetail ? undefined : 2}>
          {item.title}
        </Text>
        <View style={styles.priceWrap}>
          {item.isFree ? (
            <Ionicons name="pricetag-outline" size={15} color="#3DAB5A" />
          ) : null}
          <Text
            style={[
              styles.priceText,
              item.isFree ? styles.priceTextFree : styles.priceTextPaid,
            ]}>
            {priceLabel}
          </Text>
        </View>
      </View>

      <View style={styles.descriptionRow}>
        <Text style={styles.description} numberOfLines={isDetail ? undefined : 2}>
          {description}
        </Text>
        <View style={styles.playersRow}>
          <Ionicons name="people-outline" size={13} color={colors.textMuted} />
          <Text style={styles.playersText}>{playersLabel}</Text>
        </View>
      </View>
    </>
  );

  const masterChip = owner ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Мастер ${owner.nickname}`}
      onPress={() => onOpenMaster(owner.id)}
      style={({ pressed }) => [styles.masterChip, pressed && { opacity: 0.88 }]}>
      {owner.avatarUrl ? (
        <Image
          source={{ uri: owner.avatarUrl }}
          style={styles.masterAvatar}
          contentFit="cover"
        />
      ) : (
        <View style={[styles.masterAvatar, styles.masterAvatarEmpty]}>
          <Ionicons name="person" size={11} color="#FFFFFF" />
        </View>
      )}
      <Text style={styles.masterName} numberOfLines={1}>
        {owner.nickname}
      </Text>
    </Pressable>
  ) : null;

  const statusBadge = (
    <View style={[styles.statusBadge, { backgroundColor: status.backgroundColor }]}>
      <Ionicons name={status.icon} size={11} color="#FFFFFF" />
      <Text style={styles.statusBadgeText}>{status.label}</Text>
    </View>
  );

  const coverTop = (
    <View style={styles.coverTopBar} pointerEvents="box-none">
      <View pointerEvents="none" style={{ flexShrink: 0 }}>
        {statusBadge}
      </View>
      {masterChip}
    </View>
  );

  const coverBlock = (
    <View style={styles.cover}>
      {coverMedia}
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Открыть игру ${item.title}`}
          onPress={onPress}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {coverTop}
      {coverBottom}
    </View>
  );

  return (
    <View
      style={styles.root}
      {...(Platform.OS === 'web' && onPress
        ? ({
            onMouseEnter: () => setHovered(true),
            onMouseLeave: () => setHovered(false),
          } as object)
        : null)}>
      <View style={[styles.card, hovered && !isDetail && styles.cardHovered]}>
        {coverBlock}
        {onPress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Открыть игру ${item.title}`}
            onPress={onPress}>
            <View style={styles.body} pointerEvents="box-none">
              {bodyContent}
            </View>
          </Pressable>
        ) : (
          <View style={styles.body}>{bodyContent}</View>
        )}

        <View style={styles.actionsWrap}>{actions}</View>
      </View>
    </View>
  );
}
