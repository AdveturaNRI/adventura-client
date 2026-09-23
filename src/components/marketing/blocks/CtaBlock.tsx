import { StyleSheet, Text, View } from 'react-native';

import {
  CoverImage,
  MarketingButton,
  MarketingSection,
  useMarketingBreakpoint,
} from '@/components/marketing/shared';
import { MarketingLayout, MarketingType, type ResolvedMarketingSkin } from '@/components/marketing/theme';
import type { CtaBlock } from '@/components/marketing/types';

type Props = {
  block: CtaBlock;
  skin: ResolvedMarketingSkin;
  onCta: (url: string, key: string) => void;
};

export function CtaBlockView({ block, skin, onCta }: Props) {
  const { isMobile } = useMarketingBreakpoint();
  const key = block.id ?? 'cta';
  return (
    <MarketingSection skin={skin}>
      <View
        style={[
          styles.banner,
          isMobile && styles.bannerMobile,
          { borderColor: skin.border },
        ]}>
        {block.imageUrl ? (
          <CoverImage uri={block.imageUrl} style={StyleSheet.absoluteFillObject} />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: skin.surfaceElevated }]} />
        )}
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(11,17,27,0.72)' }]} />
        <View style={[styles.content, isMobile && styles.contentMobile]}>
          <Text
            style={[
              isMobile ? MarketingType.sectionMobile : MarketingType.section,
              { color: skin.text, textAlign: 'center' },
            ]}>
            {block.title || 'Готов к новым приключениям?'}
          </Text>
          {block.description ? (
            <Text
              style={[
                isMobile ? MarketingType.body : MarketingType.bodyLg,
                {
                  color: skin.textSecondary,
                  textAlign: 'center',
                  marginTop: 10,
                  maxWidth: 640,
                },
              ]}>
              {block.description}
            </Text>
          ) : null}
          <View style={styles.actions}>
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
        </View>
      </View>
    </MarketingSection>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: 28,
    overflow: 'hidden',
    minHeight: 280,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  bannerMobile: {
    borderRadius: MarketingLayout.radiusSm,
    minHeight: 0,
  },
  content: {
    paddingVertical: 48,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 8,
  },
  contentMobile: {
    paddingVertical: 28,
    paddingHorizontal: 16,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 18,
    justifyContent: 'center',
  },
});
