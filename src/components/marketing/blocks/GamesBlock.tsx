import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  CoverImage,
  MarketingButton,
  MarketingCard,
  MarketingPanel,
  MarketingSection,
  SectionHeader,
  useMarketingBreakpoint,
} from '@/components/marketing/shared';
import { MarketingType, type ResolvedMarketingSkin } from '@/components/marketing/theme';
import type { GameFeedBlock, MarketingGameCard } from '@/components/marketing/types';
import { formatCityLabel } from '@/utils/city-label';
import { DEFAULT_TIMEZONE, formatDateTimeInTimezone } from '@/utils/timezones';

type Props = {
  block: GameFeedBlock;
  skin: ResolvedMarketingSkin;
  games: MarketingGameCard[] | null;
  loading: boolean;
  onCta: (url: string, key: string) => void;
  onOpenGame: (id: string) => void;
};

type IconName = ComponentProps<typeof Ionicons>['name'];

/** One column on phones: a long stack of cards pushes the rest of the landing too far down. */
const MOBILE_GAMES_LIMIT = 3;
/** Two even rows of three on desktop and tablet. */
const WIDE_GAMES_LIMIT = 6;

/** Same palette as the games feed card, so the landing reads like the app. */
const RECRUITING_GREEN = '#34C759';
const FREE_GREEN = '#3DAB5A';
const CAMPAIGN_ORANGE = '#FF9500';

function viewerTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

function formatDuration(hours: number | null | undefined): string | null {
  if (hours == null || hours < 1) return null;
  const mod10 = hours % 10;
  const mod100 = hours % 100;
  let unit = 'часов';
  if (mod100 < 11 || mod100 > 14) {
    if (mod10 === 1) unit = 'час';
    else if (mod10 >= 2 && mod10 <= 4) unit = 'часа';
  }
  return `~${hours} ${unit}`;
}

export function GamesBlockView({ block, skin, games, loading, onCta, onOpenGame }: Props) {
  const { isMobile, isTablet } = useMarketingBreakpoint();
  const cols = isMobile ? 1 : isTablet ? 2 : 3;
  const key = block.id ?? 'games';

  return (
    <MarketingSection skin={skin}>
      <MarketingPanel skin={skin}>
        <SectionHeader
        skin={skin}
        title={block.title}
        description={block.description}
        align="left"
        action={
          block.ctaLabel && block.ctaUrl ? (
            <MarketingButton
              skin={skin}
              label={block.ctaLabel}
              variant="ghost"
              onPress={() => onCta(block.ctaUrl!, key)}
            />
          ) : null
        }
      />
        {loading ? (
        <ActivityIndicator color={skin.accentColor} />
      ) : !games || games.length === 0 ? (
        <View style={[styles.empty, { borderColor: skin.border, backgroundColor: skin.surfaceElevated }]}>
          <Text style={[MarketingType.label, { color: skin.text }]}>Игры скоро появятся</Text>
          <Text style={[MarketingType.body, { color: skin.textSecondary }]}>Здесь будут актуальные встречи сообщества.</Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {games.slice(0, isMobile ? MOBILE_GAMES_LIMIT : WIDE_GAMES_LIMIT).map((game) => (
            <Pressable
              key={game.id}
              accessibilityRole="button"
              accessibilityLabel={`Открыть игру ${game.title?.trim() || ''}`.trim()}
              onPress={() => onOpenGame(game.id)}
              style={{
                width: cols === 1 ? '100%' : (`${100 / cols - 1}%` as unknown as number),
                flexGrow: 1,
                flexBasis: `${Math.floor(100 / cols) - 2}%`,
                maxWidth: cols === 1 ? '100%' : undefined,
              }}>
              <LandingGameCard game={game} skin={skin} />
            </Pressable>
          ))}
        </View>
        )}
      </MarketingPanel>
    </MarketingSection>
  );
}

function LandingGameCard({ game, skin }: { game: MarketingGameCard; skin: ResolvedMarketingSkin }) {
  const cover = game.coverUrl || game.cover?.url || null;
  const accent = skin.accentColor;
  const isCampaign = game.kind === 'CAMPAIGN';
  const kindColor = isCampaign ? CAMPAIGN_ORANGE : accent;
  const location = game.isOnline
    ? 'Онлайн'
    : game.city?.name
      ? formatCityLabel({ name: game.city.name, region: game.city.region ?? null, countryCode: 'RU' })
      : 'Офлайн';
  const schedule =
    formatDateTimeInTimezone(game.scheduledAt ?? null, viewerTimezone()) ?? 'Дата по договорённости';
  const price = game.isFree
    ? 'Бесплатно'
    : game.priceRub != null
      ? `${game.priceRub.toLocaleString('ru-RU')} ₽`
      : null;
  const experience = game.beginnersWelcome
    ? 'Опыт не важен'
    : game.experienceLabel?.trim()
      ? `Опыт: ${game.experienceLabel.trim()}`
      : null;
  const age = game.minAge && game.minAge > 0 ? `${game.minAge}+` : 'Любой возраст';
  const duration = formatDuration(game.durationHours);
  const players =
    game.maxPlayers != null ? `${game.playersCount ?? 0}/${game.maxPlayers}` : null;
  const description = game.description?.trim();

  return (
    <MarketingCard skin={skin} style={styles.card}>
      <View style={styles.cover}>
        <CoverImage uri={cover} style={StyleSheet.absoluteFill} />
        <View pointerEvents="none" style={styles.coverShade} />
        <View style={styles.coverTop} pointerEvents="none">
          <View style={[styles.pill, { backgroundColor: RECRUITING_GREEN }]}>
            <Ionicons name="radio-button-on" size={11} color="#FFFFFF" />
            <Text style={styles.onCoverStrong}>Набор открыт</Text>
          </View>
          {game.owner?.nickname ? (
            <View style={[styles.pill, styles.masterChip]}>
              <View style={styles.masterAvatar}>
                <Ionicons name="person" size={11} color="#FFFFFF" />
              </View>
              <Text style={styles.onCoverStrong} numberOfLines={1}>
                {game.owner.nickname}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.coverBottom} pointerEvents="none">
          <View style={styles.dateChip}>
            <Ionicons name="today-outline" size={12} color="#FFFFFF" />
            <Text style={styles.onCoverText} numberOfLines={1}>
              {schedule}
            </Text>
          </View>
          {game.kind ? (
            <View style={[styles.kindBadge, { backgroundColor: kindColor }]}>
              <Ionicons
                name={isCampaign ? 'library-outline' : 'flash-outline'}
                size={13}
                color="#FFFFFF"
              />
              <Text style={styles.onCoverStrong}>{isCampaign ? 'Кампания' : 'Ваншот'}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.metaRow}>
          <Meta icon={game.isOnline ? 'wifi-outline' : 'map-outline'} label={location} skin={skin} />
          {game.systemName ? <Meta icon="layers-outline" label={game.systemName} skin={skin} /> : null}
          {experience ? (
            <Meta
              icon={game.beginnersWelcome ? 'leaf-outline' : 'ribbon-outline'}
              label={experience}
              skin={skin}
            />
          ) : null}
          {duration ? <TintBadge icon="timer-outline" label={duration} color={CAMPAIGN_ORANGE} /> : null}
          <TintBadge icon="id-card-outline" label={age} color={accent} />
        </View>

        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: skin.text }]} numberOfLines={2}>
            {game.title?.trim() || 'Игра'}
          </Text>
          {price ? (
            <View style={styles.price}>
              {game.isFree ? <Ionicons name="pricetag-outline" size={15} color={FREE_GREEN} /> : null}
              <Text style={[styles.priceText, { color: game.isFree ? FREE_GREEN : skin.text }]}>
                {price}
              </Text>
            </View>
          ) : null}
        </View>

        {description || players ? (
          <View style={styles.descriptionRow}>
            <Text style={[styles.description, { color: skin.textSecondary }]} numberOfLines={3}>
              {description || ''}
            </Text>
            {players ? (
              <View style={styles.players}>
                <Ionicons name="people-outline" size={13} color={skin.textSecondary} />
                <Text style={[styles.playersText, { color: skin.textSecondary }]}>{players}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </MarketingCard>
  );
}

function Meta({ icon, label, skin }: { icon: IconName; label: string; skin: ResolvedMarketingSkin }) {
  return (
    <View style={styles.meta}>
      <Ionicons name={icon} size={13} color={skin.textSecondary} />
      <Text style={[styles.metaText, { color: skin.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function TintBadge({ icon, label, color }: { icon: IconName; label: string; color: string }) {
  return (
    <View style={[styles.tintBadge, { backgroundColor: `${color}1F`, borderColor: `${color}38` }]}>
      <Ionicons name={icon} size={12} color={color} />
      <Text style={[styles.tintBadgeText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  card: { height: '100%' },
  cover: { width: '100%', aspectRatio: 16 / 9, position: 'relative', overflow: 'hidden' },
  coverShade: {
    ...StyleSheet.absoluteFill,
    ...Platform.select({
      web: {
        backgroundImage:
          'linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.12) 42%, rgba(0,0,0,0) 70%)',
      } as object,
      default: { backgroundColor: 'rgba(0,0,0,0.22)' },
    }),
  },
  coverTop: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  coverBottom: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    flexShrink: 0,
  },
  masterChip: {
    flexShrink: 1,
    minWidth: 0,
    maxWidth: '55%',
    paddingHorizontal: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  masterAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dateChip: {
    flexShrink: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  kindBadge: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
  },
  onCoverText: { flexShrink: 1, fontSize: 12, fontWeight: '600', color: '#FFFFFF' },
  onCoverStrong: { flexShrink: 1, fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  body: { padding: 14, gap: 12 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%' },
  metaText: { flexShrink: 1, fontSize: 12 },
  tintBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  tintBadgeText: { fontSize: 12, fontWeight: '700' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { flex: 1, minWidth: 0, fontSize: 16, lineHeight: 21, fontWeight: '700', letterSpacing: -0.2 },
  price: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 4 },
  priceText: { fontSize: 14, fontWeight: '700' },
  descriptionRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  description: { flex: 1, minWidth: 0, fontSize: 12, lineHeight: 18 },
  players: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 4 },
  playersText: { fontSize: 12, fontWeight: '600' },
  empty: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 22, gap: 6 },
});
