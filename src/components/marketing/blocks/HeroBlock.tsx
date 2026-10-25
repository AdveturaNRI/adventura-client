import { useId } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import {
  CoverImage,
  MarketingButton,
  MarketingPanel,
  MarketingSection,
  useMarketingBreakpoint,
} from '@/components/marketing/shared';
import {
  MarketingLayout,
  MarketingType,
  onDarkScrimSkin,
  type ResolvedMarketingSkin,
} from '@/components/marketing/theme';
import type { HeroBlock } from '@/components/marketing/types';

type Props = {
  block: HeroBlock;
  skin: ResolvedMarketingSkin;
  onCta: (url: string, key: string) => void;
};

/** Melts the cover image into the page so the next block doesn't start on a hard edge. */
function BottomFade({ color }: { color: string }) {
  const gradientId = `hero-fade-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <View pointerEvents="none" style={styles.fade}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0} />
            <Stop offset="0.6" stopColor={color} stopOpacity={0.7} />
            <Stop offset="1" stopColor={color} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
      </Svg>
    </View>
  );
}

export function HeroBlockView({ block, skin: pageSkin, onCta }: Props) {
  const { isMobile } = useMarketingBreakpoint();
  const key = block.id ?? 'hero';
  const position = block.imagePosition ?? 'right';
  const bgImage = position === 'background' ? block.imageUrl : undefined;
  const skin = bgImage ? onDarkScrimSkin(pageSkin) : pageSkin;
  const sideImage = position !== 'background' ? block.imageUrl : undefined;
  const centerAlign = position === 'center' || isMobile;
  // A dark cover fades nicely into the dark page; on a light page the fade
  // turns muddy, so there the cover becomes a card like the other blocks.
  const contained = Boolean(bgImage) && pageSkin.mode === 'light';
  const fadeIntoPage = Boolean(bgImage) && !contained;

  const hero = (
    <View
      style={[
        styles.wrap,
        isMobile && styles.wrapMobile,
        contained && styles.wrapContained,
        contained && isMobile && styles.wrapContainedMobile,
      ]}>
      {bgImage ? <CoverImage uri={bgImage} style={StyleSheet.absoluteFillObject} priority /> : null}
      <View
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: bgImage ? 'rgba(11,17,27,0.78)' : skin.pageBackground },
        ]}
      />
      {fadeIntoPage ? <BottomFade color={pageSkin.pageBackground} /> : null}
      {!bgImage ? (
        <>
          <View
            style={[
              styles.blob,
              styles.blobPurple,
              isMobile && styles.blobMobile,
              { backgroundColor: skin.colors.glowPurple },
            ]}
          />
          <View
            style={[
              styles.blob,
              styles.blobBlue,
              isMobile && styles.blobMobile,
              { backgroundColor: skin.colors.glowBlue },
            ]}
          />
        </>
      ) : null}

      <MarketingSection skin={skin} style={[styles.sectionPad, isMobile && styles.sectionPadMobile]}>
        <MarketingPanel
          skin={skin}
          style={[
            styles.heroPanel,
            { backgroundColor: skin.heroPanel },
            isMobile && styles.heroPanelMobile,
            bgImage && styles.heroPanelImage,
          ]}>
          <View
            style={[
              styles.row,
              isMobile && styles.rowMobile,
              position === 'center' && styles.rowCenter,
            ]}>
            <View
              style={[
                styles.copy,
                centerAlign && styles.copyCenter,
                isMobile && styles.copyMobile,
              ]}>
              {block.eyebrow ? (
                <Text style={[MarketingType.caption, { color: skin.accentColor, marginBottom: 10 }]}>
                  {block.eyebrow}
                </Text>
              ) : null}
              <Text
                style={[
                  isMobile ? MarketingType.heroMobile : MarketingType.hero,
                  { color: skin.text, textAlign: centerAlign ? 'center' : 'left' },
                ]}>
                {block.title || 'Adventura'}
              </Text>
              {block.description ? (
                <Text
                  style={[
                    isMobile ? MarketingType.body : MarketingType.bodyLg,
                    {
                      color: skin.textSecondary,
                      marginTop: 14,
                      textAlign: centerAlign ? 'center' : 'left',
                    },
                  ]}>
                  {block.description}
                </Text>
              ) : null}
              <View style={[styles.ctaRow, centerAlign && styles.ctaCenter]}>
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
                      textAlign: centerAlign ? 'center' : 'left',
                    },
                  ]}>
                  {block.trustText}
                </Text>
              ) : null}
            </View>

            {sideImage ? (
              <View style={isMobile ? styles.mediaMobile : styles.media}>
                {!isMobile ? (
                  <View style={[styles.glow, { backgroundColor: skin.colors.glowPurple }]} />
                ) : null}
                <CoverImage
                  uri={sideImage}
                  style={isMobile ? styles.phoneMobile : styles.phone}
                  fit="cover"
                  priority
                />
              </View>
            ) : null}
          </View>
        </MarketingPanel>
      </MarketingSection>
    </View>
  );

  if (!contained) return hero;

  return (
    <View
      style={[
        styles.containedOuter,
        {
          paddingHorizontal: isMobile ? 16 : MarketingLayout.gutter,
          paddingVertical: isMobile ? MarketingLayout.sectionYMobile : MarketingLayout.sectionY,
        },
      ]}>
      {hero}
    </View>
  );
}

const styles = StyleSheet.create({
  containedOuter: { width: '100%', alignItems: 'center' },
  wrapContained: {
    maxWidth: MarketingLayout.maxWidth,
    borderRadius: MarketingLayout.radius,
    marginBottom: 0,
  },
  wrapContainedMobile: {
    borderRadius: MarketingLayout.radiusSm,
    marginBottom: 0,
  },
  // Full-bleed, so it adds the half-gap a panel section would have.
  wrap: {
    width: '100%',
    minHeight: MarketingLayout.heroMinHeight * 0.75,
    position: 'relative',
    overflow: 'hidden',
    marginBottom: MarketingLayout.sectionY,
  },
  wrapMobile: {
    minHeight: 0,
    marginBottom: MarketingLayout.sectionYMobile,
  },
  sectionPad: {
    minHeight: MarketingLayout.heroMinHeight * 0.75,
    justifyContent: 'center',
  },
  sectionPadMobile: {
    minHeight: 0,
  },
  heroPanel: {
    paddingVertical: 40,
    paddingHorizontal: 40,
  },
  heroPanelMobile: {
    paddingVertical: 22,
    paddingHorizontal: 16,
  },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '40%',
  },
  heroPanelImage: { backgroundColor: 'rgba(11,17,27,0.52)', borderWidth: 0 },
  blob: { position: 'absolute', width: 360, height: 360, borderRadius: 999, opacity: 0.35 },
  blobMobile: { width: 220, height: 220, opacity: 0.22 },
  blobPurple: { top: -80, right: -40 },
  blobBlue: { bottom: -100, left: -60 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 32 },
  rowMobile: { flexDirection: 'column', alignItems: 'stretch', gap: 20 },
  rowCenter: { justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0, maxWidth: 560 },
  copyCenter: { maxWidth: 720, alignItems: 'center' },
  copyMobile: { maxWidth: '100%', width: '100%' },
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
    overflow: 'hidden',
  },
  mediaMobile: {
    width: '100%',
    height: 260,
    position: 'relative',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    alignSelf: 'stretch',
    overflow: 'hidden',
    borderRadius: MarketingLayout.radiusSm,
  },
  glow: { position: 'absolute', width: '80%', height: '80%', borderRadius: 999, opacity: 0.55 },
  phone: {
    width: '86%',
    aspectRatio: 0.72,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  phoneMobile: {
    width: '100%',
    height: 260,
    borderRadius: MarketingLayout.radiusSm,
  },
});
