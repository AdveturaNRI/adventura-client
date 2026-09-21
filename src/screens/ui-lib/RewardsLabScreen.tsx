import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DiceStage, type DiceStageHandle } from '@/components/dice/DiceStage';
import { useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { UserAvatar } from '@/components/navigation/UserAvatar';
import { AvatarFrame, avatarFrameOuterSize } from '@/components/rewards/AvatarFrame';
import { DiceCritBurst } from '@/components/rewards/DiceCritBurst';
import { NameWithBadges, RewardBadgeRow } from '@/components/rewards/RewardBadge';
import { UserCard } from '@/components/ui';
import { FontSize, Radius, Spacing, type ThemeColors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useMyAvatarUrl } from '@/context/ProfileContext';
import {
  AVATAR_FRAMES,
  DICE_SKINS,
  QUESTIONNAIRE_AURAS,
  REWARD_BADGES,
  REWARD_BADGE_TYPES,
  SHOWCASE_AURA_IDS,
  SHOWCASE_AVATAR_FRAME_IDS,
  SHOWCASE_DICE_SKIN_IDS,
  skinAccent,
  type DiceSkinId,
  type QuestionnaireAuraId,
} from '@/data/rewards/catalog';
import type { UserCardDeckSize } from '@/components/ui/cards/UserCard';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

const DEMO_AVATAR =
  'https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=240&q=80';
const CALL_AVATAR_SIZE = 72;
const CALL_AVATAR_OUTER = avatarFrameOuterSize(CALL_AVATAR_SIZE);
const CALL_RING = CALL_AVATAR_OUTER + 8;

const PLAY_INFO = {
  playsOnline: true,
  location: 'Екатеринбург',
  systems: ['D&D 5'],
  readyToLearnNew: true,
  openToAnySystem: false,
  experience: '2 года',
  schedule: 'ПТ с 20:00',
  timezone: 'Asia/Yekaterinburg',
};

const LAB_CONTENT_MAX = 1120;
const QUESTIONNAIRE_CARD_WIDTH = 480;
const WIDE_CARD_HEIGHT = 420;
const WIDE_CARD_MIN_HEIGHT = 280;

function computeWideDeckSize(availableWidth: number): UserCardDeckSize {
  const available = Math.max(320, availableWidth);
  let cardHeight = WIDE_CARD_HEIGHT;
  let photoWidth = Math.round(cardHeight * (3 / 4));
  let bodyWidth = Math.round(photoWidth * 1.35);
  let cardWidth = photoWidth + bodyWidth;

  if (cardWidth > available) {
    const scale = available / cardWidth;
    cardHeight = Math.max(WIDE_CARD_MIN_HEIGHT, Math.round(cardHeight * scale));
    photoWidth = Math.round(cardHeight * (3 / 4));
    bodyWidth = Math.max(160, available - photoWidth);
    cardWidth = photoWidth + bodyWidth;
  }

  return { width: cardWidth, height: cardHeight, photoWidth };
}

function createStyles(colors: ThemeColors, isDesktopWeb: boolean) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: Spacing.lg,
      gap: Spacing.xl,
      paddingBottom: 80,
      maxWidth: isDesktopWeb ? LAB_CONTENT_MAX : undefined,
      width: '100%',
      alignSelf: 'center',
    },
    hero: {
      gap: Spacing.sm,
    },
    kicker: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.primary,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    title: {
      fontSize: 32,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.6,
    },
    lead: {
      fontSize: FontSize.label,
      color: colors.textMuted,
      lineHeight: FontSize.label * 1.5,
      maxWidth: 640,
    },
    section: {
      gap: Spacing.md,
    },
    sectionTitle: {
      fontSize: FontSize.button,
      fontWeight: '700',
      color: colors.text,
    },
    sectionHint: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.4,
    },
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.lg,
      alignItems: 'flex-end',
    },
    cell: {
      alignItems: 'center',
      gap: 8,
      overflow: 'visible',
      paddingHorizontal: 6,
    },
    caption: {
      fontSize: 12,
      color: colors.textMuted,
    },
    cardGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignContent: 'flex-start',
      alignItems: 'flex-start',
      gap: Spacing.lg,
    },
    cardStage: {
      maxWidth: QUESTIONNAIRE_CARD_WIDTH,
      overflow: 'visible',
      ...(isDesktopWeb
        ? ({ width: `calc(50% - ${Spacing.lg / 2}px)` } as object)
        : { width: '100%' as const }),
    },
    wideList: {
      gap: Spacing.xl,
      alignItems: 'flex-start',
    },
    wideStage: {
      overflow: 'visible',
      maxWidth: '100%',
    },
    frameCaption: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: 'center',
      maxWidth: 108,
    },
    chatPreview: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: Spacing.md,
      gap: Spacing.sm,
    },
    callPreview: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: '#1E1F22',
      paddingVertical: Spacing.lg,
      paddingHorizontal: Spacing.md,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'flex-start',
      gap: Spacing.md,
    },
    callTile: {
      flex: 1,
      minWidth: 0,
      maxWidth: 220,
      alignItems: 'center',
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 10,
      borderRadius: 16,
      backgroundColor: '#2B2D31',
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
    callSlot: {
      width: CALL_AVATAR_OUTER,
      height: CALL_AVATAR_OUTER,
      alignItems: 'center',
      justifyContent: 'center',
    },
    callName: {
      color: '#F2F3F5',
      fontSize: 13,
      fontWeight: '700',
      textAlign: 'center',
      width: '100%',
    },
    chatLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    bubble: {
      flex: 1,
      minWidth: 0,
      backgroundColor: colors.surfaceMuted,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 8,
      gap: 4,
    },
    bubbleText: {
      fontSize: FontSize.label,
      color: colors.text,
    },
    skinGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    skinCard: {
      flexGrow: 1,
      minWidth: 168,
      maxWidth: 280,
      borderRadius: 16,
      borderWidth: 1.5,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 4,
    },
    skinTitle: {
      fontWeight: '700',
      fontSize: 14,
    },
    skinHint: {
      fontSize: 12,
      lineHeight: 16,
      color: colors.textMuted,
    },
    diceTray: {
      height: 360,
      borderRadius: 20,
      overflow: 'hidden',
      backgroundColor: '#0B1220',
      position: 'relative',
    },
    diceActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    lastRoll: {
      fontSize: FontSize.label,
      fontWeight: '700',
      color: colors.text,
    },
    critBtn: {
      alignSelf: 'flex-start',
      minHeight: 40,
      paddingHorizontal: 14,
      borderRadius: Radius.pill,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    critBtnGhost: {
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    critBtnLabel: {
      color: colors.onPrimary,
      fontWeight: '700',
    },
    critBtnGhostLabel: {
      color: colors.primary,
    },
  });
}

const LAB_DICE_SKINS: DiceSkinId[] = [...SHOWCASE_DICE_SKIN_IDS];

function LabAuraCard({
  auraId,
  nickname,
  photo,
  layout,
  deckSize,
  style,
}: {
  auraId: Exclude<QuestionnaireAuraId, 'none'>;
  nickname: string;
  photo: string;
  layout?: 'deckWide';
  deckSize?: UserCardDeckSize;
  style?: StyleProp<ViewStyle>;
}) {
  const spec = QUESTIONNAIRE_AURAS[auraId];
  const badge = spec.badge;
  return (
    <View style={style}>
      <UserCard
        name={nickname}
        age={24}
        tagline={spec.label}
        roles={['Мастер', 'Игрок']}
        avatarUrl={photo}
        badges={badge ? [badge] : []}
        auraId={auraId}
        playInfo={PLAY_INFO}
        bio={spec.hint}
        visibility="Публичная"
        layout={layout}
        deckSize={deckSize}
        size={layout === 'deckWide' ? 'compact' : 'default'}
      />
    </View>
  );
}

export default function RewardsLabScreen() {
  const colors = useTheme();
  const isDesktopWeb = useIsDesktopWeb();
  const { width: windowWidth } = useWindowDimensions();
  const styles = useThemedStyles((themeColors) => createStyles(themeColors, isDesktopWeb));
  const wideDeckSize = useMemo(() => {
    const available = Math.min(LAB_CONTENT_MAX, windowWidth) - Spacing.lg * 2;
    return computeWideDeckSize(available);
  }, [windowWidth]);
  const { user } = useAuth();
  const avatarUrl = useMyAvatarUrl();
  const photo = avatarUrl ?? DEMO_AVATAR;
  const nickname = user?.nickname ?? 'Пионер';
  const stageRef = useRef<DiceStageHandle>(null);
  const [activeSkin, setActiveSkin] = useState<DiceSkinId>('alpha_pioneer');
  const [stageReady, setStageReady] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [critFlash, setCritFlash] = useState(false);
  const [lastRoll, setLastRoll] = useState<number | null>(null);

  useEffect(() => {
    if (!stageReady) {
      return;
    }
    const timer = setTimeout(() => {
      stageRef.current?.resize();
      stageRef.current?.preview('1d20');
    }, 80);
    return () => clearTimeout(timer);
  }, [stageReady, activeSkin]);

  const flashCrit = () => {
    setCritFlash(true);
    setTimeout(() => setCritFlash(false), 1100);
  };

  const handleRoll = async () => {
    if (!stageReady || rolling) {
      return;
    }
    setRolling(true);
    setCritFlash(false);
    try {
      const outcome = await stageRef.current?.roll('1d20');
      const value = outcome?.values[0] ?? null;
      setLastRoll(value);
      if (value === 20) {
        flashCrit();
      }
    } catch {
      // superseded / cleared
    } finally {
      setRolling(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.kicker}>Витрина</Text>
          <Text style={styles.title}>Награды первопроходцев</Text>
          <Text style={styles.lead}>
            Статусы с рамкой, свечением анкеты и скинами кубиков. Награды выдаются вручную из админки.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Бейджи</Text>
          <RewardBadgeRow badges={[...REWARD_BADGE_TYPES]} size={18} />
          <View style={styles.chatPreview}>
            {REWARD_BADGE_TYPES.map((badge) => (
              <View key={badge} style={styles.chatLine}>
                <AvatarFrame size={30} badges={[badge]}>
                  <UserAvatar nickname="Mira" avatarUrl={DEMO_AVATAR} size={30} />
                </AvatarFrame>
                <View style={styles.bubble}>
                  <NameWithBadges
                    name={REWARD_BADGES[badge].label}
                    badges={[badge]}
                    textStyle={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}
                  />
                  <Text style={styles.bubbleText}>{REWARD_BADGES[badge].tooltip}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Звонок</Text>
          <View style={styles.callPreview}>
            <View style={styles.callTile}>
              <View style={styles.callRing}>
                <View style={styles.callSlot}>
                  <UserAvatar
                    nickname={nickname}
                    avatarUrl={photo}
                    size={CALL_AVATAR_SIZE}
                    badges={[...REWARD_BADGE_TYPES]}
                    frameId="alpha_runes"
                  />
                </View>
              </View>
              <NameWithBadges
                name={`${nickname} (вы)`}
                badges={[...REWARD_BADGE_TYPES]}
                textStyle={styles.callName}
                badgeSize={12}
                layout="stack"
                align="center"
              />
            </View>
            <View style={styles.callTile}>
              <View style={[styles.callRing, { borderColor: 'transparent' }]}>
                <View style={styles.callSlot}>
                  <UserAvatar nickname="Лира" avatarUrl={null} size={CALL_AVATAR_SIZE} />
                </View>
              </View>
              <Text style={styles.callName}>Лира</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Рамки аватара</Text>
          <Text style={styles.sectionHint}>
            First Wave — голубой блик по кольцу, без фейерверков. Остальные рамки уже со своими штуками: лепестки, молнии, шестерни.
          </Text>
          <View style={styles.row}>
            <View style={styles.cell}>
              <UserAvatar nickname={nickname} avatarUrl={photo} size={96} />
              <Text style={styles.frameCaption}>Без рамки</Text>
            </View>
            {SHOWCASE_AVATAR_FRAME_IDS.map((frameId) => {
              const spec = AVATAR_FRAMES[frameId];
              return (
                <View key={frameId} style={styles.cell}>
                  <AvatarFrame size={96} frameId={frameId}>
                    <UserAvatar nickname={nickname} avatarUrl={photo} size={96} />
                  </AvatarFrame>
                  <Text style={styles.frameCaption}>{spec.label}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Выделение анкеты</Text>
          <Text style={styles.sectionHint}>
            У каждой ауры свой приём: сетка, лепестки, дождь, голограмма, магма.
          </Text>
          <View style={styles.cardGrid}>
            {SHOWCASE_AURA_IDS.map((auraId) => (
              <LabAuraCard
                key={auraId}
                auraId={auraId}
                nickname={nickname}
                photo={photo}
                style={styles.cardStage}
              />
            ))}
          </View>
          <Text style={styles.sectionHint}>
            Горизонтально — так карточка лежит в колоде на компьютере.
          </Text>
          <View style={styles.wideList}>
            {SHOWCASE_AURA_IDS.map((auraId) => (
              <LabAuraCard
                key={`wide-${auraId}`}
                auraId={auraId}
                nickname={nickname}
                photo={photo}
                layout="deckWide"
                deckSize={wideDeckSize}
                style={[styles.wideStage, { width: wideDeckSize.width, height: wideDeckSize.height }]}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Скины кубиков</Text>
          <Text style={styles.sectionHint}>
            Не просто цвет: у Первопроходца золотой ореол, у Истребителя багов сканлайны, у Первого мастера — фиолетовое пламя,
            у Хозяина таверны — дуб и эль.
          </Text>
          <View style={styles.skinGrid}>
            {LAB_DICE_SKINS.map((id) => {
              const spec = DICE_SKINS[id];
              const active = activeSkin === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => setActiveSkin(id)}
                  style={[
                    styles.skinCard,
                    {
                      borderColor: active ? spec.accent : colors.border,
                      backgroundColor: active ? `${spec.accent}18` : colors.surface,
                    },
                  ]}>
                  <Text style={[styles.skinTitle, { color: spec.accent }]}>{spec.label}</Text>
                  <Text style={styles.skinHint}>{spec.hint}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.diceTray}>
            <DiceStage
              ref={stageRef}
              accent={skinAccent(activeSkin)}
              skin={activeSkin}
              animationSpeed="fast"
              scale={11}
              centerSpawn
              onReady={() => setStageReady(true)}
            />
            <DiceCritBurst visible={critFlash} skinId={activeSkin} />
          </View>
          <View style={styles.diceActions}>
            <Pressable
              onPress={() => void handleRoll()}
              disabled={!stageReady || rolling}
              style={[styles.critBtn, (!stageReady || rolling) && { opacity: 0.55 }]}>
              <Text style={styles.critBtnLabel}>
                {!stageReady ? 'Стол грузится…' : rolling ? 'Бросок…' : 'Бросить d20'}
              </Text>
            </Pressable>
            <Pressable onPress={flashCrit} style={[styles.critBtn, styles.critBtnGhost]}>
              <Text style={[styles.critBtnLabel, styles.critBtnGhostLabel]}>Вспышка крита</Text>
            </Pressable>
            {lastRoll != null ? (
              <Text style={styles.lastRoll}>
                {lastRoll === 20 ? 'Натуральная 20' : lastRoll === 1 ? 'Натуральная 1' : `Выпало ${lastRoll}`}
              </Text>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
