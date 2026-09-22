import { StyleSheet, Text, View } from 'react-native';

import {
  CoverImage,
  MarketingButton,
  MarketingPanel,
  MarketingSection,
  useMarketingBreakpoint,
} from '@/components/marketing/shared';
import { MarketingLayout, MarketingType, type ResolvedMarketingSkin } from '@/components/marketing/theme';
import type { HeroBlock } from '@/components/marketing/types';

type Props = {
  block: HeroBlock;
  skin: ResolvedMarketingSkin;
  onCta: (url: string, key: string) => void;
};

export function HeroBlockView({ block, skin, onCta }: Props) {
  const { isMobile } = useMarketingBreakpoint();
  const key = block.id ?? 'hero';
  const position = block.imagePosition ?? 'right';
  const bgImage = position === 'background' ? block.imageUrl : undefined;
  const sideImage = position !== 'background' ? block.imageUrl : undefined;

  return (
    <View style={styles.wrap}>
      {bgImage ? <CoverImage uri={bgImage} style={StyleSheet.absoluteFillObject} priority /> : null}
      <View
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: bgImage ? 'rgba(11,17,27,0.78)' : skin.pageBackground },
        ]}
      />
      {!bgImage ? (
        <>
          <View style={[styles.blob, styles.blobPurple, { backgroundColor: skin.colors.glowPurple }]} />
          <View style={[styles.blob, styles.blobBlue, { backgroundColor: skin.colors.glowBlue }]} />
        </>
      ) : null}

      <MarketingSection skin={skin} style={styles.sectionPad}>
        <MarketingPanel skin={skin} style={[styles.heroPanel, bgImage && styles.heroPanelImage]}>
          <View
          style={[
            styles.row,
            isMobile && styles.rowMobile,
            position === 'center' && styles.rowCenter,
          ]}>
          <View
            style={[
              styles.copy,
              position === 'center' && styles.copyCenter,
              isMobile && { maxWidth: '100%' },
            ]}>
            {block.eyebrow ? (
              <Text style={[MarketingType.caption, { color: skin.accentColor, marginBottom: 10 }]}>
                {block.eyebrow}
              </Text>
            ) : null}
            <Text
              style={[
                isMobile ? MarketingType.heroMobile : MarketingType.hero,
                { color: skin.text, textAlign: position === 'center' ? 'center' : 'left' },
              ]}>
              {block.title || 'Adventura'}
            </Text>
            {block.description ? (
              <Text
                style={[
                  MarketingType.bodyLg,
                  {
                    color: skin.textSecondary,
                    marginTop: 14,
                    textAlign: position === 'center' ? 'center' : 'left',
                  },
                ]}>
                {block.description}
              </Text>
            ) : null}
            <View style={[styles.ctaRow, position === 'center' && styles.ctaCenter]}>
              {block.ctaLabel && block.ctaUrl ? (
                <MarketingButton
                  skin={skin}
                  label={block.ctaLabel}
                  onPress={() => onCta(block.ctaUrl!, key)}
                />
              ) : null}
              {block.secondaryCtaLabel && block.secondaryCtaUrl ? (
                <MarketingButton
                  skin={skin}
                  label={block.secondaryCtaLabel}
                  variant="secondary"
                  onPress={() => onCta(block.secondaryCtaUrl!, `${key}:sec`)}
                />
              ) : null}
            </View>
            {block.trustText ? (
              <Text
                style={[
                  MarketingType.caption,
                  {
                    color: skin.textSecondary,
                    marginTop: 20,
                    textAlign: position === 'center' ? 'center' : 'left',
                  },
                ]}>
                {block.trustText}
              </Text>
            ) : null}
          </View>

            {sideImage && position !== 'center' ? (
            <View style={[styles.media, isMobile && styles.mediaMobile]}>
              <View style={[styles.glow, { backgroundColor: skin.colors.glowPurple }]} />
              <CoverImage uri={sideImage} style={styles.phone} priority />
            </View>
            ) : null}
          </View>
        </MarketingPanel>
      </MarketingSection>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    minHeight: MarketingLayout.heroMinHeight * 0.75,
    position: 'relative',
    overflow: 'hidden',
  },
  sectionPad: {
    minHeight: MarketingLayout.heroMinHeight * 0.75,
    justifyContent: 'center',
  },
  heroPanel: {
    backgroundColor: 'rgba(13, 23, 37, 0.78)',
    paddingVertical: 40,
    paddingHorizontal: 40,
  },
  heroPanelImage: { backgroundColor: 'rgba(11,17,27,0.52)' },
  blob: { position: 'absolute', width: 360, height: 360, borderRadius: 999, opacity: 0.35 },
  blobPurple: { top: -80, right: -40 },
  blobBlue: { bottom: -100, left: -60 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 32 },
  rowMobile: { flexDirection: 'column', alignItems: 'stretch' },
  rowCenter: { justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0, maxWidth: 560 },
  copyCenter: { maxWidth: 720, alignItems: 'center' },
  ctaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 24 },
  ctaCenter: { justifyContent: 'center' },
  media: {
    flex: 1,
    minWidth: 240,
    maxWidth: 420,
    aspectRatio: 0.72,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaMobile: { maxWidth: '100%', width: '100%', aspectRatio: 1.1, maxHeight: 360 },
  glow: { position: 'absolute', width: '80%', height: '80%', borderRadius: 999, opacity: 0.55 },
  phone: {
    width: '86%',
    height: '92%',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
});
