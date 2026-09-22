import { Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

import { LandingBlockReveal, motionPresetForBlock } from '@/components/marketing/LandingBlockReveal';
import { AppShowcaseBlockView } from '@/components/marketing/blocks/AppShowcaseBlock';
import { ClubsBlockView } from '@/components/marketing/blocks/ClubsBlock';
import { ContactBlockView } from '@/components/marketing/blocks/ContactBlock';
import { CtaBlockView } from '@/components/marketing/blocks/CtaBlock';
import { FaqBlockView } from '@/components/marketing/blocks/FaqBlock';
import { FeaturesBlockView } from '@/components/marketing/blocks/FeaturesBlock';
import { FooterBlockView } from '@/components/marketing/blocks/FooterBlock';
import { GamesBlockView } from '@/components/marketing/blocks/GamesBlock';
import { HeroBlockView } from '@/components/marketing/blocks/HeroBlock';
import { StatsBlockView } from '@/components/marketing/blocks/StatsBlock';
import { StepsBlockView } from '@/components/marketing/blocks/StepsBlock';
import { TestimonialsBlockView } from '@/components/marketing/blocks/TestimonialsBlock';
import { CoverImage, MarketingPanel, MarketingSection } from '@/components/marketing/shared';
import {
  MarketingType,
  resolveMarketingSkin,
  type ResolvedMarketingSkin,
} from '@/components/marketing/theme';
import type {
  MarketingClubCard,
  MarketingGameCard,
  MarketingLandingBlock,
} from '@/components/marketing/types';
import type { MarketingLandingThemeConfig } from '@/services/marketing/landings';

export type LandingRendererProps = {
  theme?: (MarketingLandingThemeConfig & { skin?: 'fantasy' | 'app' }) | null;
  blocks: MarketingLandingBlock[];
  games?: MarketingGameCard[] | null;
  clubs?: MarketingClubCard[] | null;
  feedsLoading?: boolean;
  onCta: (url: string, blockKey: string) => void;
  onOpenGame: (id: string) => void;
  onOpenClub: (id: string) => void;
};

function QuoteOrMedia({
  block,
  skin,
}: {
  block: Extract<MarketingLandingBlock, { type: 'quote' | 'media' }>;
  skin: ResolvedMarketingSkin;
}) {
  if (block.type === 'quote') {
    return (
      <MarketingSection skin={skin}>
        <MarketingPanel skin={skin} style={{ backgroundColor: skin.surfaceElevated }}>
          <Text style={[MarketingType.sectionMobile, { color: skin.text }]}>
            «{block.description || block.title || ''}»
          </Text>
          {block.author ? (
            <Text style={[MarketingType.label, { color: skin.accentColor, marginTop: 14 }]}>
              — {block.author}
            </Text>
          ) : null}
        </MarketingPanel>
      </MarketingSection>
    );
  }
  return (
      <MarketingSection skin={skin}>
      <MarketingPanel skin={skin} style={{ padding: 16 }}>
        {block.title ? (
          <Text style={[MarketingType.label, { color: skin.text, marginBottom: 10 }]}>{block.title}</Text>
        ) : null}
        {block.description ? (
          <Text style={[MarketingType.body, { color: skin.textSecondary, marginBottom: 10 }]}>
            {block.description}
          </Text>
        ) : null}
        {block.imageUrl ? (
          <CoverImage
            uri={block.imageUrl}
            style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 16 }}
          />
        ) : null}
      </MarketingPanel>
    </MarketingSection>
  );
}

export function LandingRenderer({
  theme,
  blocks,
  games = null,
  clubs = null,
  feedsLoading = false,
  onCta,
  onOpenGame,
  onOpenClub,
}: LandingRendererProps) {
  const skin = resolveMarketingSkin(theme);
  const hasFixedBackground = Boolean(skin.pageBackgroundImage);
  const backgroundLayerStyle: ViewStyle =
    Platform.OS === 'web'
      ? ({
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
        } as unknown as ViewStyle)
      : StyleSheet.absoluteFillObject;

  return (
    <View style={[styles.page, { backgroundColor: skin.pageBackground }]}>
      {hasFixedBackground ? (
        <View pointerEvents="none" style={[styles.backgroundLayer, backgroundLayerStyle]}>
          <CoverImage uri={skin.pageBackgroundImage} style={StyleSheet.absoluteFillObject} priority />
          <View
            style={[
              StyleSheet.absoluteFillObject,
              { backgroundColor: skin.mode === 'dark' ? 'rgba(7, 13, 24, 0.80)' : 'rgba(255,255,255,0.78)' },
            ]}
          />
        </View>
      ) : null}
      <View style={styles.content}>
        {blocks
        .filter((b) => b && !b.hidden)
        .map((block, index) => {
          const key = block.id ?? `${block.type}:${index}`;
          const reveal = (node: ReactNode) => (
            <LandingBlockReveal
              key={key}
              preset={motionPresetForBlock(block.type)}
              index={index}
              eager={index === 0 || block.type === 'hero'}>
              {node}
            </LandingBlockReveal>
          );

          switch (block.type) {
            case 'hero':
              return reveal(<HeroBlockView block={block} skin={skin} onCta={onCta} />);
            case 'features':
              return reveal(<FeaturesBlockView block={block} skin={skin} onCta={onCta} />);
            case 'appShowcase':
              return reveal(<AppShowcaseBlockView block={block} skin={skin} onCta={onCta} />);
            case 'steps':
              return reveal(<StepsBlockView block={block} skin={skin} />);
            case 'gameFeed':
              return reveal(
                <GamesBlockView
                  block={block}
                  skin={skin}
                  games={games}
                  loading={feedsLoading}
                  onCta={onCta}
                  onOpenGame={onOpenGame}
                />,
              );
            case 'testimonials':
              return reveal(<TestimonialsBlockView block={block} skin={skin} />);
            case 'clubFeed':
              return reveal(
                <ClubsBlockView
                  block={block}
                  skin={skin}
                  clubs={clubs}
                  loading={feedsLoading}
                  onCta={onCta}
                  onOpenClub={onOpenClub}
                />,
              );
            case 'cta':
              return reveal(<CtaBlockView block={block} skin={skin} onCta={onCta} />);
            case 'faq':
              return reveal(<FaqBlockView block={block} skin={skin} />);
            case 'stats':
              return reveal(<StatsBlockView block={block} skin={skin} />);
            case 'contact':
              return reveal(<ContactBlockView block={block} skin={skin} onCta={onCta} />);
            case 'footer':
              return reveal(<FooterBlockView block={block} skin={skin} onCta={onCta} />);
            case 'quote':
            case 'media':
              return reveal(<QuoteOrMedia block={block} skin={skin} />);
            default:
              return null;
          }
        })}
      </View>
    </View>
  );
}

export { resolveMarketingSkin } from '@/components/marketing/theme';
export { BLOCK_REGISTRY, createDefaultBlock } from '@/components/marketing/registry';

const styles = StyleSheet.create({
  page: {
    width: '100%',
    minHeight: '100%',
    alignSelf: 'stretch',
    position: 'relative',
  },
  backgroundLayer: {
    zIndex: 0,
  },
  content: {
    width: '100%',
    zIndex: 1,
  },
});
