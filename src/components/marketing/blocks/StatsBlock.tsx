import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { LandingStaggerItem } from '@/components/marketing/LandingBlockReveal';
import {
  MarketingSection,
  MarketingPanel,
  SectionHeader,
  useMarketingBreakpoint,
} from '@/components/marketing/shared';
import { FEATURE_ACCENTS, MarketingType, type ResolvedMarketingSkin } from '@/components/marketing/theme';
import type { StatsBlock } from '@/components/marketing/types';

type Props = {
  block: StatsBlock;
  skin: ResolvedMarketingSkin;
};

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  people: 'people',
  game: 'game-controller',
  home: 'home',
  star: 'star',
};

export function StatsBlockView({ block, skin }: Props) {
  const { isMobile } = useMarketingBreakpoint();
  const items = (block.items ?? []).filter((item) => {
    if (block.source === 'api') {
      const v = (item.title || '').trim();
      return v && v !== '—' && v !== '-';
    }
    return true;
  });

  return (
    <MarketingSection skin={skin}>
      <MarketingPanel skin={skin}>
        <SectionHeader skin={skin} title={block.title} description={block.description} />
        <View style={[styles.row, isMobile && styles.wrap]}>
        {items.map((item, idx) => {
          const accent = item.accentColor || FEATURE_ACCENTS[idx % FEATURE_ACCENTS.length];
          const iconName = ICONS[item.meta || ''] || 'ellipse';
          return (
            <LandingStaggerItem
              key={item.id ?? idx}
              index={idx}
              style={[styles.item, { backgroundColor: skin.surfaceElevated, borderColor: skin.border }, isMobile && styles.itemMobile]}>
              <View style={[styles.icon, { backgroundColor: `${accent}22` }]}>
                <Ionicons name={iconName} size={22} color={accent} />
              </View>
              <Text style={[MarketingType.stat, { color: skin.text, marginTop: 14 }]}>
                {item.title || '—'}
              </Text>
              {item.description ? (
                <Text style={[MarketingType.caption, { color: skin.textSecondary, marginTop: 6 }]}>
                  {item.description}
                </Text>
              ) : null}
            </LandingStaggerItem>
          );
        })}
        </View>
      </MarketingPanel>
    </MarketingSection>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  wrap: { flexWrap: 'wrap' },
  item: { flex: 1, alignItems: 'center', minWidth: 120, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 18 },
  itemMobile: { flexBasis: '45%', flexGrow: 1 },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
