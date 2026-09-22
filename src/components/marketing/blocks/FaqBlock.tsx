import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MarketingPanel, MarketingSection, SectionHeader } from '@/components/marketing/shared';
import { MarketingType, type ResolvedMarketingSkin } from '@/components/marketing/theme';
import type { FaqBlock } from '@/components/marketing/types';

type Props = {
  block: FaqBlock;
  skin: ResolvedMarketingSkin;
};

export function FaqBlockView({ block, skin }: Props) {
  const items = block.items ?? [];
  const [open, setOpen] = useState<number | null>(0);

  return (
    <MarketingSection skin={skin}>
      <MarketingPanel skin={skin}>
        <SectionHeader skin={skin} title={block.title} description={block.description} align="left" />
        <View style={[styles.list, { borderColor: skin.border, backgroundColor: skin.surfaceElevated }]}>
        {items.map((item, idx) => {
          const isOpen = open === idx;
          return (
            <View key={item.id ?? idx} style={[styles.row, { borderColor: skin.border }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: isOpen }}
                onPress={() => setOpen(isOpen ? null : idx)}
                style={styles.question}>
                <Text style={[MarketingType.label, { color: skin.text, flex: 1 }]}>
                  {item.title || `Вопрос ${idx + 1}`}
                </Text>
                <Text style={{ color: skin.accentColor, fontSize: 22, fontWeight: '600' }}>
                  {isOpen ? '−' : '+'}
                </Text>
              </Pressable>
              {isOpen && item.description ? (
                <Text style={[MarketingType.body, { color: skin.textSecondary, paddingBottom: 16 }]}>
                  {item.description}
                </Text>
              ) : null}
            </View>
          );
        })}
        </View>
      </MarketingPanel>
    </MarketingSection>
  );
}

const styles = StyleSheet.create({
  list: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    paddingHorizontal: 18,
  },
  row: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  question: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 18,
    minHeight: 56,
  },
});
