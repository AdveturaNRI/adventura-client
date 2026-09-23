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
  const shots = [block.imageUrl, block.imageUrlSecondary].filter(
    (uri): uri is string => Boolean(uri?.trim()),
  );
  const dual = shots.length > 1;

  const text = (
    <View style={[styles.copy, isMobile && styles.copyMobile]}>
      <Text
        style={[
          isMobile ? MarketingType.sectionMobile : MarketingType.section,
          { color: skin.text },
        ]}>
        {block.title || 'Всё, что ты любишь — в одном месте'}
      </Text>
      {block.description ? (
        <Text
          style={[
            isMobile ? MarketingType.body : MarketingType.bodyLg,
            { color: skin.textSecondary, marginTop: 12 },
          ]}>
          {block.description}
        </Text>
      ) : null}
      {block.ctaLabel && block.ctaUrl ? (
        <View style={{ marginTop: 22 }}>
          <MarketingButton
            skin={skin}
            label={block.ctaLabel}
            onPress={() => onCta(block.ctaUrl!, key)}
          />
        </View>
      ) : null}
    </View>
  );

  const media = (
    <View
      style={[
        isMobile
          ? dual
            ? styles.mediaMobileDual
            : styles.mediaMobileSolo
          : [styles.media, dual ? styles.mediaDual : styles.mediaSolo],
      ]}>
      {!isMobile ? (
        <View style={[styles.glow, { backgroundColor: skin.colors.glowBlue }]} />
      ) : null}
      {shots.length === 0 ? (
        <View
          style={[
            isMobile ? styles.shotMobile : styles.shot,
            isMobile ? dual && styles.shotMobileDual : dual ? styles.shotDual : styles.shotSolo,
            styles.placeholder,
          ]}
        />
      ) : (
        shots.map((uri, index) => (
          <CoverImage
            key={`${uri}:${index}`}
            uri={uri}
            style={[
              isMobile ? styles.shotMobile : styles.shot,
              isMobile ? dual && styles.shotMobileDual : dual ? styles.shotDual : styles.shotSolo,
            ]}
            fit="cover"
          />
        ))
      )}
    </View>
  );

  return (
    <MarketingSection skin={skin}>
      <MarketingPanel skin={skin} style={[styles.panel, isMobile && styles.panelMobile]}>
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
  panelMobile: { paddingVertical: 20 },
  rowMobile: { flexDirection: 'column', alignItems: 'stretch', gap: 20 },
  rowReverse: { flexDirection: 'row-reverse' },
  copy: { flex: 1, minWidth: 0, maxWidth: 520 },
  copyMobile: { maxWidth: '100%', width: '100%' },
  media: {
    flex: 1,
    minWidth: 0,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaMobileSolo: {
    width: '100%',
    height: 220,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 16,
  },
  mediaMobileDual: {
    width: '100%',
    height: 280,
    flexDirection: 'row',
    gap: 12,
    overflow: 'hidden',
    borderRadius: 16,
  },
  mediaSolo: {
    minHeight: 280,
  },
  mediaDual: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    minHeight: 0,
  },
  glow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 999,
    opacity: 0.45,
    zIndex: 0,
  },
  shot: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    zIndex: 1,
  },
  shotSolo: {
    width: '72%',
    maxWidth: 280,
    aspectRatio: 0.55,
  },
  shotMobile: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  shotMobileDual: {
    flex: 1,
    width: undefined,
    height: 280,
  },
  shotDual: {
    flex: 1,
    minWidth: 0,
    aspectRatio: 0.55,
  },
  placeholder: { backgroundColor: 'rgba(255,255,255,0.06)' },
});
