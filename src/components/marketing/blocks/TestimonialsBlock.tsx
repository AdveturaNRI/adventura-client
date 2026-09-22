import { StyleSheet, Text, View } from 'react-native';

import { LandingStaggerItem } from '@/components/marketing/LandingBlockReveal';
import {
  CoverImage,
  MarketingCard,
  MarketingPanel,
  MarketingSection,
  SectionHeader,
  useMarketingBreakpoint,
} from '@/components/marketing/shared';
import { MarketingType, type ResolvedMarketingSkin } from '@/components/marketing/theme';
import type { TestimonialsBlock } from '@/components/marketing/types';

type Props = {
  block: TestimonialsBlock;
  skin: ResolvedMarketingSkin;
};

export function TestimonialsBlockView({ block, skin }: Props) {
  const { isMobile } = useMarketingBreakpoint();
  const items = block.items ?? [];

  return (
    <MarketingSection skin={skin}>
      <MarketingPanel skin={skin}>
        <SectionHeader skin={skin} title={block.title} description={block.description} />
        <View style={[styles.grid, isMobile && styles.col]}>
        {items.map((item, idx) => (
          <LandingStaggerItem
            key={item.id ?? idx}
            index={idx}
            style={{ flex: 1, minWidth: 240 }}>
            <MarketingCard skin={skin} style={styles.card}>
              <View style={styles.head}>
                {item.imageUrl ? (
                  <CoverImage uri={item.imageUrl} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: skin.accentSecondary }]}>
                    <Text style={{ color: '#fff', fontWeight: '700' }}>
                      {(item.title || 'A').slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[MarketingType.label, { color: skin.text }]}>
                    {item.title || 'Игрок'}
                  </Text>
                  {item.meta ? (
                    <Text style={[MarketingType.caption, { color: skin.textSecondary }]}>{item.meta}</Text>
                  ) : null}
                </View>
              </View>
              {item.description ? (
                <Text style={[MarketingType.body, { color: skin.textSecondary, fontStyle: 'italic' }]}>
                  «{item.description}»
                </Text>
              ) : null}
            </MarketingCard>
          </LandingStaggerItem>
        ))}        </View>
      </MarketingPanel>
    </MarketingSection>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  col: { flexDirection: 'column' },
  card: { padding: 20, gap: 14, minHeight: 176 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
});
