import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LandingStaggerItem } from '@/components/marketing/LandingBlockReveal';
import {
  MarketingCard,
  MarketingPanel,
  MarketingSection,
  SectionHeader,
  useMarketingBreakpoint,
} from '@/components/marketing/shared';
import { FEATURE_ACCENTS, MarketingType, type ResolvedMarketingSkin } from '@/components/marketing/theme';
import type { FeaturesBlock } from '@/components/marketing/types';

type Props = {
  block: FeaturesBlock;
  skin: ResolvedMarketingSkin;
  onCta: (url: string, key: string) => void;
};

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  people: 'people',
  dice: 'dice',
  chat: 'chatbubbles',
  planet: 'planet',
  star: 'star',
  flash: 'flash',
};

export function FeaturesBlockView({ block, skin, onCta }: Props) {
  const { isMobile, isTablet } = useMarketingBreakpoint();
  const items = block.items ?? [];
  const cols = isMobile ? 1 : isTablet ? 2 : Math.min(block.columns ?? 4, 4);
  const compact = block.variant === 'compact';
  const [contentHeights, setContentHeights] = useState<Record<string, number>>({});
  const equalHeight =
    cols > 1 ? Math.max(0, ...items.map((item, idx) => contentHeights[item.id ?? idx] ?? 0)) : 0;

  const onContentLayout = (key: string | number, height: number) => {
    setContentHeights((prev) =>
      Math.abs((prev[key] ?? 0) - height) < 1 ? prev : { ...prev, [key]: height },
    );
  };

  return (
    <MarketingSection skin={skin}>
      <MarketingPanel skin={skin}>
        <SectionHeader skin={skin} title={block.title} description={block.description} />
        <View style={[styles.grid, { gap: compact ? 12 : 16 }]}>{items.map((item, idx) => {
          const accent = item.accentColor || FEATURE_ACCENTS[idx % FEATURE_ACCENTS.length];
          const iconName = ICONS[item.meta || ''] || 'sparkles';
          const key = item.id ?? idx;
          const card = (
            <MarketingCard skin={skin} style={[styles.card, compact && styles.cardCompact]}>
              {/* Outer box holds the shared height; inner one is measured at its natural size. */}
              <View style={{ minHeight: equalHeight }}>
                <View
                  style={styles.content}
                  onLayout={(event) => onContentLayout(key, event.nativeEvent.layout.height)}>
                  <View style={[styles.iconWrap, { backgroundColor: `${accent}22` }]}>
                    <Ionicons name={iconName} size={22} color={accent} />
                  </View>
                  <Text style={[MarketingType.label, { color: skin.text, fontSize: 17 }]}>
                    {item.title || `Преимущество ${idx + 1}`}
                  </Text>
                  {item.description ? (
                    <Text style={[MarketingType.body, { color: skin.textSecondary }]}>
                      {item.description}
                    </Text>
                  ) : null}
                </View>
              </View>
            </MarketingCard>
          );
          return (
            <LandingStaggerItem
              key={key}
              index={idx}
              style={{
                flexGrow: 1,
                flexBasis: cols === 1 ? '100%' : cols === 2 ? '46%' : '22%',
                minWidth: cols === 1 ? '100%' : 160,
                maxWidth: cols === 1 ? '100%' : undefined,
              }}>
              {item.url ? (
                <Pressable style={styles.fill} onPress={() => onCta(item.url!, `${block.id}:f:${idx}`)}>
                  {card}
                </Pressable>
              ) : (
                card
              )}
            </LandingStaggerItem>
          );
        })}</View>
      </MarketingPanel>
    </MarketingSection>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  fill: {
    flex: 1,
  },
  card: {
    flex: 1,
    padding: 20,
    minHeight: 172,
  },
  content: {
    gap: 12,
  },
  cardCompact: {
    minHeight: 0,
    padding: 16,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
