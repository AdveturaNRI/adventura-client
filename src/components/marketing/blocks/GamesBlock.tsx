import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

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

type Props = {
  block: GameFeedBlock;
  skin: ResolvedMarketingSkin;
  games: MarketingGameCard[] | null;
  loading: boolean;
  onCta: (url: string, key: string) => void;
  onOpenGame: (id: string) => void;
};

export function GamesBlockView({ block, skin, games, loading, onCta, onOpenGame }: Props) {
  const { isMobile, isTablet } = useMarketingBreakpoint();
  const cols = isMobile ? 1 : isTablet ? 2 : 4;
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
          {games.map((game) => {
            const cover = game.coverUrl || game.cover?.url || null;
            const place = game.isOnline
              ? 'Онлайн'
              : game.city?.name || 'Офлайн';
            return (
              <Pressable
                key={game.id}
                onPress={() => onOpenGame(game.id)}
                style={{
                  width: cols === 1 ? '100%' : (`${100 / cols - 1}%` as unknown as number),
                  flexGrow: 1,
                  flexBasis: `${Math.floor(100 / cols) - 2}%`,
                  maxWidth: cols === 1 ? '100%' : undefined,
                }}>
              <MarketingCard skin={skin} style={styles.card}>
                  <CoverImage uri={cover} style={styles.cover} />
                  <View style={styles.body}>
                    <Text style={[MarketingType.label, { color: skin.text }]} numberOfLines={2}>
                      {game.title?.trim() || 'Игра'}
                    </Text>
                    {game.systemName ? (
                      <Text style={[MarketingType.caption, { color: skin.accentColor }]}>
                        {game.systemName}
                      </Text>
                    ) : null}
                    <Text style={[MarketingType.caption, { color: skin.textSecondary }]} numberOfLines={2}>
                      {[place, game.scheduledAt ? new Date(game.scheduledAt).toLocaleString('ru-RU') : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                    <Text style={[MarketingType.caption, { color: skin.textSecondary }]}>
                      {game.isFree ? 'Бесплатно' : game.priceRub != null ? `${game.priceRub} ₽` : ''}
                    </Text>
                  </View>
                </MarketingCard>
              </Pressable>
            );
          })}
        </View>
        )}
      </MarketingPanel>
    </MarketingSection>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  cover: { width: '100%', aspectRatio: 16 / 10 },
  body: { padding: 14, gap: 6 },
  card: { height: '100%' },
  empty: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 22, gap: 6 },
});
