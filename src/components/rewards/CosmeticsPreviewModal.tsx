import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { UserAvatar } from '@/components/navigation/UserAvatar';
import { avatarFrameOuterSize } from '@/components/rewards/AvatarFrame';
import { NameWithBadges } from '@/components/rewards/RewardBadge';
import { UserCard } from '@/components/ui';
import type { UserCardProps } from '@/components/ui/cards/UserCard';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import type { AvatarFrameId, QuestionnaireAuraId, RewardBadgeType } from '@/data/rewards/catalog';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import type { UserProfile } from '@/services/api/types';
import { pickProfileCardUrl } from '@/services/profile/profileApi';
import { formatUserCardVisibility } from '@/utils/user-card-format';
import { DEFAULT_TIMEZONE } from '@/utils/timezones';

const DESKTOP_SHEET_MAX_WIDTH = 520;
const PARTNER_NAME = 'Лира';
const CALL_AVATAR_SIZE = 68;
const CALL_AVATAR_OUTER = avatarFrameOuterSize(CALL_AVATAR_SIZE);
const CALL_RING = CALL_AVATAR_OUTER + 8;

type CosmeticsPreviewModalProps = {
  visible: boolean;
  onClose: () => void;
  nickname: string;
  avatarUrl: string | null;
  frameId: AvatarFrameId;
  auraId: QuestionnaireAuraId;
  badges: RewardBadgeType[];
  profile: UserProfile | null;
};

function createStyles(colors: ThemeColors, isDesktopWeb: boolean, bottomInset: number) {
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
      maxWidth: isDesktopWeb ? DESKTOP_SHEET_MAX_WIDTH : undefined,
      maxHeight: isDesktopWeb ? '86%' : '90%',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderBottomLeftRadius: isDesktopWeb ? 20 : 0,
      borderBottomRightRadius: isDesktopWeb ? 20 : 0,
      backgroundColor: colors.background,
      overflow: 'hidden',
      ...(isDesktopWeb
        ? {
            borderWidth: 1,
            borderColor: colors.borderLight,
          }
        : null),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
      backgroundColor: colors.surface,
    },
    title: {
      fontSize: FontSize.button,
      fontWeight: '700',
      color: colors.text,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closePressed: {
      opacity: 0.75,
    },
    scroll: {
      flexGrow: 0,
    },
    content: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.lg,
      paddingBottom: (isDesktopWeb ? Spacing.lg : bottomInset + Spacing.md) + 8,
      gap: Spacing.xl,
    },
    section: {
      gap: Spacing.sm,
    },
    sectionLabel: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.primary,
    },
    stage: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      padding: Spacing.md,
      gap: Spacing.sm,
    },
    chatLine: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
    },
    bubble: {
      maxWidth: '78%',
      borderRadius: 14,
      borderBottomLeftRadius: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: colors.surfaceMuted,
      gap: 2,
    },
    bubbleText: {
      fontSize: FontSize.label,
      color: colors.text,
      lineHeight: FontSize.label * 1.35,
    },
    senderName: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
      marginBottom: 2,
    },
    callRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'flex-start',
      gap: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    callTile: {
      alignItems: 'center',
      gap: 8,
      flex: 1,
      minWidth: 0,
      maxWidth: 200,
    },
    callRing: {
      width: CALL_RING,
      height: CALL_RING,
      borderRadius: CALL_RING / 2,
      borderWidth: 3,
      borderColor: '#23A559',
      alignItems: 'center',
      justifyContent: 'center',
    },
    callAvatarSlot: {
      width: CALL_AVATAR_OUTER,
      height: CALL_AVATAR_OUTER,
      alignItems: 'center',
      justifyContent: 'center',
    },
    callName: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
      width: '100%',
    },
    cardStage: {
      overflow: 'visible',
      padding: 10,
    },
  });
}

function profileToCardProps(
  profile: UserProfile | null,
  nickname: string,
  avatarUrl: string | null,
  auraId: QuestionnaireAuraId,
  badges: RewardBadgeType[],
): UserCardProps {
  const cities =
    profile?.cities && profile.cities.length > 0
      ? profile.cities.map((city) => city.name.trim()).filter(Boolean)
      : profile?.city?.name
        ? [profile.city.name]
        : profile?.location?.trim()
          ? [profile.location.trim()]
          : [];
  const visibility = formatUserCardVisibility(profile?.isPublic ?? true);
  const tagline = profile?.about?.trim() || 'Так выглядит ваша анкета';
  const description = profile?.description?.trim() ?? '';
  const about = profile?.about?.trim() ?? '';
  const bio = description || (about && about !== tagline ? about : '') || 'Так анкета выглядит у других игроков.';
  const cardPhoto = pickProfileCardUrl(profile?.profileCard, profile?.updatedAt) ?? avatarUrl ?? undefined;
  const experience =
    profile?.experienceTypes
      ?.map((item) => item.name.trim())
      .filter(Boolean)
      .join(', ') || 'Не указано';

  return {
    name: nickname,
    age: profile?.age,
    tagline,
    roles: profile?.roles && profile.roles.length > 0 ? profile.roles : ['Игрок'],
    avatarUrl: cardPhoto,
    playInfo: {
      playsOnline: profile?.playsOnline ?? true,
      locations: cities,
      location: cities[0] ?? null,
      systems: profile?.systems ?? [],
      readyToLearnNew: profile?.readyToLearnNew ?? false,
      openToAnySystem: profile?.openToAnySystem ?? false,
      experience,
      schedule: profile?.availability?.trim() || 'Не указано',
      timezone: profile?.timezone?.trim() || DEFAULT_TIMEZONE,
    },
    bio,
    visibility: visibility.label,
    visibilityVariant: visibility.variant,
    badges,
    auraId,
    size: 'compact',
  };
}

export function CosmeticsPreviewModal({
  visible,
  onClose,
  nickname,
  avatarUrl,
  frameId,
  auraId,
  badges,
  profile,
}: CosmeticsPreviewModalProps) {
  const colors = useTheme();
  const isDesktopWeb = useIsDesktopWeb();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles((themeColors) =>
    createStyles(themeColors, isDesktopWeb, insets.bottom),
  );
  const cardProps = profileToCardProps(profile, nickname, avatarUrl, auraId, badges);

  return (
    <Modal
      visible={visible}
      transparent
      animationType={isDesktopWeb ? 'fade' : 'slide'}
      onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Предпросмотр</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Закрыть"
              onPress={onClose}
              hitSlop={8}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.closePressed]}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            bounces={false}
            showsVerticalScrollIndicator={false}>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Чат</Text>
              <View style={styles.stage}>
                <View style={styles.chatLine}>
                  <UserAvatar nickname={PARTNER_NAME} avatarUrl={null} size={30} />
                  <View style={styles.bubble}>
                    <Text style={styles.bubbleText}>Погнали играть!</Text>
                  </View>
                </View>
                <View style={styles.chatLine}>
                  <UserAvatar
                    nickname={nickname}
                    avatarUrl={avatarUrl}
                    size={30}
                    badges={badges}
                    frameId={frameId}
                  />
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <NameWithBadges
                      name={nickname}
                      badges={badges}
                      textStyle={styles.senderName}
                      badgeSize={11}
                    />
                    <View style={[styles.bubble, { alignSelf: 'flex-start' }]}>
                      <Text style={styles.bubbleText}>Я веду, жду всех в звонке</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Звонок</Text>
              <View style={styles.stage}>
                <View style={styles.callRow}>
                  <View style={styles.callTile}>
                    <View style={styles.callRing}>
                      <View style={styles.callAvatarSlot}>
                        <UserAvatar
                          nickname={nickname}
                          avatarUrl={avatarUrl}
                          size={CALL_AVATAR_SIZE}
                          badges={badges}
                          frameId={frameId}
                        />
                      </View>
                    </View>
                    <NameWithBadges
                      name={`${nickname} (вы)`}
                      badges={badges}
                      textStyle={styles.callName}
                      badgeSize={12}
                      layout="stack"
                      align="center"
                    />
                  </View>
                  <View style={styles.callTile}>
                    <View style={[styles.callRing, { borderColor: 'transparent' }]}>
                      <View style={styles.callAvatarSlot}>
                        <UserAvatar nickname={PARTNER_NAME} avatarUrl={null} size={CALL_AVATAR_SIZE} />
                      </View>
                    </View>
                    <Text style={styles.callName}>{PARTNER_NAME}</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Анкета</Text>
              <View style={styles.cardStage}>
                <UserCard {...cardProps} />
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
