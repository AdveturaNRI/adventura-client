import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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

const COLLAPSED_LINES = 6;
/** Web can't measure clamped text reliably, so length decides when to offer «Читать далее». */
const LONG_REVIEW_CHARS = 240;
const LONG_REVIEW_BREAKS = 3;

function isLongReview(text: string): boolean {
  return text.length > LONG_REVIEW_CHARS || text.split('\n').length > LONG_REVIEW_BREAKS;
}

function ReviewText({ text, skin }: { text: string; skin: ResolvedMarketingSkin }) {
  const [expanded, setExpanded] = useState(false);
  const collapsible = isLongReview(text);

  return (
    <View style={styles.review}>
      <Text
        numberOfLines={collapsible && !expanded ? COLLAPSED_LINES : undefined}
        style={[MarketingType.body, { color: skin.textSecondary, fontStyle: 'italic' }]}>
        «{text}»
      </Text>
      {collapsible ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setExpanded((prev) => !prev)}
          hitSlop={8}
          style={({ pressed }) => [styles.more, pressed && styles.morePressed]}>
          <Text style={[MarketingType.label, { color: skin.accentColor }]}>
            {expanded ? 'Свернуть' : 'Читать далее'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function TestimonialsBlockView({ block, skin }: Props) {
  const { isMobile } = useMarketingBreakpoint();
  const items = block.items ?? [];

  return (
    <MarketingSection skin={skin}>
      <MarketingPanel skin={skin}>
        <SectionHeader skin={skin} title={block.title} description={block.description} />
        <View style={[styles.grid, isMobile && styles.col]}>{items.map((item, idx) => (
          <LandingStaggerItem
            key={item.id ?? idx}
            index={idx}
            style={{ flex: 1, minWidth: isMobile ? '100%' : 240, width: isMobile ? '100%' : undefined }}>
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
              {item.description ? <ReviewText text={item.description} skin={skin} /> : null}
            </MarketingCard>
          </LandingStaggerItem>
        ))}</View>
      </MarketingPanel>
    </MarketingSection>
  );
}

const styles = StyleSheet.create({
  // flex-start: opening one review must not stretch its neighbours in the row.
  grid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 14 },
  col: { flexDirection: 'column' },
  card: { padding: 20, gap: 14, minHeight: 176 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  review: { gap: 8 },
  more: { alignSelf: 'flex-start' },
  morePressed: { opacity: 0.7 },
});
