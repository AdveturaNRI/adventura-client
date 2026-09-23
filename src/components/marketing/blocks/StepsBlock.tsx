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
import type { StepsBlock } from '@/components/marketing/types';

type Props = {
  block: StepsBlock;
  skin: ResolvedMarketingSkin;
};

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  person: 'person',
  search: 'search',
  hand: 'thumbs-up',
  game: 'game-controller',
};

export function StepsBlockView({ block, skin }: Props) {
  const { isMobile } = useMarketingBreakpoint();
  const items = block.items ?? [];

  return (
    <MarketingSection skin={skin}>
      <MarketingPanel skin={skin}>
        <SectionHeader skin={skin} title={block.title} description={block.description} />
        <View style={[styles.row, isMobile && styles.col]}>{items.map((item, idx) => {
          const accent = FEATURE_ACCENTS[idx % FEATURE_ACCENTS.length];
          const iconName = ICONS[item.meta || ''] || 'ellipse';
          return (
            <LandingStaggerItem
              key={item.id ?? idx}
              index={idx}
              style={[styles.step, isMobile && styles.stepMobile]}>
              {!isMobile && idx < items.length - 1 ? (
                <View style={[styles.connector, { backgroundColor: skin.border }]} />
              ) : null}
              <View style={[styles.badge, { backgroundColor: `${accent}33`, borderColor: accent }]}>
                <Ionicons name={iconName} size={22} color={accent} />
              </View>
              <Text style={[MarketingType.caption, { color: accent, marginTop: 12 }]}>
                Шаг {idx + 1}
              </Text>
              <Text style={[MarketingType.label, { color: skin.text, marginTop: 6, textAlign: 'center' }]}>
                {item.title || `Шаг ${idx + 1}`}
              </Text>
              {item.description ? (
                <Text
                  style={[
                    MarketingType.body,
                    { color: skin.textSecondary, marginTop: 6, textAlign: 'center' },
                  ]}>
                  {item.description}
                </Text>
              ) : null}
            </LandingStaggerItem>
          );
        })}</View>
      </MarketingPanel>
    </MarketingSection>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  col: { flexDirection: 'column', gap: 20 },
  step: { flex: 1, alignItems: 'center', position: 'relative', paddingHorizontal: 8, minWidth: 132 },
  stepMobile: { flexDirection: 'column', alignItems: 'center' },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  connector: {
    position: 'absolute',
    top: 32,
    left: '60%',
    right: '-40%',
    height: 2,
    zIndex: 0,
  },
});
