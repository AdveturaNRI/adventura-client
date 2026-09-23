import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView as RNScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector, ScrollView as GestureScrollView } from 'react-native-gesture-handler';

import type { BadgeVariant } from '../feedback/badge.config';
import { Badge } from '../feedback/Badge';
import { SwipeBlock, type SwipeAction, type SwipeDismissRequest } from '../swipe/SwipeBlock';
import { QuestionnaireAura } from '@/components/rewards/QuestionnaireAura';
import { QuestionnaireHighlight } from '@/components/rewards/QuestionnaireHighlight';
import { NameWithBadges } from '@/components/rewards/RewardBadge';
import { UserCardIcon } from '@/components/ui/cards/UserCardIcon';
import type { UserCardIconKey } from '@/components/ui/cards/user-card-icon-assets';
import type { QuestionnaireAuraId, RewardBadgeType } from '@/data/rewards/catalog';
import { displayedAuraId } from '@/data/rewards/catalog';
import { FontSize, Radius, Sizes, Spacing, type ThemeColors } from '@/constants/theme';
import { UNKNOWN_USER_PLACEHOLDER } from '@/constants/image-assets';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { getOfficialGameSystemNames } from '@/utils/official-game-systems-cache';
import { formatTimezoneLabel } from '@/utils/timezones';
import {
  buildExperienceChips,
  buildLocationChips,
  buildScheduleChips,
  buildSystemChips,
  type UserCardChip,
  type UserCardChipTone,
  type UserCardPlayInfoInput,
} from '@/utils/user-card-chips';

export type UserCardSwipeConfig = {
  leftAction?: SwipeAction;
  rightAction?: SwipeAction;
  actionWidth?: number;
  dismissible?: boolean;
  resetKey?: string | number;
  onDismiss?: (direction: 'left' | 'right' | 'up') => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  dismissRequest?: SwipeDismissRequest | null;
};

export type UserCardSize = 'default' | 'compact';

export type UserCardLayout = 'default' | 'deck' | 'deckWide';

export type UserCardDeckSize = {
  width: number;
  height: number;
  photoWidth: number;
  /** Stacked mobile deck: fixed portrait photo height below the card top edge. */
  photoHeight?: number;
};

export type UserCardProps = {
  name: string;
  age?: number | null;
  tagline: string;
  roles: string[];
  avatarUrl?: string;
  playInfo: UserCardPlayInfoInput;
  bio: string;
  visibility: string;
  visibilityVariant?: BadgeVariant;
  size?: UserCardSize;
  layout?: UserCardLayout;
  deckSize?: UserCardDeckSize;
  /** When false, stacked deck grows with content (list). Default true. */
  deckFill?: boolean;
  showVisibility?: boolean;
  blockedByMe?: boolean;
  swipe?: UserCardSwipeConfig;
  badges?: RewardBadgeType[];
  auraId?: QuestionnaireAuraId | null;
};

const USER_CARD_PHOTO_ASPECT_RATIO = 0.9;
/** Profile card uploads are cropped to 3:4 in the questionnaire editor. */
const USER_CARD_PHOTO_ASPECT_RATIO_DECK = 3 / 4;

const DeckScrollView = Platform.OS === 'web' ? RNScrollView : GestureScrollView;

const CARD_SIZE_CONFIG = {
  default: {
    borderRadius: 16,
    photoAspectRatio: USER_CARD_PHOTO_ASPECT_RATIO,
    bodyPadding: Spacing.md,
    bodyGap: Spacing.md,
    nameSize: 22,
    iconSize: 20,
    chipPaddingH: 10,
    chipPaddingV: 5,
    infoRowGap: 6,
    infoRowPaddingV: Spacing.sm,
    identityGap: 4,
    chipsGap: 6,
    rolesGap: Spacing.sm,
    taglineSize: FontSize.label,
    captionSize: FontSize.caption,
    bioSize: FontSize.label,
    badgeMinHeight: 30,
    badgePaddingH: Spacing.md,
    visibilityBadgeMinHeight: Sizes.badgeHeight,
  },
  compact: {
    borderRadius: 12,
    photoAspectRatio: USER_CARD_PHOTO_ASPECT_RATIO,
    bodyPadding: 12,
    bodyGap: 10,
    nameSize: 18,
    iconSize: 17,
    chipPaddingH: 8,
    chipPaddingV: 3,
    infoRowGap: 4,
    infoRowPaddingV: 6,
    identityGap: 2,
    chipsGap: 4,
    rolesGap: 6,
    taglineSize: 13,
    captionSize: 11,
    bioSize: 13,
    badgeMinHeight: 26,
    badgePaddingH: 10,
    visibilityBadgeMinHeight: 28,
  },
} as const;

type InfoRowSpec = {
  icon: UserCardIconKey;
  label: string;
  chips: UserCardChip[];
};

function createStyles(
  colors: ThemeColors,
  size: UserCardSize,
  layout: UserCardLayout,
  deckFill: boolean,
) {
  const cfg = CARD_SIZE_CONFIG[size];
  const isDeck = layout === 'deck' || layout === 'deckWide';
  const isDeckWide = layout === 'deckWide';
  const isDeckStacked = layout === 'deck';
  const fillsDeck = isDeckStacked && deckFill;

  return StyleSheet.create({
    card: {
      borderRadius: isDeckStacked ? 20 : cfg.borderRadius,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      overflow: 'hidden',
      ...Platform.select({
        ios: {
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: isDeckStacked ? 6 : size === 'compact' ? 2 : 4 },
          shadowOpacity: isDeckStacked ? 0.08 : size === 'compact' ? 0.05 : 0.06,
          shadowRadius: isDeckStacked ? 16 : size === 'compact' ? 8 : 12,
        },
        android: {
          elevation: isDeckStacked ? 4 : size === 'compact' ? 2 : 3,
        },
        default: {
          boxShadow: isDeckStacked
            ? '0 8px 28px rgba(0, 0, 0, 0.08)'
            : size === 'compact'
              ? '0 2px 10px rgba(0, 0, 0, 0.05)'
              : '0 4px 16px rgba(0, 0, 0, 0.06)',
        },
      }),
    },
    cardEmbedded: {
      borderWidth: 0,
      borderRadius: 0,
      shadowOpacity: 0,
      elevation: 0,
      boxShadow: 'none',
    },
    cardDeck: {
      ...(fillsDeck
        ? {
            width: '100%' as const,
          }
        : {
            width: '100%' as const,
          }),
      flexDirection: 'column',
    },
    cardDeckWide: {
      flexDirection: 'row',
      width: '100%',
      // Height comes from deckFrame — avoid height:100% collapse on RN web.
    },
    photoWrap: {
      width: isDeckWide ? undefined : '100%',
      height: isDeckWide ? undefined : undefined,
      aspectRatio:
        isDeckWide || isDeckStacked
          ? undefined
          : isDeck
            ? USER_CARD_PHOTO_ASPECT_RATIO_DECK
            : cfg.photoAspectRatio,
      flexShrink: 0,
      backgroundColor: colors.placeholder,
      overflow: 'hidden',
      position: 'relative',
      ...Platform.select({
        web: {
          userSelect: 'none',
          WebkitUserDrag: 'none',
          userDrag: 'none',
        } as object,
        default: {},
      }),
    },
    photoSectionStacked: {
      flexShrink: 0,
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.md,
      paddingBottom: 0,
    },
    photoWrapStacked: {
      width: '100%',
      borderRadius: 16,
      overflow: 'hidden',
    },
    photo: {
      width: '100%',
      height: '100%',
    },
    body: {
      padding: isDeckStacked ? Spacing.lg : isDeckWide ? Spacing.md : cfg.bodyPadding,
      gap: isDeckStacked ? Spacing.md : isDeckWide ? Spacing.sm : cfg.bodyGap,
      paddingTop: isDeckStacked ? Spacing.sm : undefined,
    },
    bodyScroll: {
      width: '100%',
      minHeight: 0,
      ...Platform.select({
        web: {
          overflowY: 'auto',
          scrollbarWidth: 'thin',
          scrollbarColor: `${colors.border} transparent`,
        } as object,
        default: {
          flex: 1,
        },
      }),
    },
    bodyScrollContent: {
      flexGrow: 0,
    },
    cardScrollHost: {
      width: '100%',
      minHeight: 0,
      ...Platform.select({
        default: {
          flex: 1,
        },
      }),
    },
    bodyScrollWide: {
      minWidth: 0,
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderLeftColor: colors.borderLight,
      ...Platform.select({
        default: {
          flex: 1,
        },
      }),
    },
    bodyScrollWideContent: {
      flexGrow: 1,
    },
    swipeDeck: {
      width: '100%',
      ...Platform.select({
        web: {
          userSelect: 'none',
          WebkitUserDrag: 'none',
          userDrag: 'none',
        } as object,
        default: {},
      }),
    },
    identityBlock: {
      gap: isDeckStacked ? Spacing.xs : cfg.identityGap,
    },
    name: {
      fontSize: isDeckStacked ? 22 : isDeckWide ? 20 : cfg.nameSize,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: isDeckStacked ? -0.2 : 0,
    },
    age: {
      fontSize: isDeckStacked ? 22 : isDeckWide ? 20 : cfg.nameSize,
      fontWeight: '700',
      color: colors.text,
    },
    tagline: {
      fontSize: isDeckStacked ? FontSize.label : cfg.taglineSize,
      color: colors.textSecondary,
      lineHeight: (isDeckStacked ? FontSize.label : cfg.taglineSize) * 1.4,
    },
    blockedMark: {
      alignSelf: 'flex-start',
      marginTop: 2,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: colors.destructive,
      backgroundColor: colors.surface,
    },
    blockedMarkLabel: {
      fontSize: cfg.captionSize,
      fontWeight: '600',
      color: colors.destructive,
    },
    rolesRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: cfg.rolesGap,
    },
    roleBadge: {
      minHeight: cfg.badgeMinHeight,
      paddingHorizontal: cfg.badgePaddingH,
    },
    visibilityBadge: {
      minHeight: cfg.visibilityBadgeMinHeight,
      paddingHorizontal: cfg.badgePaddingH,
    },
    sectionDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.borderLight,
    },
    infoList: {
      gap: isDeckStacked ? Spacing.sm : 0,
    },
    infoRow: {
      gap: isDeckWide || isDeckStacked ? 4 : cfg.infoRowGap,
      paddingVertical: isDeckStacked ? 4 : isDeckWide ? 4 : cfg.infoRowPaddingV,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
    },
    infoRowLast: {
      borderBottomWidth: 0,
      paddingBottom: 0,
    },
    infoHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    infoIconSlot: {
      flexShrink: 0,
    },
    infoLabel: {
      fontSize: cfg.captionSize,
      color: colors.textMuted,
      lineHeight: cfg.captionSize * 1.4,
    },
    chipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: cfg.chipsGap,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderRadius: Radius.pill,
      borderWidth: 1,
      paddingHorizontal: cfg.chipPaddingH,
      paddingVertical: cfg.chipPaddingV,
      maxWidth: '100%',
    },
    chipLabel: {
      flexShrink: 1,
      fontSize: cfg.captionSize,
      lineHeight: cfg.captionSize * 1.35,
    },
    chipDefault: {
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    chipDefaultLabel: {
      color: colors.textSecondary,
      fontWeight: '500',
    },
    chipOnline: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    chipOnlineLabel: {
      color: colors.onPrimary,
      fontWeight: '600',
    },
    chipOfficial: {
      borderColor: colors.primary,
      backgroundColor: colors.surface,
    },
    chipOfficialLabel: {
      color: colors.primary,
      fontWeight: '700',
    },
    chipLearn: {
      borderColor: colors.primaryLight,
      backgroundColor: colors.surface,
      borderStyle: 'dashed',
    },
    chipLearnLabel: {
      color: colors.primary,
      fontWeight: '600',
    },
    chipAgreement: {
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    chipAgreementLabel: {
      color: colors.textSecondary,
      fontWeight: '500',
    },
    chipMuted: {
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
    },
    chipMutedLabel: {
      color: colors.textMuted,
      fontWeight: '400',
    },
    bio: {
      fontSize: cfg.bioSize,
      color: colors.textMuted,
      lineHeight: cfg.bioSize * 1.45,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      // Keep «Публичная» clear of oak rivets / mug corners.
      paddingRight: 2,
      paddingBottom: 2,
    },
    footerOak: {
      paddingRight: 10,
      paddingBottom: 6,
    },
  });
}

function getChipStyles(tone: UserCardChipTone, styles: ReturnType<typeof createStyles>) {
  switch (tone) {
    case 'online':
      return { chip: styles.chipOnline, label: styles.chipOnlineLabel };
    case 'official':
      return { chip: styles.chipOfficial, label: styles.chipOfficialLabel };
    case 'learn':
      return { chip: styles.chipLearn, label: styles.chipLearnLabel };
    case 'agreement':
      return { chip: styles.chipAgreement, label: styles.chipAgreementLabel };
    case 'muted':
      return { chip: styles.chipMuted, label: styles.chipMutedLabel };
    default:
      return { chip: styles.chipDefault, label: styles.chipDefaultLabel };
  }
}

export function UserCard({
  name,
  age,
  tagline,
  roles,
  avatarUrl,
  playInfo,
  bio,
  visibility,
  visibilityVariant = 'success',
  size = 'default',
  layout = 'default',
  deckSize,
  deckFill = true,
  showVisibility = true,
  blockedByMe = false,
  swipe,
  badges,
  auraId,
}: UserCardProps) {
  const colors = useTheme();
  const styles = useThemedStyles((themeColors) =>
    createStyles(themeColors, size, layout, deckFill),
  );
  const iconSize = CARD_SIZE_CONFIG[size].iconSize;
  const [officialNames, setOfficialNames] = useState<Set<string>>(new Set());
  const fillsDeck = layout === 'deck' && deckFill;
  // Feed/swipe needs a fixed frame. List cards (favorites/skipped) grow with content
  // so the action bar stays below the card instead of floating over the body.
  const lockDeckHeight =
    Boolean(deckSize) && (layout === 'deckWide' || fillsDeck || Boolean(swipe));

  const deckFrame: ViewStyle | undefined =
    (layout === 'deck' || layout === 'deckWide') && deckSize
      ? lockDeckHeight
        ? {
            width: '100%',
            height: deckSize.height,
            maxHeight: deckSize.height,
            minHeight: deckSize.height,
            flexGrow: 0,
            flexShrink: 0,
          }
        : {
            width: '100%',
          }
      : undefined;
  const deckWidePhoto =
    layout === 'deckWide' && deckSize
      ? { width: deckSize.photoWidth, height: deckSize.height }
      : undefined;
  const deckStackedPhoto =
    layout === 'deck' && deckSize?.photoHeight != null
      ? { height: deckSize.photoHeight, aspectRatio: undefined as undefined }
      : layout === 'deck'
        ? { aspectRatio: USER_CARD_PHOTO_ASPECT_RATIO_DECK }
        : undefined;

  useEffect(() => {
    void getOfficialGameSystemNames().then(setOfficialNames);
  }, []);

  const isDeckLayout = layout === 'deck' || layout === 'deckWide';
  const isDeckStacked = layout === 'deck';
  const showBio = bio !== '—' && bio.trim() !== tagline.trim();
  const resolvedAura = displayedAuraId(badges ?? [], auraId);
  const isOakCard = resolvedAura === 'oak_shield';

  const infoRows = useMemo<InfoRowSpec[]>(() => {
    const timezoneLabel = playInfo.timezone
      ? formatTimezoneLabel(playInfo.timezone)
      : null;

    return [
      {
        icon: 'play',
        label: 'Играю',
        chips: buildLocationChips(
          playInfo.playsOnline,
          playInfo.locations ?? playInfo.location,
        ),
      },
      {
        icon: 'systems',
        label: 'Системы',
        chips: buildSystemChips(
          playInfo.systems,
          playInfo.readyToLearnNew,
          playInfo.openToAnySystem,
          officialNames,
        ),
      },
      {
        icon: 'experience',
        label: 'Опыт игры',
        chips: buildExperienceChips(playInfo.experience),
      },
      {
        icon: 'schedule',
        label: 'Смогу играть',
        chips: buildScheduleChips(playInfo.schedule, timezoneLabel),
      },
    ];
  }, [officialNames, playInfo]);

  const bodyContent = (
    <>
      <View style={styles.identityBlock}>
        <NameWithBadges
          name={age != null ? `${name}, ${age}` : name}
          badges={badges}
          textStyle={styles.name}
          badgeSize={size === 'compact' ? 12 : 14}
        />
        {blockedByMe ? (
          <View style={styles.blockedMark}>
            <Text style={styles.blockedMarkLabel}>У вас в чёрном списке</Text>
          </View>
        ) : null}
        {tagline !== '—' ? <Text style={styles.tagline}>{tagline}</Text> : null}
      </View>

      <View style={styles.rolesRow}>
        {roles.map((role) => (
          <Badge
            key={role}
            label={role}
            variant="roleFilled"
            icon={role === 'Мастер' ? 'book-outline' : 'game-controller-outline'}
            style={styles.roleBadge}
          />
        ))}
      </View>

      {infoRows.length > 0 ? (
        <>
          <View style={styles.sectionDivider} />

          <View style={styles.infoList}>
            {infoRows.map((row, index) => (
              <InfoRow
                key={row.label}
                row={row}
                styles={styles}
                iconSize={iconSize}
                isLast={index === infoRows.length - 1}
              />
            ))}
          </View>
        </>
      ) : null}

      {showBio ? (
        <>
          <View style={styles.sectionDivider} />
          <Text style={styles.bio}>{bio}</Text>
        </>
      ) : null}

      {showVisibility ? (
        <>
          <View style={styles.sectionDivider} />

          <View style={[styles.footer, isOakCard ? styles.footerOak : null]}>
            <Badge label={visibility} variant={visibilityVariant} style={styles.visibilityBadge} />
          </View>
        </>
      ) : null}
    </>
  );

  const photoImage = (
    <Image
      key={avatarUrl ?? 'unknown-user'}
      source={avatarUrl ? { uri: avatarUrl } : UNKNOWN_USER_PLACEHOLDER}
      style={styles.photo}
      contentFit="cover"
      cachePolicy={avatarUrl?.startsWith('http') ? 'memory-disk' : 'none'}
      {...(Platform.OS === 'web'
        ? ({
            draggable: false,
            className: 'user-card-photo',
          } as object)
        : {})}
    />
  );

  const photoAura = <QuestionnaireAura auraId={auraId} badges={badges} />;
  const photo = isDeckStacked ? (
    <View style={styles.photoSectionStacked}>
      <View style={[styles.photoWrap, styles.photoWrapStacked, deckStackedPhoto]}>
        {photoImage}
        {photoAura}
      </View>
    </View>
  ) : (
    <View style={[styles.photoWrap, deckWidePhoto, deckStackedPhoto]}>
      {photoImage}
      {photoAura}
    </View>
  );

  const nativeScrollGesture = useMemo(
    () => (Platform.OS !== 'web' && isDeckStacked && swipe ? Gesture.Native() : undefined),
    [isDeckStacked, swipe?.resetKey],
  );

  const stackedBody = (
    <>
      {photo}
      <View style={styles.body}>{bodyContent}</View>
    </>
  );

  const stackedBodyScroll = (
    <DeckScrollView
      style={[styles.bodyScroll, fillsDeck && deckSize ? { height: deckSize.height } : null]}
      contentContainerStyle={styles.bodyScrollContent}
      {...(Platform.OS === 'web' ? { className: 'user-card-body-scroll' } : {})}
      showsVerticalScrollIndicator
      persistentScrollbar
      indicatorStyle="black"
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled">
      {photo}
      <View style={styles.body}>{bodyContent}</View>
    </DeckScrollView>
  );

  const stackedScroll = fillsDeck ? (
    <View style={[styles.cardScrollHost, deckSize ? { height: deckSize.height } : null]}>
      {nativeScrollGesture ? (
        <GestureDetector gesture={nativeScrollGesture}>{stackedBodyScroll}</GestureDetector>
      ) : (
        stackedBodyScroll
      )}
    </View>
  ) : (
    <View>{stackedBody}</View>
  );

  const card = (
    <View
      style={[
        styles.card,
        layout === 'deck' && styles.cardDeck,
        layout === 'deckWide' && styles.cardDeckWide,
        deckFrame,
        swipe && styles.cardEmbedded,
      ]}>
      {isDeckStacked ? (
        stackedScroll
      ) : (
        <>
          {photo}
          {isDeckLayout ? (
            <DeckScrollView
              style={[styles.bodyScroll, layout === 'deckWide' && styles.bodyScrollWide]}
              contentContainerStyle={[
                styles.body,
                styles.bodyScrollContent,
                layout === 'deckWide' && styles.bodyScrollWideContent,
              ]}
              {...(Platform.OS === 'web' ? { className: 'user-card-body-scroll' } : {})}
              showsVerticalScrollIndicator
              persistentScrollbar
              indicatorStyle="black"
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled">
              {bodyContent}
            </DeckScrollView>
          ) : (
            <View style={styles.body}>{bodyContent}</View>
          )}
        </>
      )}
    </View>
  );

  const cardRadius = isDeckStacked ? 20 : CARD_SIZE_CONFIG[size].borderRadius;

  const swipeCard = swipe ? (
    <SwipeBlock
      variant="corner"
      style={
        layout === 'deck' || layout === 'deckWide'
          ? StyleSheet.flatten([styles.swipeDeck, deckFrame])
          : undefined
      }
      dismissible={swipe.dismissible}
      resetKey={swipe.resetKey}
      nativeScrollGesture={nativeScrollGesture}
      onDismiss={swipe.onDismiss}
      leftAction={swipe.leftAction}
      rightAction={swipe.rightAction}
      actionWidth={swipe.actionWidth ?? 108}
      onSwipeLeft={swipe.onSwipeLeft}
      onSwipeRight={swipe.onSwipeRight}
      dismissRequest={swipe.dismissRequest}>
      {card}
    </SwipeBlock>
  ) : (
    card
  );

  return (
    <QuestionnaireHighlight
      auraId={auraId}
      badges={badges}
      radius={cardRadius}
      overlay={false}
      style={deckFrame}>
      {swipeCard}
    </QuestionnaireHighlight>
  );
}

function InfoRow({
  row,
  styles,
  iconSize,
  isLast,
}: {
  row: InfoRowSpec;
  styles: ReturnType<typeof createStyles>;
  iconSize: number;
  isLast: boolean;
}) {
  return (
    <View style={[styles.infoRow, isLast && styles.infoRowLast]}>
      <View style={styles.infoHeader}>
        <View style={styles.infoIconSlot}>
          <UserCardIcon name={row.icon} size={iconSize} />
        </View>
        <Text style={styles.infoLabel}>{row.label}</Text>
      </View>

      <View style={styles.chipsRow}>
        {row.chips.map((chip) => (
          <UserCardChipView key={chip.key} chip={chip} styles={styles} />
        ))}
      </View>
    </View>
  );
}

function UserCardChipView({
  chip,
  styles,
}: {
  chip: UserCardChip;
  styles: ReturnType<typeof createStyles>;
}) {
  const colors = useTheme();
  const toneStyles = getChipStyles(chip.tone, styles);
  const labelStyle = StyleSheet.flatten([styles.chipLabel, toneStyles.label]);
  const iconColor =
    labelStyle && 'color' in labelStyle && typeof labelStyle.color === 'string'
      ? labelStyle.color
      : colors.textSecondary;

  return (
    <View style={[styles.chip, toneStyles.chip]}>
      {chip.icon ? <Ionicons name={chip.icon} size={12} color={iconColor} /> : null}
      <Text style={labelStyle}>{chip.label}</Text>
    </View>
  );
}
