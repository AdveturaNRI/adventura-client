import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState, type ComponentProps, type ReactNode } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  useIsDesktopSidebarVisible,
  useIsDesktopWeb,
} from '@/components/navigation/DesktopThemeToggle';
import { MobileBackButton } from '@/components/navigation/MobileBackButton';
import { MobileScreenHeader } from '@/components/navigation/MobileScreenHeader';
import { ScreenTransition } from '@/components/navigation/ScreenTransition';
import { UserAvatar } from '@/components/navigation/UserAvatar';
import { QuestionnaireHighlight } from '@/components/rewards/QuestionnaireHighlight';
import { RewardBadgeIcon } from '@/components/rewards/RewardBadge';
import { CosmeticsPreviewModal } from '@/components/rewards/CosmeticsPreviewModal';
import { Button, toast } from '@/components/ui';
import { FontSize, Radius, Spacing, type ThemeColors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useMyAvatarUrl, useProfile } from '@/context/ProfileContext';
import {
  AVATAR_FRAMES,
  QUESTIONNAIRE_AURAS,
  REWARD_BADGES,
  SHOWCASE_AURA_IDS,
  SHOWCASE_AVATAR_FRAME_IDS,
  isPurchasableAura,
  isPurchasableAvatarFrame,
  isUniqueAura,
  isUniqueAvatarFrame,
  ownedAuraIdsFromPerks,
  ownedFrameIdsFromPerks,
  sanitizeBadges,
  lockedRewardToast,
  uniqueGoldTone,
  rewardUiTone,
  type AvatarFrameId,
  type QuestionnaireAuraId,
  type RewardBadgeType,
  type UniqueGoldTone,
} from '@/data/rewards/catalog';
import { useTheme, useThemePreference } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { updateMyCosmetics } from '@/services/rewards/rewardsApi';
import { localizeErrorMessage } from '@/utils/localizeError';

import { useMainScreenStyles } from './main-screen.styles';

const COSMETICS_SHOP_URL = 'https://boosty.to/adventuranri';

function createStyles(colors: ThemeColors, isDesktopWeb: boolean, gold: UniqueGoldTone, isDark: boolean) {
  return StyleSheet.create({
    hint: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.45,
    },
    page: {
      gap: Spacing.xl,
    },
    section: {
      gap: Spacing.md,
    },
    group: {
      gap: Spacing.sm,
      paddingTop: Spacing.md,
    },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    sectionIcon: {
      width: 28,
      height: 28,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionIconGold: {
      backgroundColor: gold.well,
    },
    sectionIconPrimary: {
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
    },
    sectionIconAura: {
      backgroundColor: isDark ? 'rgba(192, 132, 252, 0.16)' : 'rgba(109, 40, 217, 0.12)',
    },
    auraIcon: {
      color: isDark ? '#C4B5FD' : '#6D28D9',
    },
    sectionTitle: {
      fontSize: FontSize.button,
      fontWeight: '700',
      color: colors.text,
    },
    emptyNote: {
      fontSize: FontSize.caption,
      color: colors.textSecondary,
      lineHeight: FontSize.caption * 1.45,
    },
    filtersRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    filterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.28)',
      backgroundColor: 'rgba(21, 122, 254, 0.08)',
    },
    filterChipSelected: {
      borderColor: 'rgba(21, 122, 254, 0.45)',
      backgroundColor: 'rgba(21, 122, 254, 0.16)',
    },
    filterChipLabel: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.primary,
    },
    options: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      alignItems: 'stretch',
      justifyContent: isDesktopWeb ? 'flex-start' : 'center',
    },
    rewardRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      justifyContent: isDesktopWeb ? 'flex-start' : 'center',
    },
    rewardChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: 40,
      paddingVertical: 4,
      paddingLeft: 4,
      paddingRight: 12,
      borderRadius: Radius.pill,
      borderWidth: 1.5,
    },
    rewardChipLabel: {
      fontSize: 13,
      fontWeight: '700',
    },
    option: {
      width: isDesktopWeb ? 112 : 104,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingVertical: 8,
      paddingHorizontal: 8,
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: 6,
    },
    optionActive: {
      borderColor: colors.primary,
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
    },
    optionLocked: {
      borderColor: 'rgba(21, 122, 254, 0.35)',
      backgroundColor: 'rgba(21, 122, 254, 0.08)',
    },
    optionUnique: {
      borderColor: gold.border,
      backgroundColor: gold.bg,
    },
    optionUniqueLocked: {
      borderColor: gold.borderLocked,
      backgroundColor: gold.bgLocked,
    },
    optionPressed: {
      opacity: 0.86,
    },
    optionLabel: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
    },
    optionLabelActive: {
      color: colors.primary,
    },
    optionMeta: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
      textAlign: 'center',
    },
    uniqueMark: {
      fontSize: 9,
      fontWeight: '800',
      color: gold.fg,
      textAlign: 'center',
      lineHeight: 12,
      letterSpacing: 0.2,
    },
    uniqueMarkBrand: {
      color: colors.primary,
    },
    previewWrap: {
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'visible',
    },
    lockBadge: {
      position: 'absolute',
      right: -4,
      bottom: -4,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    lockBadgeUnique: {
      borderColor: gold.fg,
    },
    lockIconUnique: {
      color: gold.fg,
    },
    groupLabel: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: gold.fg,
    },
    groupLabelShop: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.primary,
    },
    stickyHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      backgroundColor: colors.background,
    },
    headerTitle: {
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 160,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      flexShrink: 0,
      gap: Spacing.sm,
    },
    headerButton: {
      minHeight: 40,
      paddingHorizontal: Spacing.md,
      paddingVertical: 0,
    },
    shopButton: {
      alignSelf: 'stretch',
    },
  });
}

function showLockedReward(badge: RewardBadgeType | null) {
  if (!badge) {
    return;
  }
  const copy = lockedRewardToast(badge);
  toast.error(copy.message, { title: copy.title, duration: 5200 });
}

function Heading({
  styles,
  icon,
  iconColor,
  well,
  titleStyle,
  children,
}: {
  styles: ReturnType<typeof createStyles>;
  icon: ComponentProps<typeof Ionicons>['name'];
  iconColor: string;
  well: object;
  titleStyle?: object;
  children: string;
}) {
  return (
    <View style={styles.sectionHead}>
      <View style={[styles.sectionIcon, well]}>
        <Ionicons name={icon} size={15} color={iconColor} />
      </View>
      <Text style={titleStyle ?? styles.sectionTitle}>{children}</Text>
    </View>
  );
}

async function openCosmeticsShop() {
  try {
    await Linking.openURL(COSMETICS_SHOP_URL);
  } catch {
    toast.error('Не открылся магазин. Попробуй ещё раз.');
  }
}

function CollectionShopButton({
  colors,
  compact,
  style,
}: {
  colors: ThemeColors;
  compact?: boolean;
  style?: ComponentProps<typeof Button>['style'];
}) {
  return (
    <Button
      label="Открыть коллекцию"
      onPress={() => void openCosmeticsShop()}
      icon={
        <Ionicons name="bag-handle-outline" size={compact ? 16 : 18} color={colors.onPrimary} />
      }
      style={style}
    />
  );
}

function PreviewButton({
  colors,
  compact,
  style,
  onPress,
}: {
  colors: ThemeColors;
  compact?: boolean;
  style?: ComponentProps<typeof Button>['style'];
  onPress: () => void;
}) {
  return (
    <Button
      label="Предпросмотр"
      variant="outline"
      onPress={onPress}
      icon={<Ionicons name="eye-outline" size={compact ? 16 : 18} color={colors.text} />}
      style={style}
    />
  );
}

function CosmeticOption({
  styles,
  active,
  locked,
  unique,
  uniqueMark,
  disabled,
  label,
  meta,
  onPress,
  children,
}: {
  styles: ReturnType<typeof createStyles>;
  active?: boolean;
  locked?: boolean;
  unique?: boolean;
  uniqueMark?: 'gold' | 'brand';
  disabled?: boolean;
  label: string;
  meta?: string | null;
  onPress: () => void;
  children: ReactNode;
}) {
  const caption = locked ? 'Открыть' : meta;
  const markTone = uniqueMark ?? (unique ? 'gold' : null);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(active), disabled: Boolean(disabled) && !locked }}
      disabled={disabled && !locked}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        active && styles.optionActive,
        locked && !unique && styles.optionLocked,
        unique && (locked ? styles.optionUniqueLocked : styles.optionUnique),
        pressed && styles.optionPressed,
      ]}>
      {markTone ? (
        <Text style={[styles.uniqueMark, markTone === 'brand' && styles.uniqueMarkBrand]}>
          Уникальная
        </Text>
      ) : null}
      <View style={styles.previewWrap}>
        {children}
        {locked ? (
          <View style={[styles.lockBadge, unique && styles.lockBadgeUnique]} pointerEvents="none">
            <Ionicons
              name="lock-closed"
              size={12}
              color={unique ? (styles.lockIconUnique.color as string) : '#157AFE'}
            />
          </View>
        ) : null}
      </View>
      <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>{label}</Text>
      {caption ? <Text style={styles.optionMeta}>{caption}</Text> : null}
    </Pressable>
  );
}

function RewardChip({
  styles,
  id,
  visible,
  disabled,
  onPress,
}: {
  styles: ReturnType<typeof createStyles>;
  id: RewardBadgeType;
  visible: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const spec = REWARD_BADGES[id];
  const { colorScheme } = useThemePreference();
  const tone = rewardUiTone(spec, colorScheme === 'dark');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spec.label}
      accessibilityHint={visible ? 'Скрыть с профиля' : 'Показать в профиле'}
      accessibilityState={{ selected: visible, disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.rewardChip,
        {
          borderColor: visible ? tone.border : `${tone.fg}66`,
          backgroundColor: visible ? tone.bg : 'transparent',
          opacity: pressed ? 0.86 : 1,
        },
      ]}>
      <RewardBadgeIcon type={id} size={16} interactive={false} />
      <Text style={[styles.rewardChipLabel, { color: tone.fg }]}>{spec.label}</Text>
      {visible ? <Ionicons name="checkmark" size={15} color={tone.fg} /> : null}
    </Pressable>
  );
}

export default function ProfileAppearanceScreen() {
  const { user } = useAuth();
  const { profile, refreshProfile } = useProfile();
  const avatarUrl = useMyAvatarUrl();
  const colors = useTheme();
  const { colorScheme } = useThemePreference();
  const isDark = colorScheme === 'dark';
  const gold = uniqueGoldTone(isDark);
  const mainStyles = useMainScreenStyles();
  const isDesktopWeb = useIsDesktopWeb();
  const styles = useThemedStyles((themeColors) =>
    createStyles(themeColors, isDesktopWeb, gold, isDark),
  );
  const hasDesktopSidebar = useIsDesktopSidebarVisible();
  const showCompactNav = !hasDesktopSidebar;
  const [frameId, setFrameId] = useState<AvatarFrameId>('none');
  const [auraId, setAuraId] = useState<QuestionnaireAuraId>('none');
  const [visibleBadges, setVisibleBadges] = useState<RewardBadgeType[]>([]);
  const [saving, setSaving] = useState(false);
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const badges = useMemo(() => {
    const fromPerks = sanitizeBadges(profile?.perks?.badges);
    if (fromPerks.length > 0) {
      return fromPerks;
    }
    return sanitizeBadges(profile?.rewards?.map((item) => item.badgeType));
  }, [profile?.perks?.badges, profile?.rewards]);
  const frames = useMemo(
    () => ownedFrameIdsFromPerks(profile?.perks, badges),
    [profile?.perks, badges],
  );
  const auras = useMemo(
    () => ownedAuraIdsFromPerks(profile?.perks, badges),
    [profile?.perks, badges],
  );
  const uniqueFrames = useMemo(
    () => SHOWCASE_AVATAR_FRAME_IDS.filter((id) => isUniqueAvatarFrame(id)),
    [],
  );
  const grantFrames = useMemo(
    () =>
      SHOWCASE_AVATAR_FRAME_IDS.filter(
        (id) => !isUniqueAvatarFrame(id) && !isPurchasableAvatarFrame(id),
      ),
    [],
  );
  const shopFrames = useMemo(
    () => SHOWCASE_AVATAR_FRAME_IDS.filter((id) => isPurchasableAvatarFrame(id)),
    [],
  );
  const uniqueAuras = useMemo(
    () => SHOWCASE_AURA_IDS.filter((id) => isUniqueAura(id)),
    [],
  );
  const shopAuras = useMemo(
    () => SHOWCASE_AURA_IDS.filter((id) => isPurchasableAura(id)),
    [],
  );
  const visibleUniqueFrames = useMemo(() => {
    const ids = [...uniqueFrames, ...grantFrames];
    return ownedOnly ? ids.filter((id) => frames.includes(id)) : ids;
  }, [uniqueFrames, grantFrames, frames, ownedOnly]);
  const visibleShopFrames = useMemo(
    () => (ownedOnly ? shopFrames.filter((id) => frames.includes(id)) : shopFrames),
    [ownedOnly, shopFrames, frames],
  );
  const visibleUniqueAuras = useMemo(
    () => (ownedOnly ? uniqueAuras.filter((id) => auras.includes(id)) : uniqueAuras),
    [ownedOnly, uniqueAuras, auras],
  );
  const visibleShopAuras = useMemo(
    () => (ownedOnly ? shopAuras.filter((id) => auras.includes(id)) : shopAuras),
    [ownedOnly, shopAuras, auras],
  );
  const showFrameShop = !ownedOnly && shopFrames.some((id) => !frames.includes(id));
  const showAuraShop = !ownedOnly && shopAuras.some((id) => !auras.includes(id));

  useEffect(() => {
    if (!profile) {
      return;
    }
    setFrameId((profile.perks?.avatarFrameId as AvatarFrameId | null) ?? 'none');
    setAuraId((profile.perks?.questionnaireAuraId as QuestionnaireAuraId | null) ?? 'none');
    setVisibleBadges(sanitizeBadges(profile.perks?.visibleBadges ?? profile.perks?.badges));
  }, [profile]);

  const persist = useCallback(
    async (
      nextFrame: AvatarFrameId,
      nextAura: QuestionnaireAuraId,
      nextBadges: RewardBadgeType[],
    ) => {
      setSaving(true);
      try {
        await updateMyCosmetics({
          avatarFrameId: nextFrame,
          questionnaireAuraId: nextAura,
          badgeTypes: nextBadges,
        });
        await refreshProfile();
      } catch (error) {
        toast.error(localizeErrorMessage(error, 'Не получилось сохранить оформление'));
        await refreshProfile();
      } finally {
        setSaving(false);
      }
    },
    [refreshProfile],
  );

  const pickFrame = (next: AvatarFrameId) => {
    if (next === frameId || saving) {
      return;
    }
    setFrameId(next);
    void persist(next, auraId, visibleBadges);
  };

  const pickAura = (next: QuestionnaireAuraId) => {
    if (next === auraId || saving) {
      return;
    }
    setAuraId(next);
    void persist(frameId, next, visibleBadges);
  };

  const toggleBadge = (id: RewardBadgeType) => {
    if (saving || !badges.includes(id)) {
      return;
    }
    const next = visibleBadges.includes(id)
      ? visibleBadges.filter((item) => item !== id)
      : [...visibleBadges, id];
    setVisibleBadges(next);
    void persist(frameId, auraId, next);
  };

  if (!user) {
    return null;
  }

  return (
    <ScreenTransition animateOnFocus>
      <View style={mainStyles.container}>
        {isDesktopWeb ? (
          <View style={styles.stickyHeader}>
            {showCompactNav ? <MobileBackButton /> : null}
            <Text style={[mainStyles.title, styles.headerTitle]} numberOfLines={1}>
              Оформление профиля
            </Text>
            <View style={styles.headerActions}>
              <PreviewButton
                colors={colors}
                compact
                style={styles.headerButton}
                onPress={() => setPreviewOpen(true)}
              />
              <CollectionShopButton colors={colors} compact style={styles.headerButton} />
            </View>
          </View>
        ) : (
          <MobileScreenHeader title="Оформление профиля" showBack />
        )}

        <ScrollView
          style={mainStyles.scroll}
          contentContainerStyle={[styles.page, { paddingBottom: Spacing.xl }]}
          showsVerticalScrollIndicator={false}>
        <Text style={styles.hint}>
          Награды, рамка и выделение видны другим: в чатах, в ленте и на анкете.
        </Text>
        <View style={styles.filtersRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: ownedOnly }}
            onPress={() => setOwnedOnly((value) => !value)}
            style={({ pressed }) => [
              styles.filterChip,
              ownedOnly && styles.filterChipSelected,
              pressed && styles.optionPressed,
            ]}>
            <Ionicons
              name={ownedOnly ? 'checkmark-circle' : 'checkmark-circle-outline'}
              size={16}
              color={colors.primary}
            />
            <Text style={styles.filterChipLabel}>Доступные мне</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Heading
            styles={styles}
            icon="ribbon-outline"
            iconColor={gold.fg}
            well={styles.sectionIconGold}>
            Награды
          </Heading>
          <Text style={styles.emptyNote}>
            Полученные награды отображаются в профиле и рядом с вашим именем.
          </Text>
          {badges.length === 0 ? (
            <Text style={styles.emptyNote}>У вас ещё нет наград.</Text>
          ) : (
            <View style={styles.rewardRow}>
              {badges.map((id) => (
                <RewardChip
                  key={id}
                  styles={styles}
                  id={id}
                  visible={visibleBadges.includes(id)}
                  disabled={saving}
                  onPress={() => toggleBadge(id)}
                />
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Heading
            styles={styles}
            icon="person-circle-outline"
            iconColor={colors.primary}
            well={styles.sectionIconPrimary}>
            Рамка аватара
          </Heading>
          <Text style={styles.emptyNote}>
            Ваша рамка отображается вокруг аватара в чатах, звонках и других местах со ссылкой на профиль.
          </Text>
          <View style={styles.options}>
            <CosmeticOption
              styles={styles}
              active={frameId === 'none'}
              disabled={saving}
              label="Выкл"
              onPress={() => pickFrame('none')}>
              <UserAvatar nickname={user.nickname} avatarUrl={avatarUrl} size={52} frameId="none" />
            </CosmeticOption>
          </View>

          {visibleUniqueFrames.length > 0 ? (
          <View style={styles.group}>
            <Heading
              styles={styles}
              icon="sparkles"
              iconColor={gold.fg}
              well={styles.sectionIconGold}
              titleStyle={styles.groupLabel}>
              Уникальные рамки
            </Heading>
          <Text style={styles.emptyNote}>
            Особые рамки, которые можно получить только за определённые достижения или награды.
          </Text>
          <View style={styles.options}>
            {visibleUniqueFrames.map((id) => {
              const owned = frames.includes(id);
              const unique = isUniqueAvatarFrame(id);
              return (
                <CosmeticOption
                  key={id}
                  styles={styles}
                  active={owned && frameId === id}
                  locked={!owned}
                  unique={unique}
                  uniqueMark={unique ? 'gold' : 'brand'}
                  disabled={saving}
                  label={AVATAR_FRAMES[id].label}
                  onPress={() =>
                    owned ? pickFrame(id) : showLockedReward(AVATAR_FRAMES[id].badge)
                  }>
                  <UserAvatar nickname={user.nickname} avatarUrl={avatarUrl} size={52} frameId={id} />
                </CosmeticOption>
              );
            })}
          </View>
          </View>
          ) : null}

          {visibleShopFrames.length > 0 ? (
          <View style={styles.group}>
            <Heading
              styles={styles}
              icon="bag-handle-outline"
              iconColor={colors.primary}
              well={styles.sectionIconPrimary}
              titleStyle={styles.groupLabelShop}>
              Коллекция
            </Heading>
          <View style={styles.options}>
            {visibleShopFrames.map((id) => {
              const owned = frames.includes(id);
              return (
                <CosmeticOption
                  key={id}
                  styles={styles}
                  active={owned && frameId === id}
                  locked={!owned}
                  disabled={saving}
                  label={AVATAR_FRAMES[id].label}
                  onPress={() => (owned ? pickFrame(id) : void openCosmeticsShop())}>
                  <UserAvatar nickname={user.nickname} avatarUrl={avatarUrl} size={52} frameId={id} />
                </CosmeticOption>
              );
            })}
          </View>
          {!isDesktopWeb && showFrameShop ? (
            <CollectionShopButton colors={colors} style={styles.shopButton} />
          ) : null}
          </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Heading
            styles={styles}
            icon="color-wand-outline"
            iconColor={styles.auraIcon.color as string}
            well={styles.sectionIconAura}>
            Выделение анкеты
          </Heading>
          <Text style={styles.emptyNote}>
            Яркая анимация помогает выделить вашу анкету среди других пользователей.
          </Text>
          {!isDesktopWeb ? (
            <PreviewButton colors={colors} style={styles.shopButton} onPress={() => setPreviewOpen(true)} />
          ) : null}
          <View style={styles.options}>
            <CosmeticOption
              styles={styles}
              active={auraId === 'none'}
              disabled={saving}
              label="Выкл"
              onPress={() => pickAura('none')}>
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 12,
                  backgroundColor: colors.background,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              />
            </CosmeticOption>
          </View>

          {visibleUniqueAuras.length > 0 ? (
          <View style={styles.group}>
            <Heading
              styles={styles}
              icon="sparkles"
              iconColor={gold.fg}
              well={styles.sectionIconGold}
              titleStyle={styles.groupLabel}>
              Уникальные
            </Heading>
          <Text style={styles.emptyNote}>
            Особые выделения, которые можно получить только за определённые достижения или награды.
          </Text>
          <View style={styles.options}>
            {visibleUniqueAuras.map((id) => {
              const owned = auras.includes(id);
              return (
                <CosmeticOption
                  key={id}
                  styles={styles}
                  active={owned && auraId === id}
                  locked={!owned}
                  unique
                  disabled={saving}
                  label={QUESTIONNAIRE_AURAS[id].label}
                  onPress={() =>
                    owned ? pickAura(id) : showLockedReward(QUESTIONNAIRE_AURAS[id].badge)
                  }>
                  <QuestionnaireHighlight auraId={id} radius={8}>
                    <View
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 8,
                        backgroundColor: colors.background,
                      }}
                    />
                  </QuestionnaireHighlight>
                </CosmeticOption>
              );
            })}
          </View>
          </View>
          ) : null}

          {visibleShopAuras.length > 0 ? (
          <View style={styles.group}>
            <Heading
              styles={styles}
              icon="bag-handle-outline"
              iconColor={colors.primary}
              well={styles.sectionIconPrimary}
              titleStyle={styles.groupLabelShop}>
              Коллекция
            </Heading>
          <View style={styles.options}>
            {visibleShopAuras.map((id) => {
              const owned = auras.includes(id);
              return (
                <CosmeticOption
                  key={id}
                  styles={styles}
                  active={owned && auraId === id}
                  locked={!owned}
                  disabled={saving}
                  label={QUESTIONNAIRE_AURAS[id].label}
                  onPress={() => (owned ? pickAura(id) : void openCosmeticsShop())}>
                  <QuestionnaireHighlight auraId={id} radius={8}>
                    <View
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 8,
                        backgroundColor: colors.background,
                      }}
                    />
                  </QuestionnaireHighlight>
                </CosmeticOption>
              );
            })}
          </View>
          {!isDesktopWeb && showAuraShop ? (
            <CollectionShopButton colors={colors} style={styles.shopButton} />
          ) : null}
          </View>
          ) : null}
        </View>
        </ScrollView>
      </View>
      <CosmeticsPreviewModal
        visible={previewOpen}
        onClose={() => setPreviewOpen(false)}
        nickname={user.nickname}
        avatarUrl={avatarUrl}
        frameId={frameId}
        auraId={auraId}
        badges={visibleBadges}
        profile={profile}
      />
    </ScreenTransition>
  );
}
