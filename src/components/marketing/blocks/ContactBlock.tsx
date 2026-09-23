import { StyleSheet, Text, View } from 'react-native';

import {
  CoverImage,
  MarketingButton,
  MarketingPanel,
  MarketingSection,
  useMarketingBreakpoint,
} from '@/components/marketing/shared';
import { MarketingType, type ResolvedMarketingSkin } from '@/components/marketing/theme';
import type { ContactBlock } from '@/components/marketing/types';

type Props = {
  block: ContactBlock;
  skin: ResolvedMarketingSkin;
  onCta: (url: string, key: string) => void;
};

export function ContactBlockView({ block, skin, onCta }: Props) {
  const { isMobile } = useMarketingBreakpoint();
  const key = block.id ?? 'contact';
  const actions: { label: string; url: string }[] = [];
  if (block.telegramUrl?.trim()) {
    actions.push({ label: 'Написать в Telegram', url: block.telegramUrl.trim() });
  }
  if (block.email?.trim()) {
    actions.push({ label: block.email.trim(), url: `mailto:${block.email.trim()}` });
  }
  if (block.faqAnchor?.trim()) {
    actions.push({ label: 'Читать FAQ', url: block.faqAnchor.trim() });
  }

  return (
    <MarketingSection skin={skin}>
      <MarketingPanel skin={skin} style={[styles.panel, isMobile && styles.panelMobile]}>
        <View style={[styles.row, isMobile && styles.col]}>
          <View style={[styles.copy, isMobile && styles.copyMobile]}>
            <Text
              style={[
                isMobile ? MarketingType.sectionMobile : MarketingType.section,
                { color: skin.text },
              ]}>
              {block.title || 'Остались вопросы?'}
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
            <View style={styles.actions}>
              {actions.length === 0 ? (
                <Text style={[MarketingType.body, { color: skin.textSecondary }]}>
                  Укажите Telegram или email в настройках блока.
                </Text>
              ) : (
                actions.map((action) => (
                  <MarketingButton
                    key={action.url}
                    skin={skin}
                    label={action.label}
                    variant="surface"
                    onPress={() => onCta(action.url, key)}
                  />
                ))
              )}
            </View>
          </View>
          <View style={isMobile ? styles.mediaMobile : styles.media}>
            {block.imageUrl ? (
              <CoverImage uri={block.imageUrl} style={styles.image} />
            ) : (
              <View style={[styles.image, { backgroundColor: skin.surfaceElevated }]} />
            )}
          </View>
        </View>
      </MarketingPanel>
    </MarketingSection>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 0, alignItems: 'stretch' },
  panel: { padding: 0, overflow: 'hidden' },
  panelMobile: { padding: 0 },
  col: { flexDirection: 'column' },
  copy: { flex: 1, minWidth: 0, padding: 28, justifyContent: 'center' },
  copyMobile: { padding: 18, paddingBottom: 8 },
  actions: { marginTop: 22, gap: 12 },
  media: {
    flex: 1,
    minWidth: 0,
    minHeight: 280,
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  mediaMobile: {
    width: '100%',
    height: 220,
    position: 'relative',
    overflow: 'hidden',
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
});
