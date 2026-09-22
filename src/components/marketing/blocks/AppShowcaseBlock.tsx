import { StyleSheet, Text, View } from 'react-native';

import {
  CoverImage,
  MarketingButton,
  MarketingPanel,
  MarketingSection,
  useMarketingBreakpoint,
} from '@/components/marketing/shared';
import { MarketingType, type ResolvedMarketingSkin } from '@/components/marketing/theme';
import type { AppShowcaseBlock } from '@/components/marketing/types';

type Props = {
  block: AppShowcaseBlock;
  skin: ResolvedMarketingSkin;
  onCta: (url: string, key: string) => void;
};

export function AppShowcaseBlockView({ block, skin, onCta }: Props) {
  const { isMobile } = useMarketingBreakpoint();
  const side = block.imageSide === 'left' ? 'left' : 'right';
  const key = block.id ?? 'showcase';
  const text = (
    <View style={[styles.copy, isMobile && { maxWidth: '100%' }]}>
      <Text style={[isMobile ? MarketingType.sectionMobile : MarketingType.section, { color: skin.text }]}>
        {block.title || 'Всё, что ты любишь — в одном месте'}
      </Text>
      {block.description ? (
        <Text style={[MarketingType.bodyLg, { color: skin.textSecondary, marginTop: 12 }]}>
          {block.description}
        </Text>
      ) : null}
      {block.ctaLabel && block.ctaUrl ? (
        <View style={{ marginTop: 22 }}>
          <MarketingButton skin={skin} label={block.ctaLabel} onPress={() => onCta(block.ctaUrl!, key)} />
        </View>
      ) : null}
    </View>
  );

  const media = (
    <View style={[styles.media, isMobile && styles.mediaMobile]}>
      <View style={[styles.glow, { backgroundColor: skin.colors.glowBlue }]} />
      {block.imageUrl ? (
        <CoverImage uri={block.imageUrl} style={[styles.shot, styles.shotMain]} />
      ) : (
        <View style={[styles.shot, styles.shotMain, styles.placeholder]} />
      )}
      {block.imageUrlSecondary ? (
        <CoverImage uri={block.imageUrlSecondary} style={[styles.shot, styles.shotSecondary]} />
      ) : null}
    </View>
  );

  return (
    <MarketingSection skin={skin}>
      <MarketingPanel skin={skin} style={styles.panel}>
        <View
        style={[
          styles.row,
          isMobile && styles.rowMobile,
          !isMobile && side === 'left' ? styles.rowReverse : null,
        ]}>
        {text}
          {media}
        </View>
      </MarketingPanel>
    </MarketingSection>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 28 },
  panel: { paddingVertical: 34 },
  rowMobile: { flexDirection: 'column' },
  rowReverse: { flexDirection: 'row-reverse' },
  copy: { flex: 1, minWidth: 0, maxWidth: 520 },
  media: {
    flex: 1,
    minHeight: 320,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaMobile: { width: '100%', minHeight: 280 },
  glow: { position: 'absolute', width: 220, height: 220, borderRadius: 999, opacity: 0.5 },
  shot: { borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  shotMain: { width: '70%', aspectRatio: 0.55, zIndex: 2 },
  shotSecondary: {
    position: 'absolute',
    width: '48%',
    aspectRatio: 0.55,
    right: 8,
    bottom: 12,
    zIndex: 1,
    opacity: 0.95,
  },
  placeholder: { backgroundColor: 'rgba(255,255,255,0.06)' },
});
