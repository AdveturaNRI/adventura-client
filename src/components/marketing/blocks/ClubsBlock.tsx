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
import type { ClubFeedBlock, MarketingClubCard } from '@/components/marketing/types';

type Props = {
  block: ClubFeedBlock;
  skin: ResolvedMarketingSkin;
  clubs: MarketingClubCard[] | null;
  loading: boolean;
  onCta: (url: string, key: string) => void;
  onOpenClub: (id: string) => void;
};

export function ClubsBlockView({ block, skin, clubs, loading, onCta, onOpenClub }: Props) {
  const { isMobile, isTablet } = useMarketingBreakpoint();
  const cols = isMobile ? 1 : isTablet ? 2 : 4;
  const key = block.id ?? 'clubs';

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
      ) : !clubs || clubs.length === 0 ? (
        <View style={[styles.empty, { borderColor: skin.border, backgroundColor: skin.surfaceElevated }]}>
          <Text style={[MarketingType.label, { color: skin.text }]}>Клубы скоро появятся</Text>
          <Text style={[MarketingType.body, { color: skin.textSecondary }]}>Покажем сообщества, которые подходят именно тебе.</Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {clubs.map((club) => (
            <Pressable
              key={club.id}
              onPress={() => onOpenClub(club.id)}
              style={{
                flexGrow: 1,
                flexBasis: `${Math.floor(100 / cols) - 2}%`,
                maxWidth: cols === 1 ? '100%' : undefined,
              }}>
              <MarketingCard skin={skin} style={styles.card}>
                <CoverImage uri={club.coverUrl} style={styles.cover} />
                <View style={styles.body}>
                  <Text style={[MarketingType.label, { color: skin.text }]} numberOfLines={2}>
                    {club.name?.trim() || 'Клуб'}
                  </Text>
                  <Text style={[MarketingType.caption, { color: skin.textSecondary }]} numberOfLines={2}>
                    {club.city?.name || club.address || 'Локация уточняется'}
                  </Text>
                  {club.description ? (
                    <Text style={[MarketingType.caption, { color: skin.textSecondary }]} numberOfLines={3}>
                      {club.description}
                    </Text>
                  ) : null}
                </View>
              </MarketingCard>
            </Pressable>
          ))}
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
