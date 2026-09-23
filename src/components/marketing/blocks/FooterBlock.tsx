import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MarketingSection, useMarketingBreakpoint } from '@/components/marketing/shared';
import { MarketingType, type ResolvedMarketingSkin } from '@/components/marketing/theme';
import type { FooterBlock } from '@/components/marketing/types';

type Props = {
  block: FooterBlock;
  skin: ResolvedMarketingSkin;
  onCta: (url: string, key: string) => void;
};

export function FooterBlockView({ block, skin, onCta }: Props) {
  const { isMobile } = useMarketingBreakpoint();
  const key = block.id ?? 'footer';
  const groups = block.groups ?? [];

  return (
    <View style={[styles.wrap, { borderTopColor: skin.border, backgroundColor: skin.pageBackground }]}>
      <MarketingSection skin={skin} style={{ paddingTop: 40, paddingBottom: 32 }}>
        <View style={isMobile ? styles.mobileStack : styles.row}>
          <View style={isMobile ? styles.mobileBrand : styles.brand}>
            <Text style={[MarketingType.label, { color: skin.text, fontSize: 20 }]}>
              {block.title || 'Adventura'}
            </Text>
            {block.description ? (
              <Text style={[MarketingType.body, { color: skin.textSecondary, marginTop: 8 }]}>
                {block.description}
              </Text>
            ) : null}
          </View>
          {groups.map((group, gi) => (
          <View key={group.id ?? gi} style={isMobile ? styles.mobileGroup : styles.group}>
              {group.title ? (
              <Text style={[MarketingType.caption, { color: skin.textSecondary, marginBottom: 10 }]}>
                {group.title}
              </Text>
              ) : null}
              {(group.links ?? [])
                .filter((l) => l.label && l.url)
                .map((link, li) => (
                  <Pressable
                    key={`${gi}:${li}`}
                    onPress={() => onCta(link.url!, `${key}:${gi}:${li}`)}
                    style={{ paddingVertical: 4 }}>
                    <Text style={[MarketingType.body, { color: skin.textSecondary }]}>{link.label}</Text>
                  </Pressable>
                ))}
            </View>
          ))}
        </View>
        {(block.socials ?? []).filter((s) => s.label && s.url).length > 0 ? (
          <View style={styles.socials}>
            {(block.socials ?? [])
              .filter((s) => s.label && s.url)
              .map((s, i) => (
                <Pressable key={i} onPress={() => onCta(s.url!, `${key}:soc:${i}`)}>
                  <Text style={[MarketingType.caption, { color: skin.accentColor }]}>{s.label}</Text>
                </Pressable>
              ))}
          </View>
        ) : null}
        {block.legalText ? (
          <Text style={[MarketingType.caption, { color: skin.textSecondary }]}>{block.legalText}</Text>
        ) : null}
      </MarketingSection>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderTopWidth: StyleSheet.hairlineWidth, width: '100%' },
  row: { flexDirection: 'row', gap: 28, flexWrap: 'wrap' },
  brand: { flex: 1.4, minWidth: 180 },
  mobileStack: { width: '100%', flexDirection: 'column' },
  mobileBrand: { width: '100%', marginBottom: 28 },
  group: { flex: 1, minWidth: 120 },
  mobileGroup: { width: '100%', marginBottom: 22 },
  socials: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
});
