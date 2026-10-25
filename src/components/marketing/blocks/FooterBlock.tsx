import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CoverImage, MarketingSection, useMarketingBreakpoint } from '@/components/marketing/shared';
import {
  MarketingLayout,
  MarketingType,
  type ResolvedMarketingSkin,
} from '@/components/marketing/theme';
import type { FooterBlock } from '@/components/marketing/types';

type Props = {
  block: FooterBlock;
  skin: ResolvedMarketingSkin;
  onCta: (url: string, key: string) => void;
};

type IconName = ComponentProps<typeof Ionicons>['name'];

const SOCIAL_ICONS: { match: RegExp; icon: IconName }[] = [
  { match: /telegram|t\.me/i, icon: 'paper-plane' },
  { match: /tiktok/i, icon: 'logo-tiktok' },
  { match: /vk\.com|vkontakte|^vk$/i, icon: 'logo-vk' },
  { match: /youtube|youtu\.be/i, icon: 'logo-youtube' },
  { match: /discord/i, icon: 'logo-discord' },
  { match: /instagram/i, icon: 'logo-instagram' },
  { match: /mailto:|почта|e-?mail/i, icon: 'mail-outline' },
];

function socialIcon(label: string, url: string): IconName {
  return SOCIAL_ICONS.find(({ match }) => match.test(url) || match.test(label))?.icon ?? 'link-outline';
}

export function FooterBlockView({ block, skin, onCta }: Props) {
  const { isMobile } = useMarketingBreakpoint();
  const key = block.id ?? 'footer';
  const groups = block.groups ?? [];
  const socials = (block.socials ?? []).filter((s) => s.label && s.url);
  const title = block.title || 'Adventura';
  const hasBottom = socials.length > 0 || Boolean(block.legalText);

  return (
    <View
      style={[
        styles.wrap,
        {
          borderTopColor: skin.border,
          backgroundColor: skin.pageBackground,
          marginTop: isMobile ? MarketingLayout.sectionYMobile : MarketingLayout.sectionY,
        },
      ]}>
      <MarketingSection skin={skin} style={styles.section}>
        <View style={isMobile ? styles.topMobile : styles.top}>
          <View style={isMobile ? styles.brandMobile : styles.brand}>
            <View style={styles.brandRow}>
              {block.logoUrl ? (
                <CoverImage uri={block.logoUrl} style={styles.logo} fit="contain" />
              ) : (
                <View style={[styles.logo, styles.logoFallback, { backgroundColor: `${skin.accentColor}1F` }]}>
                  <Ionicons name="dice-outline" size={20} color={skin.accentColor} />
                </View>
              )}
              <Text style={[MarketingType.label, styles.brandTitle, { color: skin.text }]}>{title}</Text>
            </View>
            {block.description ? (
              <Text style={[MarketingType.body, { color: skin.textSecondary, marginTop: 12, maxWidth: 360 }]}>
                {block.description}
              </Text>
            ) : null}
          </View>

          {groups.map((group, gi) => {
            const links = (group.links ?? []).filter((l) => l.label && l.url);
            if (!group.title && links.length === 0) return null;
            return (
              <View key={group.id ?? gi} style={isMobile ? styles.groupMobile : styles.group}>
                {group.title ? (
                  <Text style={[styles.groupTitle, { color: skin.accentColor }]}>{group.title}</Text>
                ) : null}
                <View style={styles.links}>
                  {links.map((link, li) => (
                    <Pressable
                      key={`${gi}:${li}`}
                      accessibilityRole="link"
                      onPress={() => onCta(link.url!, `${key}:${gi}:${li}`)}
                      style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
                      <Text style={[MarketingType.body, { color: skin.text }]}>{link.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            );
          })}
        </View>

        {hasBottom ? (
          <View
            style={[
              isMobile ? styles.bottomMobile : styles.bottom,
              { borderTopColor: skin.border },
            ]}>
            {block.legalText ? (
              <Text style={[MarketingType.caption, styles.legal, { color: skin.textSecondary }]}>
                {block.legalText}
              </Text>
            ) : (
              <View />
            )}
            {socials.length > 0 ? (
              <View style={styles.socials}>
                {socials.map((s, i) => (
                  <Pressable
                    key={i}
                    accessibilityRole="link"
                    accessibilityLabel={s.label}
                    onPress={() => onCta(s.url!, `${key}:soc:${i}`)}
                    style={({ pressed }) => [
                      styles.social,
                      { backgroundColor: `${skin.accentColor}1A` },
                      pressed && styles.pressed,
                    ]}>
                    <Ionicons name={socialIcon(s.label!, s.url!)} size={15} color={skin.accentColor} />
                    <Text style={[MarketingType.caption, styles.socialLabel, { color: skin.accentColor }]}>
                      {s.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </MarketingSection>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderTopWidth: StyleSheet.hairlineWidth, width: '100%' },
  section: { paddingTop: 40, paddingBottom: 32 },
  top: { flexDirection: 'row', flexWrap: 'wrap', gap: 32 },
  topMobile: { flexDirection: 'column', gap: 24 },
  brand: { flex: 1.6, minWidth: 220 },
  brandMobile: { width: '100%' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandTitle: { fontSize: 20, lineHeight: 26 },
  logo: { width: 36, height: 36, borderRadius: 10 },
  logoFallback: { alignItems: 'center', justifyContent: 'center' },
  group: { flex: 1, minWidth: 140 },
  groupMobile: { width: '100%' },
  groupTitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 20, rowGap: 4 },
  link: { paddingVertical: 4 },
  pressed: { opacity: 0.7 },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 16,
    paddingTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  bottomMobile: {
    flexDirection: 'column-reverse',
    alignItems: 'flex-start',
    gap: 16,
    marginTop: 8,
    paddingTop: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  legal: { flexShrink: 1 },
  socials: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  social: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  socialLabel: { fontWeight: '600' },
});
